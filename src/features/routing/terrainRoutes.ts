import type { TerrainAnalysis, TerrainModelGrid, TerrainMovement, TerrainProfile } from '../terrain/modelTypes'
import { modelDistance, modelPoint, terrainMovement, validateTerrainModelGrid, validateTerrainProfile } from '../terrain/terrainModel'
import { findShortestDistancePath } from './distanceRoutes'
import type { DistanceGraph } from './distanceRoutes'
import type { RoutePoint } from './types'

export type TerrainModelRoute = {
  readonly id: 'distance' | 'terrain'
  readonly model: 'hypothetical-dem-distance' | 'hypothetical-dem-terrain'
  readonly nodes: readonly number[]
  readonly points: readonly RoutePoint[]
  /** Unique expanded nodes, including each accepted leg's goal. */
  readonly exploredNodes: readonly number[]
  readonly horizontalDistanceM: number
  readonly accumulatedCostM: number
  readonly costUnit: 'cost-equivalent-m'
  /** Null if any path segment has an unknown terrain grade. */
  readonly maxGradeDeg: number | null
  readonly meanAbsGradeDeg: number | null
  /** Local DEM gradient angle; null if any path cell lacks gradient support. */
  readonly maxSlopeDeg: number | null
  readonly meanSlopeDeg: number | null
  /** Null if any path cell lacks the supported roughness neighborhood. */
  readonly maxRoughnessM: number | null
  readonly meanRoughnessM: number | null
  readonly unknownSegments: number
  /** Count over the complete analysis grid; this is not an avoided-obstacle count. */
  readonly blockedSearchCells: number
  readonly unknownSearchCells: number
  readonly profile: TerrainProfile
  readonly source: TerrainModelGrid['source']
  readonly scientificStatus: 'physical-terrain-unverified'
  readonly qualification: string
}

export type TerrainComparison = {
  readonly distance: TerrainModelRoute
  readonly terrain: TerrainModelRoute
  readonly waypoint: number | null
}

export type TerrainComparisonResult = {
  readonly status: 'available'
  readonly value: TerrainComparison
} | {
  readonly status: 'unavailable'
  readonly reason: string
}

type PermittedEdge = { readonly node: number; readonly movement: TerrainMovement }
type SearchPath = { readonly nodes: readonly number[]; readonly exploredNodes: readonly number[] }

/**
 * Separate qualified DEM model, never the CTX scientific authorization gate.
 * Both objectives use precisely the same permitted directional graph. The
 * terrain objective minimizes hypothetical cost-equivalent metres, not energy,
 * travel time, human safety or verified real-Mars physical traversability.
 */
