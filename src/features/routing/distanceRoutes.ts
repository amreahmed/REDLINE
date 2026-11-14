import type { MarsCoordinate } from '../mission/types'
import type { TerrainGrid } from '../terrain/gridTypes'
import { getGridCell, parseTerrainGridManifest } from '../terrain/terrainGrid'
import { MARS_REFERENCE_RADIUS_M, marsSurfaceDistance } from '../terrain/terrainMath'
import type { MetricResult } from '../terrain/terrainMath'
import type { GridIndices } from '../terrain/terrainMetrics'
import type { HypotheticalRoute, RoutePoint, RouteRequest, RouteResult } from './types'

export type DistanceGraph = {
  readonly nodeCount: number
  readonly neighbors: (node: number) => readonly { readonly node: number; readonly costM: number }[]
  /** Caller must supply an admissible lower bound; zero gives Dijkstra. */
  readonly heuristicM: (node: number, goal: number) => number
}
type DistancePath = { readonly nodes: readonly number[]; readonly distanceM: number; readonly visitedCells: number }
type HeapEntry = { node: number; distance: number; estimate: number }

function earlier(left: HeapEntry, right: HeapEntry): boolean {
  return left.estimate < right.estimate || (left.estimate === right.estimate && (left.distance < right.distance || (left.distance === right.distance && left.node < right.node)))
}

/** Binary min-heap. Lazy duplicates allow cheaper paths to reopen a node. */
class OpenSet {
  private entries: HeapEntry[] = []
  get size() { return this.entries.length }
  push(entry: HeapEntry) {
    let index = this.entries.length
    this.entries.push(entry)
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (!earlier(entry, this.entries[parent])) break
      this.entries[index] = this.entries[parent]
      index = parent
    }
    this.entries[index] = entry
  }
  pop(): HeapEntry {
    const minimum = this.entries[0]
    const last = this.entries.pop()!
    if (this.entries.length) {
      let index = 0
      while (index * 2 + 1 < this.entries.length) {
        let child = index * 2 + 1
        if (child + 1 < this.entries.length && earlier(this.entries[child + 1], this.entries[child])) child++
        if (!earlier(this.entries[child], last)) break
        this.entries[index] = this.entries[child]
        index = child
      }
      this.entries[index] = last
    }
    return minimum
  }
}

/**
 * A* with finite nonnegative costs, reopening and a deterministic min-heap.
 * The goal is accepted only when its best score is popped; stale scores do not
 * terminate search. The generic kernel allows independent synthetic oracles.
 */
export function findShortestDistancePath(graph: DistanceGraph, origin: number, destination: number): MetricResult<DistancePath> {
  try {
    const validNode = (node: number) => Number.isSafeInteger(node) && node >= 0 && node < graph.nodeCount
    if (!Number.isSafeInteger(graph.nodeCount) || graph.nodeCount < 1 || graph.nodeCount > 65536 || !validNode(origin) || !validNode(destination)) throw new Error('Route graph and control indices must be within the supported node range.')
    const heuristic = (node: number) => {
      const value = graph.heuristicM(node, destination)
      if (!Number.isFinite(value) || value < 0) throw new Error('Route heuristic must be a finite nonnegative lower bound.')
      return value
    }
    const distances = new Float64Array(graph.nodeCount).fill(Infinity)
    const previous = new Int32Array(graph.nodeCount).fill(-1)
    const visited = new Uint8Array(graph.nodeCount)
    let visitedCells = 0
    const open = new OpenSet()
    distances[origin] = 0
    open.push({ node: origin, distance: 0, estimate: heuristic(origin) })
    while (open.size) {
      const current = open.pop()
      if (current.distance !== distances[current.node]) continue
      if (!visited[current.node]) { visited[current.node] = 1; visitedCells++ }
      if (current.node === destination) {
        const nodes: number[] = []
        for (let node = destination; node !== -1; node = previous[node]) {
          nodes.push(node)
          if (nodes.length > graph.nodeCount) throw new Error('Route predecessor chain is invalid.')
        }
        nodes.reverse()
        if (nodes[0] !== origin) throw new Error('Route does not connect the requested controls.')
        return { status: 'available', value: { nodes, distanceM: current.distance, visitedCells } }
      }
      const neighbors = graph.neighbors(current.node)
      if (!Array.isArray(neighbors)) throw new Error('Route neighbor list is invalid.')
      for (const edge of neighbors) {
        if (!edge || !validNode(edge.node)) throw new Error('Route edge index is outside the graph.')
        if (!Number.isFinite(edge.costM) || edge.costM < 0) throw new Error('Route edge cost must be finite and nonnegative.')
        const nextDistance = current.distance + edge.costM
        if (!Number.isFinite(nextDistance)) throw new Error('Route distance overflowed; no result is available.')
        if (nextDistance >= distances[edge.node]) continue
        const estimate = nextDistance + heuristic(edge.node)
        if (!Number.isFinite(estimate)) throw new Error('Route estimate overflowed; no result is available.')
        distances[edge.node] = nextDistance
        previous[edge.node] = current.node
        open.push({ node: edge.node, distance: nextDistance, estimate })
      }
    }
    return { status: 'unavailable', reason: 'No connected path exists within valid native coverage.' }
  } catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : 'Route graph is unavailable.' }
  }
}

function coordinate(point: RoutePoint): MarsCoordinate {
  return { lon: point.lon, lat: point.lat, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeDomain: '-180-180' }
}

function sphereDistance(first: RoutePoint, second: RoutePoint): number {
  const result = marsSurfaceDistance(coordinate(first), coordinate(second))
  if (result.status !== 'available') throw new Error(result.reason)
  return result.value
}

