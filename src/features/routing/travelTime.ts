import type { TerrainAnalysis, TerrainClassification, TerrainModelGrid, TerrainProfile } from '../terrain/modelTypes'
import { modelPoint, terrainMovement, validateTerrainModelGrid, validateTerrainProfile } from '../terrain/terrainModel'
import type { TerrainModelRoute } from './terrainRoutes'
import type { RoutePoint } from './types'

/** User assumptions, never specifications or measured performance of a real rover. */
export type MobilityProfile = {
  readonly id: 'hypothetical-survey' | 'hypothetical-transit' | 'hypothetical-custom'
  readonly name: string
  readonly nominalSpeedMps: number
  readonly minSpeedMps: number
  readonly maxSpeedMps: number
  readonly uphillSensitivity: number
  readonly downhillSensitivity: number
  readonly gradientSensitivity: number
  readonly roughnessSensitivity: number
  readonly highCostPenalty: number
  readonly unknownSpeedMps: number
  /** Symmetric speed scenarios, not an empirical confidence interval. */
  readonly speedUncertaintyFraction: number
}

type DurationRange = { readonly lower: number; readonly upper: number }

export type TravelTimeSegment = {
  readonly index: number
  readonly from: RoutePoint
  readonly to: RoutePoint
  readonly distanceM: number
  readonly classification: Exclude<TerrainClassification, 'BLOCKED'>
  readonly gradeDeg: number | null
  readonly gradientDeg: number | null
  readonly roughnessM: number | null
  readonly effectiveSpeedMps: number
  readonly durationSeconds: number
  readonly durationRangeSeconds: DurationRange
  readonly terrainPenaltySeconds: number
}

export type RouteTravelTime = {
  readonly model: 'hypothetical-terrain-eta'
  readonly scientificStatus: 'provisional'
  readonly qualification: string
  readonly profile: MobilityProfile
  readonly terrainProfile: TerrainProfile
  readonly source: TerrainModelGrid['source']
  readonly routeId: TerrainModelRoute['id']
  readonly routeModel: TerrainModelRoute['model']
  readonly nodes: readonly number[]
  readonly horizontalDistanceM: number
  readonly segments: readonly TravelTimeSegment[]
  readonly travelDurationSeconds: number
  readonly nominalDurationSeconds: number
  readonly terrainPenaltySeconds: number
  readonly plannedDelaySeconds: number
  readonly totalDurationSeconds: number
  /** Segment speed scenarios summed with the same explicit planned delay. */
  readonly durationRangeSeconds: DurationRange
  readonly departureUtc: string | null
  readonly arrivalUtc: string | null
  readonly arrivalRangeUtc: { readonly lower: string; readonly upper: string } | null
  /** Movement distance / movement duration; excludes the planned hold. */
  readonly averageSpeedMps: number | null
  readonly minSegmentSpeedMps: number | null
  readonly maxSegmentSpeedMps: number | null
  readonly slowestSegmentIndex: number | null
  readonly unknownSegments: number
}

export type TravelTimeResult = { readonly status: 'available'; readonly value: RouteTravelTime } | { readonly status: 'unavailable'; readonly reason: string }

const COMMON_ASSUMPTIONS = {
  uphillSensitivity: 3, downhillSensitivity: 1, gradientSensitivity: 1,
  roughnessSensitivity: 2, highCostPenalty: 0.5, speedUncertaintyFraction: 0.3,
} as const

export const MOBILITY_PROFILES: readonly MobilityProfile[] = [
  { id: 'hypothetical-survey', name: 'Hypothetical survey vehicle', nominalSpeedMps: 0.1, minSpeedMps: 0.02, maxSpeedMps: 0.2, unknownSpeedMps: 0.03, ...COMMON_ASSUMPTIONS },
  { id: 'hypothetical-transit', name: 'Hypothetical transit vehicle', nominalSpeedMps: 0.3, minSpeedMps: 0.05, maxSpeedMps: 0.5, unknownSpeedMps: 0.08, ...COMMON_ASSUMPTIONS },
]

