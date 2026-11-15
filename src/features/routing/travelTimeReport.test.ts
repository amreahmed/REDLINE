/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import nativeManifest from '../../../public/data/hrsc-terrain-model.json'
import { decodeHrscModel, parseHrscModelManifest } from '../terrain/hrscModel'
import type { TerrainAnalysis, TerrainModelGrid } from '../terrain/modelTypes'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE } from '../terrain/terrainModel'
import { calculateTerrainComparison } from './terrainRoutes'
import type { TerrainComparison } from './terrainRoutes'
import { estimateRouteTravelTime, MOBILITY_PROFILES, parseDepartureUtc } from './travelTime'
import type { MobilityProfile, TravelTimeResult } from './travelTime'
import { terrainModelReport } from './terrainModelReport'
import { travelTimeReport } from './travelTimeReport'

const grid = decodeHrscModel(parseHrscModelManifest(nativeManifest),
  Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.i16', import.meta.url))).buffer,
  Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.u8', import.meta.url))).buffer)
const analysis = analyzeTerrainModel(grid, DEFAULT_TERRAIN_PROFILE)
function routes(input = analysis, origin = 30 * 103 + 30, destination = 70 * 103 + 70): TerrainComparison {
  const compared = calculateTerrainComparison(input, origin, destination)
  if (compared.status !== 'available') throw new Error(compared.reason)
  return compared.value
}
const comparison = routes()
function configuration(input: TerrainAnalysis = analysis, paths: TerrainComparison = comparison, profile: MobilityProfile = MOBILITY_PROFILES[0], departureInput = '', plannedDelayMinutes = 0) {
  const options = { departureUtc: parseDepartureUtc(departureInput), plannedDelaySeconds: plannedDelayMinutes * 60 }
  return { profile, departureInput, plannedDelayMinutes, estimates: {
    distance: estimateRouteTravelTime(input, paths.distance, profile, options),
    terrain: estimateRouteTravelTime(input, paths.terrain, profile, options),
  } }
}
function available(result: TravelTimeResult) {
  if (result.status !== 'available') throw new Error(result.reason)
  return result.value
}

/** Independent haversine from the source affine transform, without route helpers. */
function groundDistance(input: TerrainModelGrid, from: number, to: number): number {
  const position = (node: number) => [
    (input.originXM + (node % input.columns + 0.5) * input.pixelWidthM) / input.referenceRadiusM,
    (input.originYM + (Math.floor(node / input.columns) + 0.5) * input.pixelHeightM) / input.referenceRadiusM,
  ]
  const [lonA, latA] = position(from)
  const [lonB, latB] = position(to)
  const h = Math.sin((latB - latA) / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin((lonB - lonA) / 2) ** 2
  return 2 * input.referenceRadiusM * Math.asin(Math.sqrt(h))
}

describe('provisional travel time mission report', () => {
  it('serializes every segment of both native routes with exact provenance and unresolved qualifications', () => {
    const config = configuration(analysis, comparison, MOBILITY_PROFILES[0], '2026-11-15T12:00', 10)
    const exported = JSON.parse(JSON.stringify(terrainModelReport(analysis, comparison, travelTimeReport(config)))) as ReturnType<typeof terrainModelReport>
    expect(exported.scientificStatus).toBe('physical-terrain-unverified')
    expect(exported.provenance).toEqual(nativeManifest)
    expect(exported.routes).toEqual(comparison)
    const timing = exported.travelTime!
    expect(timing.scientificStatus).toBe('provisional')
    expect(timing.mobilityProfile).toEqual(MOBILITY_PROFILES[0])
    expect(timing.departureInputUtc).toBe('2026-11-15T12:00')
    expect(timing.plannedHoldMinutes).toBe(10)
    for (const role of ['distance', 'terrain'] as const) {
      const eta = available(timing.estimates![role])
      const path = comparison[role]
      expect(eta.nodes).toEqual(path.nodes)
      expect(eta.segments).toHaveLength(path.nodes.length - 1)
      expect(eta.segments.map(segment => segment.from)).toEqual(path.points.slice(0, -1))
      expect(eta.segments.map(segment => segment.to)).toEqual(path.points.slice(1))
      expect(eta.source).toEqual(grid.source)
      expect(eta.source.productId).toBe('HMC_13E10_DT5')
      expect(eta.source.gridHash).toBe(nativeManifest.encoding.sha256)
      expect(eta.source.sourceHash).toBe(nativeManifest.source.sourceHash)
      expect(eta.source.verticalReference).toBe(nativeManifest.source.verticalReference)
      expect(eta.terrainProfile).toEqual(DEFAULT_TERRAIN_PROFILE)
      expect(eta.scientificStatus).toBe('provisional')
      expect(eta.qualification).toContain('not measured rover performance')
      expect(eta.qualification).toContain('not a NASA mission prediction')
      expect(eta.qualification).toContain(grid.source.qualification)
      expect(eta.departureUtc).toBe('2026-11-15T12:00:00.000Z')
      expect(eta.arrivalUtc).not.toBeNull()
      expect(eta.plannedDelaySeconds).toBe(600)
      expect(eta.totalDurationSeconds).toBeCloseTo(eta.travelDurationSeconds + 600, 10)
      expect(eta.averageSpeedMps).toBeCloseTo(eta.horizontalDistanceM / eta.travelDurationSeconds, 10)
    }
    expect(timing.measuredRoverPerformance).toBeNull()
    expect(timing.humanExplorationModel).toBeNull()
    expect(exported.limitations).toContain(grid.source.qualification)
    expect(exported.evidence).toContain('docs/science-routing-audit.md')
  })

  it('reproduces native segment speeds and times from the actual exported speed expression', () => {
    const timing = travelTimeReport(configuration())
    expect(timing.speedModel).toMatch(/max\(0,gradeDeg\).*max\(0,-gradeDeg\)/)
    expect(timing.timingModel).toContain('Cost-equivalent metres are never converted to time')
    for (const role of ['distance', 'terrain'] as const) {
      const eta = available(timing.estimates![role])
      let duration = 0
      for (let index = 0; index < eta.segments.length; index++) {
        const segment = eta.segments[index]
        const from = eta.nodes[index], to = eta.nodes[index + 1]
        const d = groundDistance(grid, from, to)
        const variables = { ...eta.profile, ...eta.terrainProfile,
          gradeDeg: Math.atan2(grid.values[to] - grid.values[from], d) * 180 / Math.PI,
          maxEndpointGradient: Math.max(analysis.slopeDeg[from], analysis.slopeDeg[to]),
          maxEndpointRoughness: Math.max(analysis.roughnessM[from], analysis.roughnessM[to]),
          isHighCost: Number(segment.classification === 'HIGH_COST'),
        }
        // Evaluates report text independently of the model's speed implementation.
        const expression = timing.speedModel.replace(/^v\s*=\s*/, '')
        const evaluate = new Function(...Object.keys(variables), 'max', 'clamp', `"use strict"; return (${expression});`)
        const speed = Number(evaluate(...Object.values(variables), Math.max,
          (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))))
        expect(segment.distanceM).toBeCloseTo(d, 5)
        expect(segment.effectiveSpeedMps).toBeCloseTo(speed, 10)
        expect(segment.durationSeconds).toBeCloseTo(d / speed, 5)
        expect(segment.durationRangeSeconds.lower).toBeCloseTo(d / Math.min(eta.profile.maxSpeedMps, speed * (1 + eta.profile.speedUncertaintyFraction)), 5)
        expect(segment.durationRangeSeconds.upper).toBeCloseTo(d / Math.max(eta.profile.minSpeedMps, speed * (1 - eta.profile.speedUncertaintyFraction)), 5)
        duration += d / speed
      }
      expect(eta.travelDurationSeconds).toBeCloseTo(duration, 4)
    }
    expect(timing.scenarioModel).toContain('not statistical confidence intervals')
  })

  it('reports changed vehicle, departure and hold without altering route geometry, cells or costs', () => {
    const originalCells = grid.values.slice()
    const originalPaths = JSON.stringify(comparison)
    const first = travelTimeReport(configuration(analysis, comparison, MOBILITY_PROFILES[0], '2026-11-15T12:00'))
    const next = travelTimeReport(configuration(analysis, comparison, MOBILITY_PROFILES[1], '2026-11-15T13:00', 5))
    for (const role of ['distance', 'terrain'] as const) {
      const initial = available(first.estimates![role]), changed = available(next.estimates![role])
      expect(changed.travelDurationSeconds).toBeLessThan(initial.travelDurationSeconds)
      expect(changed.nodes).toEqual(initial.nodes)
      expect(changed.source).toEqual(initial.source)
      expect(changed.horizontalDistanceM).toBe(initial.horizontalDistanceM)
      expect(changed.plannedDelaySeconds).toBe(300)
      expect(changed.departureUtc).toBe('2026-11-15T13:00:00.000Z')
      expect(changed.arrivalUtc).not.toBe(initial.arrivalUtc)
      expect(changed.terrainProfile).toEqual(initial.terrainProfile)
    }
    expect(grid.values).toEqual(originalCells)
    expect(JSON.stringify(comparison)).toBe(originalPaths)
  })

  it('keeps pending estimates null and does not invent departure, route duration or performance', () => {
    const timing = travelTimeReport({ profile: MOBILITY_PROFILES[0], departureInput: '', plannedDelayMinutes: 0, estimates: null })
    const report = terrainModelReport(analysis, null, timing)
    expect(report.routes).toBeNull()
    expect(report.travelTime!.estimates).toBeNull()
    expect(report.travelTime!.departureInputUtc).toBeNull()
    expect(report.travelTime!.measuredRoverPerformance).toBeNull()
    expect(report.travelTime!.humanExplorationModel).toBeNull()
    expect(JSON.stringify(report.travelTime)).not.toContain('totalDurationSeconds')
    const noClock = available(travelTimeReport(configuration()).estimates!.terrain)
    expect(noClock.departureUtc).toBeNull()
    expect(noClock.arrivalUtc).toBeNull()
    expect(noClock.arrivalRangeUtc).toBeNull()
  })

  it('preserves unknown support, null metrics and explicit assumed speeds through JSON serialization', () => {
    const input = analyzeTerrainModel(grid, { ...DEFAULT_TERRAIN_PROFILE, unknownPolicy: 'penalize', unknownCostMultiplier: 7 })
    const paths = routes(input, 0, 2)
    const exported = JSON.parse(JSON.stringify(terrainModelReport(input, paths, travelTimeReport(configuration(input, paths))))) as ReturnType<typeof terrainModelReport>
    for (const role of ['distance', 'terrain'] as const) {
      const eta = available(exported.travelTime!.estimates![role])
      expect(eta.unknownSegments).toBe(eta.segments.length)
      expect(eta.terrainProfile.unknownPolicy).toBe('penalize')
      expect(eta.qualification).toMatch(/UNKNOWN.*configured assumed speed.*remain incomplete/)
      for (const segment of eta.segments) {
        expect(segment.classification).toBe('UNKNOWN')
        expect(segment.gradeDeg).toBeNull()
        expect(segment.gradientDeg).toBeNull()
        expect(segment.roughnessM).toBeNull()
        expect(segment.effectiveSpeedMps).toBe(MOBILITY_PROFILES[0].unknownSpeedMps)
      }
    }
    expect(exported.travelTime!.unknownPolicy).toContain('retain null unavailable terrain metrics')
  })

  it('exports unavailable results without numeric ETA when heights or terrain gates reject a route', () => {
    for (const kind of ['missing', 'blocked', 'profile'] as const) {
      const base = analyzeTerrainModel(grid, DEFAULT_TERRAIN_PROFILE)
      const input = kind === 'missing' ? { ...base, grid: { ...base.grid, valid: base.grid.valid.slice() } } : base
      if (kind === 'missing') input.grid.valid[comparison.terrain.nodes[2]] = 0
      if (kind === 'blocked') input.states[comparison.terrain.nodes[2]] = 3
      const config = configuration(input, comparison, kind === 'profile' ? { ...MOBILITY_PROFILES[0], nominalSpeedMps: 0 } : MOBILITY_PROFILES[0])
      const timing = JSON.parse(JSON.stringify(travelTimeReport(config))) as ReturnType<typeof travelTimeReport>
      expect(timing.estimates!.terrain.status).toBe('unavailable')
      expect(timing.estimates!.terrain).toHaveProperty('reason')
      expect(timing.estimates!.terrain).not.toHaveProperty('value')
      expect(timing.estimates!.terrain).not.toHaveProperty('totalDurationSeconds')
    }
  })

  it('documents UTC, no inferred environmental delay, unsupported CTX ETA and distinct route objectives', () => {
    const timing = travelTimeReport(configuration())
    expect(timing.timeReference).toContain('Earth UTC timestamp and SI seconds')
    expect(timing.timeReference).toContain('No Mars local civil time')
    expect(timing.environmentalDelaySecondsApplied).toBe(0)
    expect(timing.environmentalDelayQualification).toContain('not evidence of absent environmental effects')
    expect(timing.delayModel).toContain('Default is zero')
    expect(timing.delayModel).toContain('No automatic stops, charging, maintenance, weather or rest schedule')
    const limitations = timing.limitations.join('\n')
    expect(limitations).toContain('no NASA rover specifications are asserted')
    expect(limitations).toContain('not optimized for minimum ETA')
    expect(limitations).toContain('CTX distance-only routes have no authorized terrain-dependent ETA')
    expect(limitations).toContain('No direct-line or constant-speed CTX fallback')
    expect(limitations).toContain('remain unverified')
  })
})
