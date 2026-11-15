/// <reference types="node" />
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { TerrainAnalysis, TerrainModelGrid, TerrainProfile } from '../terrain/modelTypes'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE, modelDistance, modelPoint, terrainMovement } from '../terrain/terrainModel'
import { decodeHrscModel, parseHrscModelManifest } from '../terrain/hrscModel'
import { calculateTerrainComparison } from './terrainRoutes'
import type { TerrainComparison } from './terrainRoutes'

// Analytical test terrain and blocked-state fixtures never enter the application.
function fixture(rows = 9, columns = 11, height: (row: number, column: number) => number = () => 0): TerrainModelGrid {
  return {
    rows, columns, startRow: 100, startColumn: 200,
    originXM: -columns * 5, originYM: rows * 5,
    pixelWidthM: 10, pixelHeightM: -10, referenceRadiusM: 3396000,
    values: Float32Array.from({ length: rows * columns }, (_, node) => height(Math.floor(node / columns), node % columns)),
    valid: new Uint8Array(rows * columns).fill(1),
    source: { productId: 'synthetic-routing-test', gridHash: 'test-grid', sourceHash: 'test-source', verticalReference: 'Synthetic sphere-relative metres', attribution: 'Synthetic test fixture', qualification: 'Synthetic analytical test, not Mars data', authorization: 'synthetic-test' },
  }
}

const profile: TerrainProfile = {
  ...DEFAULT_TERRAIN_PROFILE, roughnessRadiusM: 11, maxRoughnessM: 100,
  maxUphillDeg: 45, maxDownhillDeg: 45, uphillWeight: 8, downhillWeight: 2,
  slopeWeight: 8, roughnessWeight: 3,
}
const node = (analysis: TerrainAnalysis, row: number, column: number) => row * analysis.grid.columns + column
function comparison(analysis: TerrainAnalysis, from: number, to: number, waypoint: number | null = null): TerrainComparison {
  const result = calculateTerrainComparison(analysis, from, to, waypoint)
  if (result.status !== 'available') throw new Error(result.reason)
  return result.value
}

/** Independent linear-scan Dijkstra, without A*'s heap, heuristic or reconstruction. */
function dijkstra(analysis: TerrainAnalysis, from: number, to: number, terrain: boolean): number {
  const count = analysis.grid.values.length
  const distances = new Float64Array(count).fill(Infinity)
  const settled = new Set<number>()
  distances[from] = 0
  while (settled.size < count) {
    let current = -1
    for (let candidate = 0; candidate < count; candidate++) if (!settled.has(candidate) && (current === -1 || distances[candidate] < distances[current])) current = candidate
    if (current === -1 || !Number.isFinite(distances[current])) return Infinity
    if (current === to) return distances[current]
    settled.add(current)
    for (let next = 0; next < count; next++) {
      if (settled.has(next)) continue
      const move = terrainMovement(analysis, current, next)
      if (move.costM === null) continue
      distances[next] = Math.min(distances[next], distances[current] + (terrain ? move.costM : move.distanceM))
    }
  }
  return Infinity
}