const MOBILITY_KEYS: readonly (keyof MobilityProfile)[] = ['id', 'name', 'nominalSpeedMps', 'minSpeedMps', 'maxSpeedMps', 'uphillSensitivity', 'downhillSensitivity', 'gradientSensitivity', 'roughnessSensitivity', 'highCostPenalty', 'unknownSpeedMps', 'speedUncertaintyFraction']
const TERRAIN_KEYS: readonly (keyof TerrainProfile)[] = ['maxUphillDeg', 'maxDownhillDeg', 'maxRoughnessM', 'roughnessRadiusM', 'highCostFraction', 'uphillWeight', 'downhillWeight', 'slopeWeight', 'roughnessWeight', 'unknownPolicy', 'unknownCostMultiplier']
const SOURCE_KEYS: readonly (keyof TerrainModelGrid['source'])[] = ['productId', 'gridHash', 'sourceHash', 'verticalReference', 'attribution', 'qualification', 'authorization']

export function validateMobilityProfile(profile: MobilityProfile): void {
  if (!profile || typeof profile !== 'object' || Object.keys(profile).some(key => !MOBILITY_KEYS.includes(key as keyof MobilityProfile))) throw new Error('A supported hypothetical mobility profile is required; unsupported performance or safety claims are not accepted.')
  if (!['hypothetical-survey', 'hypothetical-transit', 'hypothetical-custom'].includes(profile.id) || typeof profile.name !== 'string' || !/^Hypothetical\b/i.test(profile.name) || /NASA|Perseverance|Curiosity|official|certified|survival|validated/i.test(profile.name)) throw new Error('Mobility profiles must retain a hypothetical identity and cannot claim real NASA vehicle specifications or safety validation.')
  if (![profile.nominalSpeedMps, profile.minSpeedMps, profile.maxSpeedMps, profile.unknownSpeedMps].every(value => Number.isFinite(value) && value > 0)) throw new Error('Mobility speeds must be finite positive metres per second.')
  if (profile.minSpeedMps > profile.nominalSpeedMps || profile.nominalSpeedMps > profile.maxSpeedMps || profile.unknownSpeedMps < profile.minSpeedMps || profile.unknownSpeedMps > profile.nominalSpeedMps) throw new Error('Minimum, nominal and maximum speeds must be ordered; unknown terrain speed must be between minimum and nominal speed.')
  for (const key of ['uphillSensitivity', 'downhillSensitivity', 'gradientSensitivity', 'roughnessSensitivity', 'highCostPenalty'] as const) {
    if (!Number.isFinite(profile[key]) || profile[key] < 0) throw new Error('Terrain speed sensitivities and penalties must be finite and nonnegative.')
  }
  if (!Number.isFinite(profile.speedUncertaintyFraction) || profile.speedUncertaintyFraction < 0 || profile.speedUncertaintyFraction >= 1) throw new Error('Speed scenario fraction must be at least zero and less than one.')
}

/** A datetime-local value is interpreted explicitly as UTC, independent of device timezone. */
export function parseDepartureUtc(value: string): string | null {
  if (value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Departure must be a calendar date and time in UTC, in YYYY-MM-DDTHH:mm format.')
  const canonical = `${value}:00.000Z`
  const timestamp = Date.parse(canonical)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== canonical) throw new Error('Departure contains an invalid UTC calendar date or time.')
  return canonical
}

function canonicalDeparture(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new Error('ETA departure must be canonical UTC; use the UTC departure parser.')
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) throw new Error('ETA departure contains an invalid UTC calendar date or time.')
  return value
}

function arrival(departureUtc: string, seconds: number): string {
  // Round duration to the nearest millisecond, avoiding truncation of sphere-arc noise.
  const timestamp = Date.parse(departureUtc) + Math.round(seconds * 1000)
  if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8.64e15) throw new Error('Estimated arrival exceeds the supported UTC calendar range.')
  return new Date(timestamp).toISOString()
}

function consistent(actual: number, expected: number): boolean {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-10)
}

function routeStatistic(actual: number | null, expected: number | null): boolean {
  return expected === null ? actual === null : actual !== null && consistent(actual, expected)
}

/**
 * Times the supplied reconstructed route. It neither searches for another route
 * nor treats hypothetical cost-equivalent metres as seconds. Known edge speed:
 * nominal / (1 + normalized uphill, downhill, gradient, roughness and high-cost
 * penalties), bounded by profile speeds. UNKNOWN uses the explicit assumption.
 * Existing terrain/profile/source gates are rechecked for every admitted edge.
 */
