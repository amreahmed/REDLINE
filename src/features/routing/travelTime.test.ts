/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { TerrainAnalysis, TerrainModelGrid, TerrainProfile } from '../terrain/modelTypes'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE, modelDistance, modelPoint } from '../terrain/terrainModel'
import { decodeHrscModel, parseHrscModelManifest } from '../terrain/hrscModel'
import { calculateTerrainComparison } from './terrainRoutes'
import type { TerrainModelRoute } from './terrainRoutes'
import { estimateRouteTravelTime, MOBILITY_PROFILES, parseDepartureUtc, validateMobilityProfile } from './travelTime'
import type { MobilityProfile, RouteTravelTime } from './travelTime'

function fixture(height: (row: number, column: number) => number = () => 0): TerrainModelGrid {
  return { rows: 9, columns: 11, startRow: 100, startColumn: 200, originXM: -55, originYM: 45, pixelWidthM: 10, pixelHeightM: -10, referenceRadiusM: 3396000,
    values: Float32Array.from({ length: 99 }, (_, node) => height(Math.floor(node / 11), node % 11)), valid: new Uint8Array(99).fill(1),
    source: { productId: 'synthetic-eta-test', gridHash: 'synthetic-grid', sourceHash: 'synthetic-source', verticalReference: 'Synthetic heights', attribution: 'Synthetic test fixture', qualification: 'Synthetic, not Mars data', authorization: 'synthetic-test' } }
}
const terrainProfile: TerrainProfile = { ...DEFAULT_TERRAIN_PROFILE, maxUphillDeg: 45, maxDownhillDeg: 45, maxRoughnessM: 100, roughnessRadiusM: 11 }
const vehicle: MobilityProfile = { ...MOBILITY_PROFILES[0], nominalSpeedMps: 1, minSpeedMps: 0.1, maxSpeedMps: 2, unknownSpeedMps: 0.2 }
const node = (row: number, column: number) => row * 11 + column
function route(analysis: TerrainAnalysis, origin = node(4, 2), destination = node(4, 8)): TerrainModelRoute {
  const routes = calculateTerrainComparison(analysis, origin, destination)
  if (routes.status !== 'available') throw new Error(routes.reason)
  return routes.value.distance
}
function eta(analysis: TerrainAnalysis, path = route(analysis), profile = vehicle, options: { departureUtc?: string | null; plannedDelaySeconds?: number } = {}): RouteTravelTime {
  const result = estimateRouteTravelTime(analysis, path, profile, options)
  if (result.status !== 'available') throw new Error(result.reason)
  return result.value
}

