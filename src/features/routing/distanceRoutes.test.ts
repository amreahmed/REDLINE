/// <reference types="node" />
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import sourceManifest from '../../../public/data/jezero-terrain-grid.json'
import { terrainHeightDifferenceBlocker } from '../../data/terrainScience'
import { decodeTerrainGrid, getGridCell, parseTerrainGridManifest } from '../terrain/terrainGrid'
import type { TerrainGrid } from '../terrain/gridTypes'
import { measureGridSeparation } from '../terrain/terrainMetrics'
import { calculateDistanceRoutes, findShortestDistancePath } from './distanceRoutes'
import type { DistanceGraph } from './distanceRoutes'
import type { HypotheticalRoute, RouteRequest } from './types'

const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))).buffer
const grid = decodeTerrainGrid(parseTerrainGridManifest(sourceManifest), binary)
const origin = { row: 714, column: 650 }
const destination = { row: 715, column: 651 }
const request: RouteRequest = { grid, origin, destination, waypoint: null }

function route(input: RouteRequest = request) {
  const result = calculateDistanceRoutes(input)
  if (result.status !== 'available') throw new Error(result.reason)
  return result.value
}

function changedCells(cells: readonly (readonly [number, number, number])[]): TerrainGrid {
  const values = grid.values.slice()
  for (const [row, column, value] of cells) values[(row - 586) * 256 + column - 522] = value
  return { manifest: grid.manifest, values }
}

function pathIndices(path: HypotheticalRoute) {
  return path.points.map(point => [point.row, point.column])
}