describe('qualified DEM route comparison', () => {
  it('calculates qualified routes on the preserved real HRSC heights without changing HRSC or CTX bytes', () => {
    const sampleBytes = Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.i16', import.meta.url)))
    const maskBytes = Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.u8', import.meta.url)))
    const manifest = parseHrscModelManifest(JSON.parse(readFileSync(new URL('../../../public/data/hrsc-terrain-model.json', import.meta.url), 'utf8')))
    const grid = decodeHrscModel(manifest, sampleBytes.buffer, maskBytes.buffer)
    const originalHeights = grid.values.slice()
    const ctxBytes = readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))
    const ctxHash = createHash('sha256').update(ctxBytes).digest('hex')
    const analysis = analyzeTerrainModel(grid, DEFAULT_TERRAIN_PROFILE)
    const routes = comparison(analysis, 30 * 103 + 30, 70 * 103 + 70)
    for (const route of [routes.distance, routes.terrain]) {
      expect(route.source.productId).toBe('HMC_13E10_DT5')
      expect(route.source.authorization).toBe('provider-dem-model')
      expect(route.source.verticalReference).toContain('3,396,000 m sphere')
      expect(route.scientificStatus).toBe('physical-terrain-unverified')
      expect(route.qualification).toContain('Physical slope accuracy')
      expect(route.points).toEqual(route.nodes.map(index => modelPoint(grid, index)))
      expect(route.nodes.every(index => grid.valid[index] === 1 && analysis.states[index] !== 3)).toBe(true)
      expect(route.accumulatedCostM).toBeGreaterThanOrEqual(route.horizontalDistanceM)
    }
    expect(routes.distance.horizontalDistanceM).toBeLessThanOrEqual(routes.terrain.horizontalDistanceM + 1e-6)
    expect(routes.terrain.accumulatedCostM).toBeLessThanOrEqual(routes.distance.accumulatedCostM + 1e-6)
    expect(grid.values).toEqual(originalHeights)
    expect(grid.values).toHaveLength(10609)
    expect(ctxBytes.byteLength / 4).toBe(65536)
    expect(createHash('sha256').update(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))).digest('hex')).toBe(ctxHash)
  })

  it('uses exact native centers and retains all intermediate cells on flat terrain', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    const from = node(analysis, 4, 2)
    const to = node(analysis, 4, 8)
    const routes = comparison(analysis, from, to)
    for (const route of [routes.distance, routes.terrain]) {
      expect(route.nodes).toEqual(Array.from({ length: 7 }, (_, offset) => from + offset))
      expect(route.points).toEqual(route.nodes.map(index => modelPoint(analysis.grid, index)))
      expect(route.horizontalDistanceM).toBeCloseTo(60, 7)
      expect(route.accumulatedCostM).toBeCloseTo(60, 7)
      expect(route.maxGradeDeg).toBe(0)
      expect(route.meanAbsGradeDeg).toBe(0)
      expect(route.maxSlopeDeg).toBe(0)
      expect(route.meanSlopeDeg).toBe(0)
      expect(route.maxRoughnessM).toBe(0)
      expect(route.meanRoughnessM).toBe(0)
      expect(route.exploredNodes).toContain(from)
      expect(route.exploredNodes).toContain(to)
      expect(route.exploredNodes).toEqual([...new Set(route.exploredNodes)].sort((a, b) => a - b))
      expect(route.source).toEqual(analysis.grid.source)
      expect(route.profile).toEqual(profile)
      expect(route.scientificStatus).toBe('physical-terrain-unverified')
      expect(route.qualification).toContain('Physical traversability and human safety are not validated')
      expect(route.qualification).toContain('Synthetic')
    }
    expect(routes.distance.model).toBe('hypothetical-dem-distance')
    expect(routes.terrain.model).toBe('hypothetical-dem-terrain')
  })

  it('reports local gradient slope separately from a flat directional edge grade', () => {
    const analysis = analyzeTerrainModel(fixture(9, 11, row => row * 0.5), profile)
    const routes = comparison(analysis, node(analysis, 4, 2), node(analysis, 4, 8))
    for (const route of [routes.distance, routes.terrain]) {
      expect(route.maxGradeDeg).toBe(0)
      expect(route.meanAbsGradeDeg).toBe(0)
      const localSlopes = route.nodes.map(index => analysis.slopeDeg[index])
      expect(route.maxSlopeDeg).toBeCloseTo(Math.max(...localSlopes), 8)
      expect(route.meanSlopeDeg).toBeCloseTo(localSlopes.reduce((sum, value) => sum + value, 0) / localSlopes.length, 8)
      expect(route.maxSlopeDeg!).toBeGreaterThan(2)
    }
  })

  it('selects a genuinely longer but cheaper terrain path around an analytical hill', () => {
    const analysis = analyzeTerrainModel(fixture(9, 11, (row, column) => row === 4 && column === 5 ? 5 : 0), profile)
    const hill = node(analysis, 4, 5)
    const routes = comparison(analysis, node(analysis, 4, 2), node(analysis, 4, 8))
    expect(routes.distance.nodes).toContain(hill)
    expect(routes.terrain.nodes).not.toContain(hill)
    expect(routes.terrain.horizontalDistanceM).toBeGreaterThan(routes.distance.horizontalDistanceM)
    expect(routes.terrain.accumulatedCostM).toBeLessThan(routes.distance.accumulatedCostM)
    expect(routes.terrain.accumulatedCostM).toBeCloseTo(dijkstra(analysis, node(analysis, 4, 2), node(analysis, 4, 8), true), 8)
  })

  it('routes around DEM-derived blocked terrain under restrictive rover assumptions', () => {
    const analysis = analyzeTerrainModel(fixture(9, 11, (row, column) => row === 4 && column === 5 ? 5 : 0), { ...profile, maxUphillDeg: 8, maxDownhillDeg: 8 })
    expect(analysis.states).toContain(3)
    const routes = comparison(analysis, node(analysis, 4, 2), node(analysis, 4, 8))
    for (const route of [routes.distance, routes.terrain]) {
      expect(route.nodes.every(index => analysis.states[index] !== 3)).toBe(true)
      expect(route.blockedSearchCells).toBe(analysis.states.filter(state => state === 3).length)
      expect(route).not.toHaveProperty('blockedCellsAvoided')
      for (let index = 1; index < route.nodes.length; index++) expect(terrainMovement(analysis, route.nodes[index - 1], route.nodes[index]).costM).not.toBeNull()
    }
  })

  it('passes through the sole opening in an explicitly synthetic blocked-state wall', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    for (let row = 0; row < analysis.grid.rows; row++) if (row !== 2) analysis.states[node(analysis, row, 5)] = 3
    const routes = comparison(analysis, node(analysis, 4, 2), node(analysis, 4, 8))
    for (const route of [routes.distance, routes.terrain]) {
      expect(route.nodes).toContain(node(analysis, 2, 5))
      expect(route.nodes.every(index => analysis.states[index] !== 3)).toBe(true)
      expect(route.points).toHaveLength(route.nodes.length)
      for (let index = 1; index < route.nodes.length; index++) expect(terrainMovement(analysis, route.nodes[index - 1], route.nodes[index]).costM).not.toBeNull()
    }
  })

  it('reports a fully disconnected destination and an unreachable required waypoint', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    for (let row = 0; row < analysis.grid.rows; row++) analysis.states[node(analysis, row, 5)] = 3
    expect(calculateTerrainComparison(analysis, node(analysis, 4, 2), node(analysis, 4, 8))).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/No connected route/) })
    expect(calculateTerrainComparison(analysis, node(analysis, 4, 2), node(analysis, 5, 2), node(analysis, 4, 8))).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/No connected route/) })
  })

  it('prevents diagonal corner cutting through blocked flank cells', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    const from = node(analysis, 4, 4)
    const to = node(analysis, 5, 5)
    analysis.states[node(analysis, 4, 5)] = 3
    analysis.states[node(analysis, 5, 4)] = 3
    const routes = comparison(analysis, from, to)
    for (const route of [routes.distance, routes.terrain]) {
      expect(route.nodes.length).toBeGreaterThan(2)
      expect(route.nodes).not.toContain(node(analysis, 4, 5))
      expect(route.nodes).not.toContain(node(analysis, 5, 4))
    }
  })

  it('keeps actual missing heights excluded even when incomplete support is penalized', () => {
    const grid = fixture()
    const missing = 4 * grid.columns + 5
    grid.valid[missing] = 0
    grid.values[missing] = NaN
    const analysis = analyzeTerrainModel(grid, { ...profile, unknownPolicy: 'penalize', unknownCostMultiplier: 2 })
    const routes = comparison(analysis, node(analysis, 4, 4), node(analysis, 4, 6))
    expect(routes.terrain.nodes).not.toContain(missing)
    expect(routes.distance.nodes).not.toContain(missing)
    expect(calculateTerrainComparison(analysis, missing, node(analysis, 4, 6))).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/Origin.*missing/) })
  })

  it('retains incomplete-statistic qualifications for explicitly penalized unknown paths', () => {
    const analysis = analyzeTerrainModel(fixture(), { ...profile, unknownPolicy: 'penalize', unknownCostMultiplier: 3 })
    const routes = comparison(analysis, 0, 2)
    for (const route of [routes.distance, routes.terrain]) {
      expect(route.unknownSegments).toBeGreaterThan(0)
      expect(route.maxGradeDeg).toBeNull()
      expect(route.meanAbsGradeDeg).toBeNull()
      expect(route.maxSlopeDeg).toBeNull()
      expect(route.meanSlopeDeg).toBeNull()
      expect(route.maxRoughnessM).toBeNull()
      expect(route.meanRoughnessM).toBeNull()
      expect(route.accumulatedCostM).toBeCloseTo(route.horizontalDistanceM * 3, 8)
    }
    const conservative = analyzeTerrainModel(analysis.grid, profile)
    expect(calculateTerrainComparison(conservative, 0, 2)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/unknown/) })
  })

  it('preserves the required waypoint and exact independently optimal constrained legs', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    const from = node(analysis, 4, 2)
    const to = node(analysis, 4, 8)
    const waypoint = node(analysis, 2, 5)
    const routes = comparison(analysis, from, to, waypoint)
    expect(routes.waypoint).toBe(waypoint)
    for (const [terrain, route] of [[false, routes.distance], [true, routes.terrain]] as const) {
      expect(route.nodes[0]).toBe(from)
      expect(route.nodes.at(-1)).toBe(to)
      expect(route.nodes).toContain(waypoint)
      const expected = dijkstra(analysis, from, waypoint, terrain) + dijkstra(analysis, waypoint, to, terrain)
      expect(terrain ? route.accumulatedCostM : route.horizontalDistanceM).toBeCloseTo(expected, 8)
    }
  })

  it('reproduces model costs independently from directional grades and raster penalties', () => {
    const analysis = analyzeTerrainModel(fixture(9, 11, (row, column) => row * 0.2 + column * 0.3), profile)
    const routes = comparison(analysis, node(analysis, 4, 2), node(analysis, 4, 8))
    for (const route of [routes.distance, routes.terrain]) {
      let totalDistance = 0
      let totalCost = 0
      let gradeSum = 0
      let gradeMax = 0
      for (let index = 1; index < route.nodes.length; index++) {
        const from = route.nodes[index - 1]
        const to = route.nodes[index]
        const distance = modelDistance(analysis.grid, from, to)
        const grade = Math.atan2(analysis.grid.values[to] - analysis.grid.values[from], distance) * 180 / Math.PI
        const uphill = Math.max(0, grade) / profile.maxUphillDeg
        const downhill = Math.max(0, -grade) / profile.maxDownhillDeg
        const slope = Math.max(analysis.slopeDeg[from], analysis.slopeDeg[to]) / Math.max(profile.maxUphillDeg, profile.maxDownhillDeg)
        const roughness = Math.max(analysis.roughnessM[from], analysis.roughnessM[to]) / profile.maxRoughnessM
        totalDistance += distance
        totalCost += distance * (1 + profile.uphillWeight * uphill + profile.downhillWeight * downhill + profile.slopeWeight * slope + profile.roughnessWeight * roughness)
        gradeSum += Math.abs(grade)
        gradeMax = Math.max(gradeMax, Math.abs(grade))
      }
      expect(route.horizontalDistanceM).toBeCloseTo(totalDistance, 9)
      expect(route.accumulatedCostM).toBeCloseTo(totalCost, 9)
      expect(route.maxGradeDeg).toBeCloseTo(gradeMax, 9)
      expect(route.meanAbsGradeDeg).toBeCloseTo(gradeSum / (route.nodes.length - 1), 9)
    }
  })

  it.each([0, 1, 8])('matches independent Dijkstra on directional weighted analytical terrain, weight %s', weight => {
    const analysis = analyzeTerrainModel(fixture(7, 7, (row, column) => row === 3 && column === 3 ? 3 : column * 0.1), { ...profile, uphillWeight: weight, slopeWeight: weight })
    const pairs = [[15, 33], [33, 15], [16, 32], [32, 16], [17, 31], [8, 40]]
    for (const [from, to] of pairs) {
      const routes = comparison(analysis, from, to)
      expect(routes.distance.horizontalDistanceM).toBeCloseTo(dijkstra(analysis, from, to, false), 8)
      expect(routes.terrain.accumulatedCostM).toBeCloseTo(dijkstra(analysis, from, to, true), 8)
      expect(routes.terrain.accumulatedCostM).toBeLessThanOrEqual(routes.distance.accumulatedCostM + 1e-7)
      expect(routes.distance.horizontalDistanceM).toBeLessThanOrEqual(routes.terrain.horizontalDistanceM + 1e-7)
    }
  })

  it('allows different reverse-direction costs while preserving deterministic searches', () => {
    const analysis = analyzeTerrainModel(fixture(9, 11, (_, column) => column * 0.5), { ...profile, uphillWeight: 9, downhillWeight: 0 })
    const from = node(analysis, 4, 2)
    const to = node(analysis, 4, 8)
    const forward = comparison(analysis, from, to)
    const reverse = comparison(analysis, to, from)
    expect(forward.terrain.accumulatedCostM).toBeGreaterThan(reverse.terrain.accumulatedCostM)
    expect(comparison(analysis, from, to)).toEqual(forward)
    expect(analysis.grid.values).toEqual(fixture(9, 11, (_, column) => column * 0.5).values)
  })

  it('does not let the CTX scientific gate be bypassed by relabeling an unsupported source', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    const provider = { ...analysis.grid, source: { ...analysis.grid.source, productId: 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0', authorization: 'provider-dem-model' as const } }
    expect(calculateTerrainComparison({ ...analysis, grid: provider }, 46, 52)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/HRSC.*CTX/) })
    const syntheticImpersonation = { ...analysis.grid, source: { ...analysis.grid.source, productId: 'HMC_13E10_DT5' } }
    expect(calculateTerrainComparison({ ...analysis, grid: syntheticImpersonation }, 46, 52)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/synthetic/i) })
  })

  it('rejects duplicate, outside, blocked and malformed controls or analysis contracts', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    const from = node(analysis, 4, 2)
    const to = node(analysis, 4, 8)
    for (const [origin, destination, waypoint] of [[from, from, null], [-1, to, null], [from, 65536, null], [from, to, from], [from, to, to], [from, to, 3.5]]) expect(calculateTerrainComparison(analysis, origin!, destination!, waypoint)).toMatchObject({ status: 'unavailable', reason: expect.any(String) })
    expect(calculateTerrainComparison({ ...analysis, states: new Uint8Array(1) }, from, to).status).toBe('unavailable')
    expect(calculateTerrainComparison({ ...analysis, slopeDeg: new Float32Array(1) }, from, to).status).toBe('unavailable')
    expect(calculateTerrainComparison({ ...analysis, profile: { ...profile, uphillWeight: -1 } }, from, to).status).toBe('unavailable')
    const malformed = analysis.states.slice()
    malformed[10] = 4
    expect(calculateTerrainComparison({ ...analysis, states: malformed }, from, to).status).toBe('unavailable')
    expect(calculateTerrainComparison(null as unknown as TerrainAnalysis, from, to).status).toBe('unavailable')
  })
})