describe('provisional terrain travel time', () => {
  it('sums actual reconstructed flat segments at nominal speed, not endpoint distance or cost', () => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    const path = route(analysis)
    const estimate = eta(analysis, path)
    expect(estimate.segments).toHaveLength(path.nodes.length - 1)
    expect(estimate.nodes).toEqual(path.nodes)
    expect(estimate.travelDurationSeconds).toBeCloseTo(path.horizontalDistanceM / vehicle.nominalSpeedMps, 8)
    expect(estimate.terrainPenaltySeconds).toBeCloseTo(0, 9)
    expect(estimate.segments.every(segment => segment.effectiveSpeedMps === vehicle.nominalSpeedMps)).toBe(true)
    expect(estimate.averageSpeedMps).toBeCloseTo(1, 10)
    expect(estimate.minSegmentSpeedMps).toBe(1)
    expect(estimate.maxSegmentSpeedMps).toBe(1)
    expect(estimate.arrivalUtc).toBeNull()
    expect(estimate.scientificStatus).toBe('provisional')
    expect(estimate.qualification).toContain('not measured rover performance')
  })

  it('times a bent waypoint route using both actual A* reconstructions rather than the endpoint arc', () => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    const origin = node(4, 2)
    const destination = node(4, 8)
    const waypoint = node(2, 5)
    const compared = calculateTerrainComparison(analysis, origin, destination, waypoint)
    if (compared.status !== 'available') throw new Error(compared.reason)
    const directDistanceM = modelDistance(analysis.grid, origin, destination)
    for (const path of [compared.value.distance, compared.value.terrain]) {
      const estimate = eta(analysis, path)
      expect(path.horizontalDistanceM).toBeGreaterThan(directDistanceM + 10)
      expect(estimate.nodes).toEqual(path.nodes)
      expect(estimate.nodes).toContain(waypoint)
      expect(estimate.travelDurationSeconds).toBeCloseTo(estimate.segments.reduce((sum, segment) => sum + segment.distanceM / vehicle.nominalSpeedMps, 0), 9)
      expect(estimate.travelDurationSeconds).toBeGreaterThan(directDistanceM / vehicle.nominalSpeedMps + 10)
    }
  })

  it('reduces speed on uphill and downhill movements without treating downhill as a bonus', () => {
    const analysis = analyzeTerrainModel(fixture((_row, column) => column * 0.5), terrainProfile)
    const up = eta(analysis)
    const down = eta(analysis, route(analysis, node(4, 8), node(4, 2)))
    expect(up.travelDurationSeconds).toBeGreaterThan(up.nominalDurationSeconds)
    expect(down.travelDurationSeconds).toBeGreaterThan(down.nominalDurationSeconds)
    expect(up.travelDurationSeconds).toBeGreaterThan(down.travelDurationSeconds)
    expect(up.segments.every(segment => segment.gradeDeg! > 0)).toBe(true)
    expect(down.segments.every(segment => segment.gradeDeg! < 0)).toBe(true)
  })

  it('includes local gradient independently of a flat directional edge grade', () => {
    const analysis = analyzeTerrainModel(fixture(row => row * 0.5), terrainProfile)
    const estimate = eta(analysis)
    expect(estimate.segments.every(segment => segment.gradeDeg === 0 && segment.gradientDeg! > 0)).toBe(true)
    expect(estimate.travelDurationSeconds).toBeGreaterThan(estimate.nominalDurationSeconds)
    const without = eta(analysis, route(analysis), { ...vehicle, gradientSensitivity: 0, roughnessSensitivity: 0 })
    expect(without.travelDurationSeconds).toBeCloseTo(without.nominalDurationSeconds, 9)
  })

  it('responds to roughness sensitivity and different hypothetical vehicles', () => {
    const analysis = analyzeTerrainModel(fixture((row, column) => (row + column) % 2 ? 0.5 : -0.5), terrainProfile)
    const noRoughness = eta(analysis, route(analysis), { ...vehicle, roughnessSensitivity: 0 })
    const highRoughness = eta(analysis, route(analysis), { ...vehicle, roughnessSensitivity: 20 })
    expect(highRoughness.travelDurationSeconds).toBeGreaterThan(noRoughness.travelDurationSeconds)
    const survey = eta(analysis, route(analysis), MOBILITY_PROFILES[0])
    const transit = eta(analysis, route(analysis), MOBILITY_PROFILES[1])
    expect(survey.travelDurationSeconds).toBeGreaterThan(transit.travelDurationSeconds)
    expect(survey.profile.name).toContain('Hypothetical')
  })

  it('applies an explicit high-cost slowdown and respects continuous speed bounds', () => {
    const analysis = analyzeTerrainModel(fixture((_row, column) => column * 0.5), { ...terrainProfile, highCostFraction: 0.001 + 0.01 })
    const path = route(analysis)
    const without = eta(analysis, path, { ...vehicle, highCostPenalty: 0 })
    const withPenalty = eta(analysis, path, { ...vehicle, highCostPenalty: 10 })
    expect(withPenalty.travelDurationSeconds).toBeGreaterThan(without.travelDurationSeconds)
    expect(withPenalty.segments.every(segment => segment.effectiveSpeedMps >= vehicle.minSpeedMps && segment.effectiveSpeedMps <= vehicle.maxSpeedMps)).toBe(true)
  })

  it('calculates every segment duration and bound, then adds only the explicit planned delay', () => {
    const analysis = analyzeTerrainModel(fixture((_row, column) => column * 0.5), terrainProfile)
    const estimate = eta(analysis, route(analysis), vehicle, { plannedDelaySeconds: 600 })
    expect(estimate.travelDurationSeconds).toBeCloseTo(estimate.segments.reduce((sum, segment) => sum + segment.durationSeconds, 0), 10)
    expect(estimate.totalDurationSeconds).toBeCloseTo(estimate.travelDurationSeconds + 600, 10)
    expect(estimate.durationRangeSeconds.lower).toBeCloseTo(estimate.segments.reduce((sum, segment) => sum + segment.durationRangeSeconds.lower, 600), 10)
    expect(estimate.durationRangeSeconds.upper).toBeCloseTo(estimate.segments.reduce((sum, segment) => sum + segment.durationRangeSeconds.upper, 600), 10)
    expect(estimate.durationRangeSeconds.lower).toBeLessThan(estimate.totalDurationSeconds)
    expect(estimate.durationRangeSeconds.upper).toBeGreaterThan(estimate.totalDurationSeconds)
    for (const segment of estimate.segments) expect(segment.durationSeconds).toBeCloseTo(segment.distanceM / segment.effectiveSpeedMps, 12)
  })

  it('recalculates route timing and UTC arrival without recalculating geometry', () => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    const path = route(analysis)
    const departure = parseDepartureUtc('2026-11-15T12:00')
    const first = eta(analysis, path, vehicle, { departureUtc: departure })
    const later = eta(analysis, path, vehicle, { departureUtc: parseDepartureUtc('2026-11-15T13:00') })
    expect(Date.parse(later.arrivalUtc!) - Date.parse(first.arrivalUtc!)).toBe(3600_000)
    expect(later.travelDurationSeconds).toBe(first.travelDurationSeconds)
    expect(later.nodes).toEqual(first.nodes)
    expect(first.arrivalUtc).toBe('2026-11-15T12:01:00.000Z')
    const shorter = eta(analysis, route(analysis, node(4, 2), node(4, 5)), vehicle, { departureUtc: departure })
    expect(shorter.travelDurationSeconds).toBeLessThan(first.travelDurationSeconds)
  })

  it('models a stationary single valid cell as zero movement, with no invented speed', () => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    const path = route(analysis)
    const origin = path.nodes[0]
    const stationary: TerrainModelRoute = { ...path, nodes: [origin], points: [modelPoint(analysis.grid, origin)], exploredNodes: [origin], horizontalDistanceM: 0, accumulatedCostM: 0, maxGradeDeg: 0, meanAbsGradeDeg: 0, maxSlopeDeg: 0, meanSlopeDeg: 0, maxRoughnessM: 0, meanRoughnessM: 0, unknownSegments: 0 }
    const estimate = eta(analysis, stationary)
    expect(estimate.totalDurationSeconds).toBe(0)
    expect(estimate.segments).toEqual([])
    expect(estimate.averageSpeedMps).toBeNull()
    expect(estimate.minSegmentSpeedMps).toBeNull()
    expect(estimate.maxSegmentSpeedMps).toBeNull()
    expect(estimate.slowestSegmentIndex).toBeNull()
  })

  it('adds an explicit stationary delay without fabricating movement or a speed', () => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    const path = route(analysis)
    const origin = path.nodes[0]
    const stationary: TerrainModelRoute = { ...path, nodes: [origin], points: [modelPoint(analysis.grid, origin)], exploredNodes: [origin], horizontalDistanceM: 0, accumulatedCostM: 0, maxGradeDeg: 0, meanAbsGradeDeg: 0, maxSlopeDeg: 0, meanSlopeDeg: 0, maxRoughnessM: 0, meanRoughnessM: 0, unknownSegments: 0 }
    const estimate = eta(analysis, stationary, vehicle, { departureUtc: parseDepartureUtc('2026-11-15T12:00'), plannedDelaySeconds: 120 })
    expect(estimate.travelDurationSeconds).toBe(0)
    expect(estimate.totalDurationSeconds).toBe(120)
    expect(estimate.averageSpeedMps).toBeNull()
    expect(estimate.durationRangeSeconds).toEqual({ lower: 120, upper: 120 })
    expect(estimate.arrivalUtc).toBe('2026-11-15T12:02:00.000Z')
    for (const kind of ['blocked', 'missing', 'known-limit'] as const) {
      const changed = analyzeTerrainModel(fixture(), terrainProfile)
      if (kind === 'blocked') changed.states[origin] = 3
      if (kind === 'missing') changed.grid.valid[origin] = 0
      if (kind === 'known-limit') changed.slopeDeg[origin] = 50
      expect(estimateRouteTravelTime(changed, stationary, vehicle).status).toBe('unavailable')
    }
  })

  it('bounds scenarios at the configured speed limits and excludes holds from mean movement speed', () => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    const speed = { ...vehicle, minSpeedMps: 0.9, unknownSpeedMps: 0.9, maxSpeedMps: 1.1, speedUncertaintyFraction: 0.9 }
    const estimate = eta(analysis, route(analysis), speed, { plannedDelaySeconds: 3600 })
    expect(estimate.averageSpeedMps).toBeCloseTo(1, 10)
    expect(estimate.durationRangeSeconds.lower).toBeCloseTo(estimate.horizontalDistanceM / 1.1 + 3600, 9)
    expect(estimate.durationRangeSeconds.upper).toBeCloseTo(estimate.horizontalDistanceM / 0.9 + 3600, 9)
    const exact = eta(analysis, route(analysis), { ...vehicle, speedUncertaintyFraction: 0 })
    expect(exact.durationRangeSeconds.lower).toBe(exact.travelDurationSeconds)
    expect(exact.durationRangeSeconds.upper).toBe(exact.travelDurationSeconds)
  })

  it.each([
    { nominalSpeedMps: 0 }, { nominalSpeedMps: NaN }, { minSpeedMps: -1 }, { maxSpeedMps: Infinity },
    { minSpeedMps: 2 }, { maxSpeedMps: 0.5 }, { unknownSpeedMps: 2 }, { unknownSpeedMps: 0 },
    { uphillSensitivity: -1 }, { roughnessSensitivity: Infinity }, { speedUncertaintyFraction: 1 },
    { name: 'Perseverance official specification' }, { id: 'nasa-rover' }, { survivalProbability: 1 },
  ])('rejects invalid or misrepresented mobility assumptions %j', patch => {
    expect(() => validateMobilityProfile({ ...vehicle, ...patch } as MobilityProfile)).toThrow()
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    expect(estimateRouteTravelTime(analysis, route(analysis), { ...vehicle, ...patch } as MobilityProfile).status).toBe('unavailable')
  })

  it('refuses blocked, missing and unsupported diagonal route segments', () => {
    for (const kind of ['blocked', 'missing', 'corner'] as const) {
      const analysis = analyzeTerrainModel(fixture(), terrainProfile)
      const path = route(analysis)
      if (kind === 'blocked') analysis.states[path.nodes[2]] = 3
      if (kind === 'missing') analysis.grid.valid[path.nodes[2]] = 0
      const chosen = kind === 'corner' ? route(analysis, node(4, 2), node(5, 3)) : path
      if (kind === 'corner') analysis.states[node(4, 3)] = 3
      expect(estimateRouteTravelTime(analysis, chosen, vehicle).status).toBe('unavailable')
    }
  })

  it('retains unknown terrain metrics only under the explicit permissive policy', () => {
    const analysis = analyzeTerrainModel(fixture(), { ...terrainProfile, unknownPolicy: 'penalize' })
    const path = route(analysis, node(0, 2), node(4, 8))
    const estimate = eta(analysis, path)
    expect(estimate.unknownSegments).toBeGreaterThan(0)
    const unknown = estimate.segments.filter(segment => segment.classification === 'UNKNOWN')
    expect(unknown.every(segment => segment.gradeDeg === null && segment.gradientDeg === null && segment.roughnessM === null && segment.effectiveSpeedMps === vehicle.unknownSpeedMps)).toBe(true)
    const strict = { ...analysis, profile: { ...analysis.profile, unknownPolicy: 'block' as const } }
    expect(estimateRouteTravelTime(strict, { ...path, profile: strict.profile }, vehicle).status).toBe('unavailable')
    analysis.grid.valid[path.nodes[0]] = 0
    expect(estimateRouteTravelTime(analysis, path, vehicle).status).toBe('unavailable')
  })

  it.each([
    { horizontalDistanceM: 1 }, { accumulatedCostM: 1 }, { model: 'hypothetical-distance-only' },
    { scientificStatus: 'verified' }, { qualification: 'Scientifically validated and safe' },
  ])('rejects an inconsistent or relabelled route %j', patch => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    expect(estimateRouteTravelTime(analysis, { ...route(analysis), ...patch } as TerrainModelRoute, vehicle).status).toBe('unavailable')
  })

  it('rejects source/profile/coordinate mismatches instead of estimating another path', () => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    const path = route(analysis)
    for (const changed of [
      { ...path, source: { ...path.source, gridHash: 'wrong' } },
      { ...path, profile: { ...path.profile, maxUphillDeg: 40 } },
      { ...path, points: path.points.map((point, index) => index === 2 ? { ...point, lon: point.lon + 0.1 } : point) },
      { ...path, nodes: [path.nodes[0], path.nodes.at(-1)!], points: [path.points[0], path.points.at(-1)!] },
    ]) expect(estimateRouteTravelTime(analysis, changed, vehicle).status).toBe('unavailable')
  })

  it('rejects malformed rasters and invalid local metrics rather than timing a low-cost fallback', () => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    const path = route(analysis)
    for (const changed of [
      { ...analysis, slopeDeg: new Float32Array(98) },
      { ...analysis, roughnessM: Array.from(analysis.roughnessM) },
      { ...analysis, states: new Uint8Array(98) },
      { ...analysis, states: new Uint8Array(99).fill(4) },
    ]) expect(estimateRouteTravelTime(changed as TerrainAnalysis, path, vehicle).status).toBe('unavailable')
    for (const metric of ['slopeDeg', 'roughnessM'] as const) {
      for (const value of [-1, Infinity, NaN]) {
        const changed = analyzeTerrainModel(fixture(), terrainProfile)
        changed[metric][path.nodes[1]] = value
        expect(estimateRouteTravelTime(changed, path, vehicle).status).toBe('unavailable')
      }
    }
    expect(estimateRouteTravelTime(analysis, { ...path, id: 'terrain' }, vehicle).status).toBe('unavailable')
    expect(estimateRouteTravelTime(analysis, { ...path, maxSlopeDeg: 1 }, vehicle).status).toBe('unavailable')
    expect(estimateRouteTravelTime({ ...analysis, grid: { ...analysis.grid, source: { ...analysis.grid.source, productId: 'CTX' } } }, path, vehicle).status).toBe('unavailable')
  })

  it('rejects calendar and duration overflow instead of returning an invalid arrival', () => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    const path = route(analysis)
    for (const departureUtc of ['2026-02-30T00:00:00.000Z', '2026-11-15T24:00:00.000Z', '2026-11-15T12:00:00+02:00', '2026-11-15T12:00:00.000Z trailing']) {
      expect(estimateRouteTravelTime(analysis, path, vehicle, { departureUtc }).status).toBe('unavailable')
    }
    expect(estimateRouteTravelTime(analysis, path, vehicle, { departureUtc: parseDepartureUtc('2026-11-15T12:00'), plannedDelaySeconds: 1e16 }).status).toBe('unavailable')
    expect(estimateRouteTravelTime(analysis, path, { ...vehicle, nominalSpeedMps: Number.MIN_VALUE, minSpeedMps: Number.MIN_VALUE, maxSpeedMps: Number.MIN_VALUE, unknownSpeedMps: Number.MIN_VALUE }).status).toBe('unavailable')
  })

  it.each([-1, NaN, Infinity])('rejects unsupported delay %j', plannedDelaySeconds => {
    const analysis = analyzeTerrainModel(fixture(), terrainProfile)
    expect(estimateRouteTravelTime(analysis, route(analysis), vehicle, { plannedDelaySeconds }).status).toBe('unavailable')
  })

  it('identifies the actual most time-consuming segment', () => {
    const analysis = analyzeTerrainModel(fixture((_row, column) => column < 5 ? 0 : (column - 4) * 0.5), terrainProfile)
    const estimate = eta(analysis)
    expect(estimate.slowestSegmentIndex).not.toBeNull()
    expect(estimate.segments[estimate.slowestSegmentIndex!].durationSeconds).toBe(Math.max(...estimate.segments.map(segment => segment.durationSeconds)))
  })

  it('estimates both actual HRSC reconstructed routes without changing source cells or geometry', () => {
    const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.i16', import.meta.url)))
    const mask = Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.u8', import.meta.url)))
    const manifest = parseHrscModelManifest(JSON.parse(readFileSync(new URL('../../../public/data/hrsc-terrain-model.json', import.meta.url), 'utf8')))
    const grid = decodeHrscModel(manifest, binary.buffer, mask.buffer)
    const original = grid.values.slice()
    const analysis = analyzeTerrainModel(grid, DEFAULT_TERRAIN_PROFILE)
    const result = calculateTerrainComparison(analysis, 30 * 103 + 30, 70 * 103 + 70)
    if (result.status !== 'available') throw new Error(result.reason)
    for (const path of [result.value.distance, result.value.terrain]) {
      const estimate = eta(analysis, path, MOBILITY_PROFILES[0])
      expect(estimate.source.productId).toBe('HMC_13E10_DT5')
      expect(estimate.source.qualification).toContain('remain unverified')
      expect(estimate.nodes).toEqual(path.nodes)
      expect(estimate.horizontalDistanceM).toBeCloseTo(path.horizontalDistanceM, 9)
      expect(estimate.travelDurationSeconds).toBeGreaterThan(path.horizontalDistanceM / MOBILITY_PROFILES[0].nominalSpeedMps)
      expect(estimate.segments.map(segment => segment.from)).toEqual(path.points.slice(0, -1))
      expect(estimate.segments.map(segment => segment.to)).toEqual(path.points.slice(1))
      expect(estimate.qualification).toContain('not a NASA mission prediction')
    }
    expect(grid.values).toEqual(original)
  })
})

describe('departure UTC parsing', () => {
  it('accepts empty and valid calendar UTC minutes, rejecting normalized calendar errors', () => {
    expect(parseDepartureUtc('')).toBeNull()
    expect(parseDepartureUtc('2024-02-29T23:59')).toBe('2024-02-29T23:59:00.000Z')
    expect(parseDepartureUtc('2000-02-29T00:00')).toBe('2000-02-29T00:00:00.000Z')
    for (const invalid of ['1900-02-29T00:00', '2026-02-29T12:00', '2026-04-31T00:00', '2026-00-15T12:00', '2026-13-15T12:00', '2026-11-00T12:00', '2026-11-15T24:00', '2026-11-15T12:60', '2026-11-15', '2026-11-15T12:00+02:00', 'abc']) expect(() => parseDepartureUtc(invalid)).toThrow()
  })
})