describe('hypothetical native distance routes', () => {
  it('uses native centers and independently checked sphere edge distance without terrain metrics', () => {
    const shortest = route().shortest
    expect(pathIndices(shortest)).toEqual([[714, 650], [715, 651]])
    expect(shortest.distanceM).toBeCloseTo(27.56467529051163, 7)
    expect(shortest).toMatchObject({ model: 'hypothetical-distance-only', referenceRadiusM: 3396190, sourceId: grid.manifest.source.productId, sourceHash: grid.manifest.source.sha256, gridHash: grid.manifest.encoding.sha256 })
    expect(shortest.points.every(point => !('elevationM' in point))).toBe(true)
    expect(shortest).not.toHaveProperty('slope')
    expect(shortest).not.toHaveProperty('terrainCost')
    expect(shortest).not.toHaveProperty('safety')
    expect(route().via).toBeNull()
    expect(terrainHeightDifferenceBlocker(grid)).toBeTypeOf('string')
  })

  it('is deterministic and reverse paths preserve length', () => {
    expect(route()).toEqual(route())
    const reverse = route({ ...request, origin: destination, destination: origin }).shortest
    expect(reverse.distanceM).toBeCloseTo(route().shortest.distanceM, 9)
    expect(pathIndices(reverse)).toEqual([[715, 651], [714, 650]])
  })

  it('computes a real waypoint alternative as two connected shortest legs', () => {
    const waypoint = { row: 713, column: 650 }
    const routes = route({ ...request, waypoint })
    expect(routes.via).not.toBeNull()
    const via = routes.via!
    expect(via.points.filter(point => point.row === waypoint.row && point.column === waypoint.column)).toHaveLength(1)
    expect(pathIndices(via)[0]).toEqual([714, 650])
    expect(pathIndices(via).at(-1)).toEqual([715, 651])
    expect(via.distanceM).toBeGreaterThan(routes.shortest.distanceM)
    let independentlySummed = 0
    for (let index = 1; index < via.points.length; index++) {
      const distance = measureGridSeparation(grid, via.points[index - 1], via.points[index])
      if (distance.status !== 'available') throw new Error(distance.reason)
      independentlySummed += distance.value.distanceM
    }
    expect(via.distanceM).toBeCloseTo(independentlySummed, 9)
  })

  it('does not modify source bytes or use finite heights in route costs', () => {
    const before = createHash('sha256').update(new Uint8Array(grid.values.buffer)).digest('hex')
    const changed = { manifest: grid.manifest, values: new Float32Array(65536).fill(12345) }
    expect(route({ ...request, grid: changed })).toEqual(route())
    expect(createHash('sha256').update(new Uint8Array(grid.values.buffer)).digest('hex')).toBe(before)
    expect(grid.values).toHaveLength(65536)
  })

  it('searches the entire supported crop and retains native centers at opposite boundaries', () => {
    const boundaryOrigin = { row: 586, column: 522 }
    const boundaryDestination = { row: 841, column: 777 }
    const shortest = route({ ...request, origin: boundaryOrigin, destination: boundaryDestination }).shortest
    expect(pathIndices(shortest)[0]).toEqual([586, 522])
    expect(pathIndices(shortest).at(-1)).toEqual([841, 777])
    expect(shortest.points).toHaveLength(256)
    expect(shortest.visitedCells).toBeLessThanOrEqual(65536)
    let independentlySummed = 0
    for (let index = 1; index < shortest.points.length; index++) {
      const previous = shortest.points[index - 1]
      const current = shortest.points[index]
      expect(Math.abs(current.row - previous.row)).toBe(1)
      expect(Math.abs(current.column - previous.column)).toBe(1)
      const distance = measureGridSeparation(grid, previous, current)
      if (distance.status !== 'available') throw new Error(distance.reason)
      independentlySummed += distance.value.distanceM
    }
    expect(shortest.distanceM).toBeCloseTo(independentlySummed, 8)
    expect(grid.values).toHaveLength(65536)
  })

  it.each([grid.manifest.sourceGrid.noData, NaN, Infinity, -Infinity])('blocks missing/nonfinite endpoints %s', value => {
    const missing = changedCells([[714, 650, value]])
    expect(calculateDistanceRoutes({ ...request, grid: missing })).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/Origin.*NoData|Origin.*nonfinite/) })
  })

  it.each([[714, 651], [715, 650]])('does not cut a missing diagonal flank r%s c%s', (row, column) => {
    const missing = changedCells([[row, column, grid.manifest.sourceGrid.noData]])
    const path = route({ ...request, grid: missing }).shortest
    expect(path.points).toHaveLength(3)
    expect(path.distanceM).toBeGreaterThan(38)
    expect(path.points.some(point => point.row === row && point.column === column)).toBe(false)
  })

  it('routes around interior gaps without normalizing them into valid coverage', () => {
    const gap = changedCells([[714, 651, NaN]])
    const path = route({ ...request, grid: gap, destination: { row: 714, column: 652 } }).shortest
    expect(path.points.some(point => point.row === 714 && point.column === 651)).toBe(false)
    expect(path.distanceM).toBeGreaterThan(50)
    for (const point of path.points) expect(getGridCell(gap, point.row, point.column).status).toBe('valid')
  })

  it('reports an isolated endpoint and unreachable waypoint without silently dropping a leg', () => {
    const isolated = changedCells([
      [713, 649, NaN], [713, 650, NaN], [713, 651, NaN], [714, 649, NaN],
      [714, 651, NaN], [715, 649, NaN], [715, 650, NaN], [715, 651, NaN],
    ])
    expect(calculateDistanceRoutes({ ...request, grid: isolated, destination: { row: 720, column: 660 } })).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/connected path/) })
    expect(calculateDistanceRoutes({ ...request, grid: isolated, origin: { row: 720, column: 660 }, destination: { row: 721, column: 661 }, waypoint: origin })).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/waypoint.*connected path/i) })
  })

  it.each([
    { origin: { row: 585, column: 650 } }, { destination: { row: 714.5, column: 650 } },
    { destination: origin }, { waypoint: origin }, { waypoint: destination },
    { waypoint: { row: 714, column: 778 } },
  ])('rejects invalid or duplicate route controls %o', controls => {
    expect(calculateDistanceRoutes({ ...request, ...controls })).toMatchObject({ status: 'unavailable', reason: expect.any(String) })
  })

  it('rejects unknown source/CRS contracts, wrong storage and malformed requests', () => {
    for (const wrong of [
      { ...grid, values: new Float32Array(2) },
      { ...grid, values: [] },
      { ...grid, manifest: { ...grid.manifest, source: { ...grid.manifest.source, sha256: '0'.repeat(64) } } },
      { ...grid, manifest: { ...grid.manifest, projection: { ...grid.manifest.projection, radiusM: 6378137 } } },
    ]) expect(calculateDistanceRoutes({ ...request, grid: wrong } as RouteRequest)).toMatchObject({ status: 'unavailable', reason: expect.any(String) })
    expect(calculateDistanceRoutes(null as unknown as RouteRequest)).toMatchObject({ status: 'unavailable', reason: expect.any(String) })
  })

  it.each([[586, 522], [700, 640], [839, 774]])('matches independent Dijkstra on a masked native subgraph near r%s c%s', (startRow, startColumn) => {
    // The NoData pattern is synthetic test coverage. Geometry stays in the actual
    // audited native frame at three different latitudes/longitudes.
    const values = new Float32Array(65536).fill(grid.manifest.sourceGrid.noData)
    const points = Array.from({ length: 12 }, (_, index) => ({ row: startRow + Math.floor(index / 4), column: startColumn + index % 4 }))
    const missing = new Set([5])
    for (let index = 0; index < points.length; index++) if (!missing.has(index)) {
      const point = points[index]
      values[(point.row - 586) * 256 + point.column - 522] = 1
    }
    const masked = { manifest: grid.manifest, values }
    const neighbors = (index: number) => points.flatMap((point, next) => {
      const rowDifference = Math.abs(point.row - points[index].row)
      const columnDifference = Math.abs(point.column - points[index].column)
      if (next === index || missing.has(next) || rowDifference > 1 || columnDifference > 1) return []
      if (rowDifference && columnDifference) {
        const flankA = points.findIndex(candidate => candidate.row === points[index].row && candidate.column === point.column)
        const flankB = points.findIndex(candidate => candidate.row === point.row && candidate.column === points[index].column)
        if (missing.has(flankA) || missing.has(flankB)) return []
      }
      const distance = measureGridSeparation(masked, points[index], point)
      if (distance.status !== 'available') throw new Error(distance.reason)
      return [{ next, weight: distance.value.distanceM }]
    })
    // Independent linear-scan Dijkstra, with no heap or heuristic.
    const oracle = (from: number, to: number) => {
      const distances = points.map(() => Infinity)
      const done = new Set<number>()
      distances[from] = 0
      while (done.size < points.length) {
        let closest = -1
        for (let index = 0; index < points.length; index++) if (!done.has(index) && (closest === -1 || distances[index] < distances[closest])) closest = index
        if (closest === -1 || !Number.isFinite(distances[closest])) break
        if (closest === to) return distances[closest]
        done.add(closest)
        for (const edge of neighbors(closest)) distances[edge.next] = Math.min(distances[edge.next], distances[closest] + edge.weight)
      }
      return Infinity
    }
    for (const [from, to] of [[0, 11], [3, 8], [1, 10], [8, 3], [2, 9]]) {
      const shortest = route({ grid: masked, origin: points[from], destination: points[to], waypoint: null }).shortest
      expect(shortest.distanceM).toBeCloseTo(oracle(from, to), 8)
    }
  })
})