function nativeGraph(grid: TerrainGrid) {
  const { startRow, startColumn, rows, columns } = grid.manifest.grid
  const points: (RoutePoint | null)[] = new Array(rows * columns).fill(null)
  const valid = new Uint8Array(points.length)
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const result = getGridCell(grid, row + startRow, column + startColumn)
    if (result.status !== 'valid') continue
    const index = row * columns + column
    const { lon, lat } = result.cell
    points[index] = { row: row + startRow, column: column + startColumn, lon, lat }
    valid[index] = 1
  }
  const point = (node: number) => {
    const value = points[node]
    if (!value) throw new Error('Route node is missing native coverage.')
    return value
  }
  const graph: DistanceGraph = {
    nodeCount: points.length,
    neighbors(node) {
      if (!valid[node]) return []
      const row = Math.floor(node / columns)
      const column = node % columns
      const result: { node: number; costM: number }[] = []
      for (let rowStep = -1; rowStep <= 1; rowStep++) for (let columnStep = -1; columnStep <= 1; columnStep++) {
        if (!rowStep && !columnStep) continue
        const nextRow = row + rowStep
        const nextColumn = column + columnStep
        if (nextRow < 0 || nextRow >= rows || nextColumn < 0 || nextColumn >= columns) continue
        const next = nextRow * columns + nextColumn
        if (!valid[next]) continue
        if (rowStep && columnStep && (!valid[row * columns + nextColumn] || !valid[nextRow * columns + column])) continue
        const costM = sphereDistance(point(node), point(next))
        if (!Number.isFinite(costM) || costM <= 0) throw new Error('Distinct native cells require positive finite edge distance.')
        result.push({ node: next, costM })
      }
      return result
    },
    // Shortest sphere arcs obey the triangle inequality and cannot exceed any
    // sum of these sphere-distance edges. A small downward contraction keeps
    // the mathematical lower bound conservative against ordinary FP rounding.
    heuristicM: (node, goal) => sphereDistance(point(node), point(goal)) * (1 - 1e-9),
  }
  return { graph, point }
}

/**
 * Geometry/coverage-only hypothetical graph. Native finite/NoData checks are
 * coverage checks, never terrain suitability. Source heights do not enter the
 * edge weights or heuristic. A finite source cell does not prove traversability.
 */
export function calculateDistanceRoutes(request: RouteRequest): RouteResult {
  try {
    if (!request || typeof request !== 'object' || !request.grid) throw new Error('Route request and numerical grid are required.')
    const { grid, origin, destination, waypoint } = request
    const manifest = parseTerrainGridManifest(grid.manifest)
    if (!(grid.values instanceof Float32Array) || grid.values.length !== manifest.grid.rows * manifest.grid.columns) throw new Error('Route grid storage must match the native decoded float32 crop.')
    const { startRow, startColumn, columns } = manifest.grid
    const control = (indices: GridIndices, role: string) => {
      const result = getGridCell(grid, indices?.row, indices?.column)
      if (result.status !== 'valid') throw new Error(`${role}: ${result.reason}`)
      return (result.cell.row - startRow) * columns + result.cell.column - startColumn
    }
    const start = control(origin, 'Origin')
    const end = control(destination, 'Destination')
    if (start === end) throw new Error('Choose distinct origin and destination cells for a hypothetical route.')
    const via = waypoint == null ? null : control(waypoint, 'Waypoint')
    if (via === start || via === end) throw new Error('The optional waypoint must be distinct from both endpoints.')
    const { graph, point } = nativeGraph(grid)
    const makeRoute = (path: DistancePath, id: HypotheticalRoute['id'], name: string): HypotheticalRoute => ({
      id, name, points: path.nodes.map(point), distanceM: path.distanceM, visitedCells: path.visitedCells,
      sourceId: manifest.source.productId, sourceHash: manifest.source.sha256, gridHash: manifest.encoding.sha256,
      model: 'hypothetical-distance-only', referenceRadiusM: MARS_REFERENCE_RADIUS_M,
    })
    const shortest = findShortestDistancePath(graph, start, end)
    if (shortest.status !== 'available') return shortest
    if (via === null) return { status: 'available', value: { shortest: makeRoute(shortest.value, 'shortest', 'Shortest grid path'), via: null } }
    const firstLeg = findShortestDistancePath(graph, start, via)
    if (firstLeg.status !== 'available') return { status: 'unavailable', reason: `Waypoint first leg: ${firstLeg.reason}` }
    const secondLeg = findShortestDistancePath(graph, via, end)
    if (secondLeg.status !== 'available') return { status: 'unavailable', reason: `Waypoint second leg: ${secondLeg.reason}` }
    const distanceM = firstLeg.value.distanceM + secondLeg.value.distanceM
    if (!Number.isFinite(distanceM)) return { status: 'unavailable', reason: 'Waypoint route distance overflowed.' }
    const waypointPath: DistancePath = {
      nodes: [...firstLeg.value.nodes, ...secondLeg.value.nodes.slice(1)], distanceM,
      // Number of node expansions across the two separate searches, not unique
      // route cells or a source quality/accuracy metric.
      visitedCells: firstLeg.value.visitedCells + secondLeg.value.visitedCells,
    }
    return { status: 'available', value: { shortest: makeRoute(shortest.value, 'shortest', 'Shortest grid path'), via: makeRoute(waypointPath, 'via', 'Via your waypoint') } }
  } catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : 'Hypothetical route calculation failed.' }
  }
}