export function calculateTerrainComparison(analysis: TerrainAnalysis, origin: number, destination: number, waypoint: number | null = null): TerrainComparisonResult {
  try {
    if (!analysis || typeof analysis !== 'object') throw new Error('A supported terrain analysis is required.')
    const { grid, profile } = analysis
    validateTerrainModelGrid(grid)
    validateTerrainProfile(profile)
    const count = grid.rows * grid.columns
    if (count > 65536) throw new Error('Terrain routing supports at most 65,536 native cells.')
    for (const raster of [analysis.slopeDeg, analysis.roughnessM, analysis.reliefM, analysis.shapeM]) {
      if (!(raster instanceof Float32Array) || raster.length !== count) throw new Error('Terrain metric rasters must match the native grid.')
    }
    if (!(analysis.states instanceof Uint8Array) || analysis.states.length !== count || analysis.states.some(state => state > 3)) throw new Error('Terrain classifications must match the native grid.')
    const validNode = (node: number) => Number.isSafeInteger(node) && node >= 0 && node < count
    const canUse = (node: number) => validNode(node) && grid.valid[node] === 1 && Number.isFinite(grid.values[node]) && analysis.states[node] !== 3 && (analysis.states[node] !== 0 || profile.unknownPolicy === 'penalize')
    const control = (node: number, role: string) => {
      if (!validNode(node)) throw new Error(`${role} must be a native cell index inside the supported grid.`)
      if (!canUse(node)) throw new Error(`${role} is blocked, missing or unknown under the selected rover assumptions.`)
    }
    control(origin, 'Origin')
    control(destination, 'Destination')
    if (origin === destination) throw new Error('Choose distinct origin and destination cells for a hypothetical DEM route.')
    if (waypoint !== null) {
      control(waypoint, 'Waypoint')
      if (waypoint === origin || waypoint === destination) throw new Error('The optional waypoint must differ from both endpoints.')
    }

    const cache = new Map<number, readonly PermittedEdge[]>()
    const permitted = (node: number): readonly PermittedEdge[] => {
      const stored = cache.get(node)
      if (stored) return stored
      const edges: PermittedEdge[] = []
      if (canUse(node)) {
        const row = Math.floor(node / grid.columns)
        const column = node % grid.columns
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nextRow = row + dr
          const nextColumn = column + dc
          if (nextRow < 0 || nextRow >= grid.rows || nextColumn < 0 || nextColumn >= grid.columns) continue
          const next = nextRow * grid.columns + nextColumn
          if (!canUse(next)) continue
          // No diagonal may pass a blocked or excluded unknown/missing flank.
          if (dr && dc && (!canUse(row * grid.columns + nextColumn) || !canUse(nextRow * grid.columns + column))) continue
          const movement = terrainMovement(analysis, node, next)
          if (!['TRAVERSABLE', 'HIGH_COST', 'BLOCKED', 'UNKNOWN'].includes(movement.classification)) throw new Error('Terrain movement classification is unsupported.')
          if (movement.classification === 'BLOCKED' || movement.costM === null) continue
          if (movement.classification === 'UNKNOWN' && profile.unknownPolicy !== 'penalize') continue
          if (!Number.isFinite(movement.distanceM) || movement.distanceM <= 0 || !Number.isFinite(movement.costM) || movement.costM < movement.distanceM) throw new Error('Terrain edges require finite positive distance and cost no lower than distance.')
          edges.push({ node: next, movement })
        }
      }
      cache.set(node, edges)
      return edges
    }
    const search = (start: number, end: number, terrainCost: boolean): SearchPath => {
      const explored = new Set<number>()
      const graph: DistanceGraph = {
        nodeCount: count,
        neighbors(node) {
          explored.add(node)
          return permitted(node).map(edge => ({ node: edge.node, costM: terrainCost ? edge.movement.costM! : edge.movement.distanceM }))
        },
        // Every admitted cost is >= horizontal distance. Sphere arc triangle
        // inequality therefore bounds either objective, including unknown costs.
        heuristicM: (node, goal) => modelDistance(grid, node, goal) * (1 - 1e-9),
      }
      const result = findShortestDistancePath(graph, start, end)
      if (result.status !== 'available') throw new Error(`No connected route exists under the selected rover assumptions. ${result.reason}`)
      explored.add(end)
      return { nodes: result.value.nodes, exploredNodes: [...explored].sort((a, b) => a - b) }
    }
    const objectivePath = (terrainCost: boolean): SearchPath => {
      if (waypoint === null) return search(origin, destination, terrainCost)
      const first = search(origin, waypoint, terrainCost)
      const second = search(waypoint, destination, terrainCost)
      return {
        nodes: [...first.nodes, ...second.nodes.slice(1)],
        exploredNodes: [...new Set([...first.exploredNodes, ...second.exploredNodes])].sort((a, b) => a - b),
      }
    }
    const blockedSearchCells = analysis.states.reduce((sum, state) => sum + Number(state === 3), 0)
    const unknownSearchCells = analysis.states.reduce((sum, state) => sum + Number(state === 0), 0)
    const makeRoute = (path: SearchPath, id: TerrainModelRoute['id']): TerrainModelRoute => {
      let horizontalDistanceM = 0
      let accumulatedCostM = 0
      let unknownSegments = 0
      const grades: number[] = []
      for (let index = 1; index < path.nodes.length; index++) {
        const edge = permitted(path.nodes[index - 1]).find(edge => edge.node === path.nodes[index])
        if (!edge) throw new Error('A reconstructed terrain route contains an excluded movement.')
        horizontalDistanceM += edge.movement.distanceM
        accumulatedCostM += edge.movement.costM!
        if (edge.movement.classification === 'UNKNOWN' || edge.movement.gradeDeg === null) unknownSegments++
        else grades.push(Math.abs(edge.movement.gradeDeg))
      }
      if (!Number.isFinite(horizontalDistanceM) || !Number.isFinite(accumulatedCostM) || !grades.every(Number.isFinite)) throw new Error('Terrain route metrics are nonfinite.')
      const roughness = path.nodes.map(node => analysis.roughnessM[node])
      const knownRoughness = roughness.every(Number.isFinite)
      const slopes = path.nodes.map(node => analysis.slopeDeg[node])
      const knownSlopes = slopes.every(Number.isFinite)
      const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
      const maximum = (values: readonly number[]) => values.reduce((largest, value) => Math.max(largest, value), -Infinity)
      return {
        id, model: id === 'terrain' ? 'hypothetical-dem-terrain' : 'hypothetical-dem-distance',
        nodes: [...path.nodes], points: path.nodes.map(node => modelPoint(grid, node)), exploredNodes: path.exploredNodes,
        horizontalDistanceM, accumulatedCostM, costUnit: 'cost-equivalent-m',
        maxGradeDeg: unknownSegments ? null : maximum(grades),
        meanAbsGradeDeg: unknownSegments ? null : mean(grades),
        maxSlopeDeg: knownSlopes ? maximum(slopes) : null,
        meanSlopeDeg: knownSlopes ? mean(slopes) : null,
        maxRoughnessM: knownRoughness ? maximum(roughness) : null,
        meanRoughnessM: knownRoughness ? mean(roughness) : null,
        unknownSegments, blockedSearchCells, unknownSearchCells, profile: { ...profile }, source: { ...grid.source },
        scientificStatus: 'physical-terrain-unverified',
        qualification: `Hypothetical DEM-based model. Physical traversability and human safety are not validated. ${grid.source.qualification}`,
      }
    }
    return { status: 'available', value: { distance: makeRoute(objectivePath(false), 'distance'), terrain: makeRoute(objectivePath(true), 'terrain'), waypoint } }
  } catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : 'The qualified DEM routing model is unavailable.' }
  }
}