describe('A* kernel independent synthetic graph fixtures', () => {
  // Graph weights here are arbitrary synthetic mathematical fixtures, not terrain.
  const edges = [[{ node: 1, costM: 10 }, { node: 2, costM: 1 }], [{ node: 3, costM: 1 }], [{ node: 1, costM: 1 }, { node: 3, costM: 20 }], []]
  const graph: DistanceGraph = { nodeCount: 4, neighbors: node => edges[node], heuristicM: () => 0 }

  it('relaxes previously discovered nodes and ignores stale heap entries', () => {
    const result = findShortestDistancePath(graph, 0, 3)
    expect(result).toMatchObject({ status: 'available', value: { nodes: [0, 2, 1, 3], distanceM: 3 } })
  })

  it('matches an independent Floyd–Warshall oracle for every pair in a cyclic graph', () => {
    const weights = [
      [0, 7, 2, Infinity, Infinity, Infinity],
      [7, 0, 1, 3, Infinity, Infinity],
      [2, 1, 0, 8, 10, Infinity],
      [Infinity, 3, 8, 0, 1, 9],
      [Infinity, Infinity, 10, 1, 0, 2],
      [Infinity, Infinity, Infinity, 9, 2, 0],
    ]
    const oracle = weights.map(row => [...row])
    for (let k = 0; k < 6; k++) for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) oracle[i][j] = Math.min(oracle[i][j], oracle[i][k] + oracle[k][j])
    const cyclic: DistanceGraph = { nodeCount: 6, neighbors: node => weights[node].flatMap((costM, next) => next !== node && Number.isFinite(costM) ? [{ node: next, costM }] : []), heuristicM: () => 0 }
    for (let from = 0; from < 6; from++) for (let to = 0; to < 6; to++) {
      const result = findShortestDistancePath(cyclic, from, to)
      expect(result.status).toBe('available')
      if (result.status === 'available') expect(result.value.distanceM).toBe(oracle[from][to])
    }
  })

  it('supports a proven lower-bound heuristic and disconnected graphs', () => {
    const withHeuristic = { ...graph, heuristicM: (node: number) => [3, 1, 2, 0][node] }
    expect(findShortestDistancePath(withHeuristic, 0, 3)).toMatchObject({ status: 'available', value: { distanceM: 3 } })
    expect(findShortestDistancePath(graph, 3, 0)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/connected path/) })
  })

  it('reopens an expanded node with an admissible but inconsistent heuristic', () => {
    // True remaining distances are [5, 3, 4, 0]. The lower bound at node 2
    // is admissible but exceeds its edge-to-1 cost plus node 1's lower bound.
    const reopenEdges = [
      [{ node: 1, costM: 3 }, { node: 2, costM: 1 }],
      [{ node: 3, costM: 3 }],
      [{ node: 1, costM: 1 }, { node: 3, costM: 100 }],
      [],
    ]
    const reopened: DistanceGraph = { nodeCount: 4, neighbors: node => reopenEdges[node], heuristicM: node => [0, 0, 4, 0][node] }
    expect(findShortestDistancePath(reopened, 0, 3)).toMatchObject({ status: 'available', value: { nodes: [0, 2, 1, 3], distanceM: 5, visitedCells: 4 } })
  })

  it.each([-1, NaN, Infinity])('rejects invalid edge costs %s rather than finding a false route', costM => {
    expect(findShortestDistancePath({ nodeCount: 2, neighbors: () => [{ node: 1, costM }], heuristicM: () => 0 }, 0, 1)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/cost/) })
  })

  it('rejects out-of-range edges, controls and invalid heuristic values', () => {
    expect(findShortestDistancePath({ ...graph, neighbors: () => [{ node: 4, costM: 1 }] }, 0, 3).status).toBe('unavailable')
    expect(findShortestDistancePath({ ...graph, heuristicM: () => NaN }, 0, 3).status).toBe('unavailable')
    expect(findShortestDistancePath(graph, -1, 3).status).toBe('unavailable')
    expect(findShortestDistancePath(graph, 0, 4).status).toBe('unavailable')
  })
})