export function estimateRouteTravelTime(analysis: TerrainAnalysis, route: TerrainModelRoute, profile: MobilityProfile, options: { departureUtc?: string | null; plannedDelaySeconds?: number } = {}): TravelTimeResult {
  try {
    validateMobilityProfile(profile)
    if (!analysis || typeof analysis !== 'object') throw new Error('A supported numerical terrain analysis is required for terrain-dependent ETA.')
    const { grid, profile: terrain } = analysis
    validateTerrainModelGrid(grid)
    validateTerrainProfile(terrain)
    const count = grid.rows * grid.columns
    for (const raster of [analysis.slopeDeg, analysis.roughnessM, analysis.reliefM, analysis.shapeM]) {
      if (!(raster instanceof Float32Array) || raster.length !== count) throw new Error('Terrain metric rasters must match the native DEM grid.')
    }
    if (!(analysis.states instanceof Uint8Array) || analysis.states.length !== count || analysis.states.some(state => state > 3)) throw new Error('Terrain classifications must match the native DEM grid.')
    if (!route || typeof route !== 'object' || !['distance', 'terrain'].includes(route.id) || route.model !== (route.id === 'terrain' ? 'hypothetical-dem-terrain' : 'hypothetical-dem-distance') || route.costUnit !== 'cost-equivalent-m') throw new Error('ETA requires an existing reconstructed route from the qualified DEM model.')
    if (route.scientificStatus !== 'physical-terrain-unverified' || route.qualification !== `Hypothetical DEM-based model. Physical traversability and human safety are not validated. ${grid.source.qualification}`) throw new Error('The route must preserve its physical-terrain and safety qualifications.')
    if (!route.source || SOURCE_KEYS.some(key => route.source[key] !== grid.source[key]) || !route.profile || TERRAIN_KEYS.some(key => route.profile[key] !== terrain[key])) throw new Error('Route source and terrain assumptions must match the supplied analysis.')
    if (!Array.isArray(route.nodes) || !route.nodes.length || !Array.isArray(route.points) || route.nodes.length !== route.points.length) throw new Error('A reconstructed route must retain all native nodes and geographic points.')
    const plannedDelaySeconds = options.plannedDelaySeconds ?? 0
    if (!Number.isFinite(plannedDelaySeconds) || plannedDelaySeconds < 0) throw new Error('Explicit planned delay must be finite, nonnegative seconds.')
    const departureUtc = canonicalDeparture(options.departureUtc)

    const validateCell = (node: number) => {
      if (!Number.isSafeInteger(node) || node < 0 || node >= count || grid.valid[node] !== 1 || !Number.isFinite(grid.values[node])) throw new Error('ETA cannot cross missing height samples or cells outside native coverage.')
      const gradient = analysis.slopeDeg[node]
      const roughness = analysis.roughnessM[node]
      if ((!Number.isNaN(gradient) && (!Number.isFinite(gradient) || gradient < 0 || gradient >= 90)) || (!Number.isNaN(roughness) && (!Number.isFinite(roughness) || roughness < 0))) throw new Error('Terrain speed metrics must be finite nonnegative supported values or explicitly unknown.')
      if (analysis.states[node] === 3 || gradient > Math.max(terrain.maxUphillDeg, terrain.maxDownhillDeg) || roughness > terrain.maxRoughnessM) throw new Error('ETA cannot traverse cells excluded by the selected terrain assumptions.')
      if (analysis.states[node] === 0 && terrain.unknownPolicy !== 'penalize') throw new Error('Unknown terrain is unavailable under the selected blocking policy.')
      if (analysis.states[node] !== 0 && (!Number.isFinite(gradient) || !Number.isFinite(roughness))) throw new Error('Known terrain classifications require supported local gradient and roughness metrics.')
    }
    for (let index = 0; index < route.nodes.length; index++) {
      const node = route.nodes[index]
      validateCell(node)
      const point = route.points[index]
      const expected = modelPoint(grid, node)
      if (!point || ['row', 'column', 'lon', 'lat'].some(key => point[key as keyof RoutePoint] !== expected[key as keyof RoutePoint])) throw new Error('Reconstructed route coordinates must match their native DEM cell identities.')
    }

    const segments: TravelTimeSegment[] = []
    let horizontalDistanceM = 0
    let accumulatedCostM = 0
    let unknownSegments = 0
    const grades: number[] = []
    for (let index = 0; index < route.nodes.length - 1; index++) {
      const from = route.nodes[index]
      const to = route.nodes[index + 1]
      const fromRow = Math.floor(from / grid.columns)
      const toRow = Math.floor(to / grid.columns)
      const fromColumn = from % grid.columns
      const toColumn = to % grid.columns
      if (Math.abs(fromRow - toRow) === 1 && Math.abs(fromColumn - toColumn) === 1) {
        validateCell(fromRow * grid.columns + toColumn)
        validateCell(toRow * grid.columns + fromColumn)
      }
      const movement = terrainMovement(analysis, from, to)
      if (movement.classification === 'BLOCKED' || movement.costM === null || !Number.isFinite(movement.costM) || !Number.isFinite(movement.distanceM) || movement.distanceM <= 0 || movement.costM < movement.distanceM) throw new Error(movement.reason ?? 'A reconstructed route contains an excluded or invalid terrain movement.')
      const unknown = movement.classification === 'UNKNOWN'
      if (unknown && terrain.unknownPolicy !== 'penalize') throw new Error('Unknown terrain ETA requires the explicit permissive terrain policy.')
      const gradientDeg = unknown ? null : Math.max(analysis.slopeDeg[from], analysis.slopeDeg[to])
      const roughnessM = unknown ? null : Math.max(analysis.roughnessM[from], analysis.roughnessM[to])
      const gradeDeg = unknown ? null : movement.gradeDeg
      if (!unknown && (gradeDeg === null || !Number.isFinite(gradeDeg))) throw new Error('A known terrain segment requires a finite directional grade.')
      const penalty = unknown ? 0 : profile.uphillSensitivity * Math.max(0, gradeDeg!) / terrain.maxUphillDeg
        + profile.downhillSensitivity * Math.max(0, -gradeDeg!) / terrain.maxDownhillDeg
        + profile.gradientSensitivity * gradientDeg! / Math.max(terrain.maxUphillDeg, terrain.maxDownhillDeg)
        + profile.roughnessSensitivity * roughnessM! / terrain.maxRoughnessM
        + (movement.classification === 'HIGH_COST' ? profile.highCostPenalty : 0)
      if (!Number.isFinite(penalty) || penalty < 0) throw new Error('Terrain speed penalty arithmetic is outside the supported finite range.')
      const speed = unknown ? profile.unknownSpeedMps : Math.max(profile.minSpeedMps, Math.min(profile.maxSpeedMps, profile.nominalSpeedMps / (1 + penalty)))
      const durationSeconds = movement.distanceM / speed
      const durationRangeSeconds = {
        lower: movement.distanceM / Math.min(profile.maxSpeedMps, speed * (1 + profile.speedUncertaintyFraction)),
        upper: movement.distanceM / Math.max(profile.minSpeedMps, speed * (1 - profile.speedUncertaintyFraction)),
      }
      if (![durationSeconds, durationRangeSeconds.lower, durationRangeSeconds.upper].every(Number.isFinite)) throw new Error('Segment duration arithmetic is outside the supported finite range.')
      segments.push({ index, from: { ...route.points[index] }, to: { ...route.points[index + 1] }, distanceM: movement.distanceM, classification: movement.classification,
        gradeDeg, gradientDeg, roughnessM, effectiveSpeedMps: speed, durationSeconds, durationRangeSeconds,
        terrainPenaltySeconds: Math.max(0, durationSeconds - movement.distanceM / profile.nominalSpeedMps) })
      horizontalDistanceM += movement.distanceM
      accumulatedCostM += movement.costM
      if (unknown) unknownSegments++
      else grades.push(Math.abs(gradeDeg!))
    }
    if (!consistent(route.horizontalDistanceM, horizontalDistanceM) || !consistent(route.accumulatedCostM, accumulatedCostM) || route.unknownSegments !== unknownSegments) throw new Error('Reconstructed route distance, cost or unknown count does not match its actual permitted segments.')
    const maximum = (values: readonly number[]) => values.reduce((largest, value) => Math.max(largest, value), 0)
    const mean = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
    const gradients = route.nodes.map(node => analysis.slopeDeg[node])
    const roughness = route.nodes.map(node => analysis.roughnessM[node])
    const metrics: readonly [number | null, number | null][] = [
      [route.maxGradeDeg, unknownSegments ? null : maximum(grades)], [route.meanAbsGradeDeg, unknownSegments ? null : mean(grades)],
      [route.maxSlopeDeg, gradients.every(Number.isFinite) ? maximum(gradients) : null], [route.meanSlopeDeg, gradients.every(Number.isFinite) ? mean(gradients) : null],
      [route.maxRoughnessM, roughness.every(Number.isFinite) ? maximum(roughness) : null], [route.meanRoughnessM, roughness.every(Number.isFinite) ? mean(roughness) : null],
    ]
    if (metrics.some(([actual, expected]) => !routeStatistic(actual, expected))) throw new Error('Reconstructed route terrain metrics no longer match the supplied analysis.')

    const travelDurationSeconds = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0)
    const nominalDurationSeconds = horizontalDistanceM / profile.nominalSpeedMps
    const terrainPenaltySeconds = segments.reduce((sum, segment) => sum + segment.terrainPenaltySeconds, 0)
    const totalDurationSeconds = travelDurationSeconds + plannedDelaySeconds
    const durationRangeSeconds = {
      lower: segments.reduce((sum, segment) => sum + segment.durationRangeSeconds.lower, plannedDelaySeconds),
      upper: segments.reduce((sum, segment) => sum + segment.durationRangeSeconds.upper, plannedDelaySeconds),
    }
    if (![horizontalDistanceM, accumulatedCostM, travelDurationSeconds, nominalDurationSeconds, terrainPenaltySeconds, totalDurationSeconds, durationRangeSeconds.lower, durationRangeSeconds.upper].every(Number.isFinite)) throw new Error('Accumulated ETA arithmetic is outside the supported finite range.')
    let slowestSegmentIndex: number | null = null
    for (const segment of segments) if (slowestSegmentIndex === null || segment.durationSeconds > segments[slowestSegmentIndex].durationSeconds) slowestSegmentIndex = segment.index
    const speeds = segments.map(segment => segment.effectiveSpeedMps)
    return { status: 'available', value: {
      model: 'hypothetical-terrain-eta', scientificStatus: 'provisional',
      qualification: `Hypothetical terrain-dependent estimate, not measured rover performance; not a NASA mission prediction. Physical traversability and human safety are not validated. The speed-scenario range is a user assumption, not an empirical confidence interval. Only explicit planned delay is included; environmental and operational delays are not inferred. ${grid.source.qualification}${unknownSegments ? ` Includes ${unknownSegments} UNKNOWN terrain segments at the configured assumed speed; terrain support and the estimate remain incomplete.` : ''}`,
      profile: { ...profile }, terrainProfile: { ...terrain }, source: { ...grid.source }, routeId: route.id, routeModel: route.model, nodes: [...route.nodes],
      horizontalDistanceM, segments, travelDurationSeconds, nominalDurationSeconds, terrainPenaltySeconds, plannedDelaySeconds, totalDurationSeconds, durationRangeSeconds,
      departureUtc, arrivalUtc: departureUtc === null ? null : arrival(departureUtc, totalDurationSeconds),
      arrivalRangeUtc: departureUtc === null ? null : { lower: arrival(departureUtc, durationRangeSeconds.lower), upper: arrival(departureUtc, durationRangeSeconds.upper) },
      averageSpeedMps: travelDurationSeconds > 0 ? horizontalDistanceM / travelDurationSeconds : null,
      minSegmentSpeedMps: speeds.length ? speeds.reduce((minimum, speed) => Math.min(minimum, speed), Infinity) : null,
      maxSegmentSpeedMps: speeds.length ? maximum(speeds) : null, slowestSegmentIndex, unknownSegments,
    } }
  } catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : 'Terrain-dependent ETA is unavailable for these inputs.' }
  }
}
