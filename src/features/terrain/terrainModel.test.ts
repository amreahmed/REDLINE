import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import type { TerrainModelGrid, TerrainProfile } from './modelTypes'
import { decodeHrscModel, parseHrscModelManifest } from './hrscModel'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE, modelDistance, modelNodeForCoordinate, modelPoint, terrainMovement, validateTerrainModelGrid, validateTerrainProfile } from './terrainModel'

/** Explicit analytical fixture, never a Mars observation. */
function fixture(rows = 9, columns = 9, sample: (row: number, column: number) => number = () => 0, latitude = 0): TerrainModelGrid {
  const radius = 3396000
  return {
    rows, columns, startRow: 100, startColumn: 200,
    originXM: -columns * 5, originYM: latitude * Math.PI / 180 * radius + rows * 5,
    pixelWidthM: 10, pixelHeightM: -10, referenceRadiusM: radius,
    values: Float32Array.from({ length: rows * columns }, (_, node) => sample(Math.floor(node / columns), node % columns)),
    valid: new Uint8Array(rows * columns).fill(1),
    source: { productId: 'synthetic-analytical-test', gridHash: 'test', sourceHash: 'test', verticalReference: 'synthetic sphere-relative metres', attribution: 'Synthetic test fixture', qualification: 'Synthetic, not Mars data', authorization: 'synthetic-test' },
  }
}

const profile: TerrainProfile = { ...DEFAULT_TERRAIN_PROFILE, roughnessRadiusM: 11, maxRoughnessM: 100, maxUphillDeg: 45, maxDownhillDeg: 45 }

describe('native sphere-relative terrain model', () => {
  it('keeps flat terrain zero and its fully supported interior traversable', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    expect(analysis.slopeDeg[40]).toBe(0)
    expect(analysis.roughnessM[40]).toBe(0)
    expect(analysis.reliefM[40]).toBe(0)
    expect(analysis.shapeM[40]).toBe(0)
    expect(analysis.states[40]).toBe(1)
    expect(terrainMovement(analysis, 40, 41).costM).toBeCloseTo(10, 7)
  })

  it('matches an analytical eastward plane using the physical east-west baseline', () => {
    const grid = fixture(9, 9, (_, column) => column * 2)
    const analysis = analyzeTerrainModel(grid, profile)
    const expected = Math.atan2(4, modelDistance(grid, 39, 41)) * 180 / Math.PI
    expect(analysis.slopeDeg[40]).toBeCloseTo(expected, 5)
    expect(analysis.shapeM[40]).toBeCloseTo(0, 6)
  })

  it('accounts for non-square ground spacing at high latitude', () => {
    const grid = fixture(9, 9, (_, column) => column, 60)
    const analysis = analyzeTerrainModel(grid, profile)
    expect(modelDistance(grid, 40, 41)).toBeCloseTo(5, 4)
    expect(modelDistance(grid, 40, 49)).toBeCloseTo(10, 6)
    expect(analysis.slopeDeg[40]).toBeCloseTo(Math.atan2(2, modelDistance(grid, 39, 41)) * 180 / Math.PI, 5)
  })

  it('preserves directional grades and independently weighted uphill/downhill costs', () => {
    const analysis = analyzeTerrainModel(fixture(9, 9, (_, column) => column), { ...profile, uphillWeight: 3, downhillWeight: 0 })
    const up = terrainMovement(analysis, 40, 41)
    const down = terrainMovement(analysis, 41, 40)
    expect(up.riseM).toBe(1)
    expect(down.riseM).toBe(-1)
    expect(up.gradeDeg).toBeCloseTo(-down.gradeDeg!, 8)
    expect(up.costM!).toBeGreaterThan(down.costM!)
  })

  it('applies uphill and downhill limits separately', () => {
    const analysis = analyzeTerrainModel(fixture(9, 9, (_, column) => column), { ...profile, maxUphillDeg: 3, maxDownhillDeg: 30 })
    expect(terrainMovement(analysis, 40, 41).classification).toBe('BLOCKED')
    expect(terrainMovement(analysis, 41, 40).costM).not.toBeNull()
  })

  it('computes population roughness, relief and center-minus-mean shape', () => {
    const analysis = analyzeTerrainModel(fixture(9, 9, (row, column) => row === 4 && column === 4 ? 10 : 0), profile)
    expect(analysis.roughnessM[40]).toBeCloseTo(4, 5)
    expect(analysis.reliefM[40]).toBe(10)
    expect(analysis.shapeM[40]).toBe(8)
  })

  it('uses a circular neighborhood selected in metres rather than a square cell window', () => {
    const grid = fixture(9, 9, (row, column) => row === 3 && column === 3 ? 100 : 0)
    expect(analyzeTerrainModel(grid, profile).roughnessM[40]).toBe(0)
    expect(analyzeTerrainModel(grid, { ...profile, roughnessRadiusM: 15 }).roughnessM[40]).toBeGreaterThan(0)
  })

  it('does not invent derivatives at grid boundaries', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    expect(Number.isNaN(analysis.slopeDeg[0])).toBe(true)
    expect(Number.isNaN(analysis.roughnessM[0])).toBe(true)
    expect(analysis.states[0]).toBe(0)
    expect(terrainMovement(analysis, 0, 1).costM).toBeNull()
  })

  it('propagates missing neighborhood support without substituting zero', () => {
    const grid = fixture()
    grid.valid[39] = 0
    grid.values[39] = NaN
    const analysis = analyzeTerrainModel(grid, profile)
    expect(analysis.states[39]).toBe(0)
    expect(Number.isNaN(analysis.slopeDeg[40])).toBe(true)
    expect(Number.isNaN(analysis.roughnessM[40])).toBe(true)
    expect(analysis.states[40]).toBe(0)
    expect(terrainMovement(analysis, 40, 41).costM).toBeNull()
  })

  it('permits only incomplete finite-height support under explicit unknown penalty', () => {
    const grid = fixture()
    grid.valid[39] = 0
    grid.values[39] = NaN
    const analysis = analyzeTerrainModel(grid, { ...profile, unknownPolicy: 'penalize', unknownCostMultiplier: 9 })
    const move = terrainMovement(analysis, 40, 41)
    expect(move.classification).toBe('UNKNOWN')
    expect(move.costM).toBeCloseTo(move.distanceM * 9, 8)
    expect(move.riseM).toBeNull()
    expect(move.gradeDeg).toBeNull()
    expect(terrainMovement(analysis, 40, 39).costM).toBeNull()
  })

  it('retains known directional limits even for incomplete-support cells', () => {
    const grid = fixture(9, 9, (_, column) => column)
    grid.valid[31] = 0
    const analysis = analyzeTerrainModel(grid, { ...profile, unknownPolicy: 'penalize', maxUphillDeg: 3 })
    expect(analysis.states[40]).toBe(0)
    expect(terrainMovement(analysis, 40, 41).classification).toBe('BLOCKED')
  })

  it('blocks known excessive roughness even when gradient support is incomplete and unknown is penalized', () => {
    const grid = fixture(9, 9, (_, column) => column === 4 ? 10 : 0, 60)
    const analysis = analyzeTerrainModel(grid, { ...profile, roughnessRadiusM: 6, maxRoughnessM: 3, unknownPolicy: 'penalize' })
    expect(Number.isNaN(analysis.slopeDeg[4])).toBe(true)
    expect(analysis.roughnessM[4]).toBeGreaterThan(3)
    expect(analysis.states[4]).toBe(3)
    expect(terrainMovement(analysis, 4, 5).classification).toBe('BLOCKED')
    expect(terrainMovement(analysis, 4, 5).costM).toBeNull()
  })

  it('blocks a known excessive gradient even when the roughness neighborhood is unsupported', () => {
    const grid = fixture(9, 9, (_, column) => column * 5)
    const analysis = analyzeTerrainModel(grid, { ...profile, maxUphillDeg: 10, maxDownhillDeg: 15, roughnessRadiusM: 1, unknownPolicy: 'penalize' })
    expect(analysis.slopeDeg[40]).toBeGreaterThan(15)
    expect(Number.isNaN(analysis.roughnessM[40])).toBe(true)
    expect(analysis.states[40]).toBe(3)
    // Motion along a contour has zero edge grade, but the known local hard limit remains.
    expect(terrainMovement(analysis, 40, 49).classification).toBe('BLOCKED')
    expect(terrainMovement(analysis, 40, 49).costM).toBeNull()
  })

  it('enforces finite endpoint metric limits independently of a stale unknown classification', () => {
    const analysis = analyzeTerrainModel(fixture(), { ...profile, unknownPolicy: 'penalize' })
    analysis.states[40] = 0
    analysis.roughnessM[40] = profile.maxRoughnessM + 1
    expect(terrainMovement(analysis, 40, 41).classification).toBe('BLOCKED')
    expect(terrainMovement(analysis, 40, 41).costM).toBeNull()
    analysis.roughnessM[40] = NaN
    analysis.slopeDeg[40] = Math.max(profile.maxUphillDeg, profile.maxDownhillDeg) + 1
    expect(terrainMovement(analysis, 40, 49).classification).toBe('BLOCKED')
    expect(terrainMovement(analysis, 40, 49).costM).toBeNull()
  })

  it('does not confuse a missing zero-valued sample with valid flat terrain under permissive policy', () => {
    const grid = fixture()
    grid.valid[40] = 0
    grid.values[40] = 0
    const analysis = analyzeTerrainModel(grid, { ...profile, unknownPolicy: 'penalize' })
    expect(analysis.states[40]).toBe(0)
    expect(Number.isNaN(analysis.slopeDeg[40])).toBe(true)
    expect(Number.isNaN(analysis.roughnessM[40])).toBe(true)
    expect(terrainMovement(analysis, 40, 41).costM).toBeNull()
    expect(terrainMovement(analysis, 41, 40).costM).toBeNull()
    expect(analysis.grid.valid[41]).toBe(1)
    expect(analysis.grid.values[41]).toBe(0)
  })

  it('distinguishes high-cost and blocked terrain under configurable roughness limits', () => {
    const grid = fixture(9, 9, (row, column) => row === 4 && column === 4 ? 10 : 0)
    expect(analyzeTerrainModel(grid, { ...profile, maxRoughnessM: 5, highCostFraction: 0.7 }).states[40]).toBe(2)
    expect(analyzeTerrainModel(grid, { ...profile, maxRoughnessM: 3 }).states[40]).toBe(3)
    expect(terrainMovement(analyzeTerrainModel(grid, { ...profile, maxRoughnessM: 3 }), 40, 41).costM).toBeNull()
  })

  it('rejects diagonal corner cutting across missing flank heights even when unknown is penalized', () => {
    const grid = fixture()
    grid.valid[41] = 0
    const analysis = analyzeTerrainModel(grid, { ...profile, unknownPolicy: 'penalize' })
    expect(terrainMovement(analysis, 40, 50).costM).toBeNull()
  })

  it('rejects diagonal corner cutting across blocked flank cells', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    analysis.states[41] = 3
    expect(terrainMovement(analysis, 40, 50).costM).toBeNull()
  })

  it('rejects non-neighbor movement and invalid cell indices', () => {
    const analysis = analyzeTerrainModel(fixture(), profile)
    expect(terrainMovement(analysis, 40, 42).costM).toBeNull()
    expect(terrainMovement(analysis, -1, 40).costM).toBeNull()
    expect(terrainMovement(analysis, 40, 40).costM).toBeNull()
  })

  it('keeps every included movement cost above its sphere distance', () => {
    const analysis = analyzeTerrainModel(fixture(9, 9, (row, column) => row * 0.2 + column * 0.3), profile)
    for (const to of [30, 31, 32, 39, 41, 48, 49, 50]) {
      const move = terrainMovement(analysis, 40, to)
      expect(move.costM).not.toBeNull()
      expect(move.costM!).toBeGreaterThanOrEqual(move.distanceM)
    }
  })

  it('maps native centers to their exact global row/column and rejects out-of-coverage coordinates', () => {
    const grid = fixture()
    const point = modelPoint(grid, 40)
    expect(point.row).toBe(104)
    expect(point.column).toBe(204)
    expect(point.lon).toBe(0)
    expect(point.lat).toBe(0)
    expect(modelNodeForCoordinate(grid, point.lon, point.lat)).toBe(40)
    expect(modelNodeForCoordinate(grid, 90, 45)).toBeNull()
    expect(modelNodeForCoordinate(grid, NaN, 0)).toBeNull()
  })

  it('rejects malformed grids and falsely claimed provider authorization', () => {
    expect(() => validateTerrainModelGrid({ ...fixture(), valid: new Uint8Array(1) })).toThrow()
    expect(() => validateTerrainModelGrid({ ...fixture(), pixelHeightM: 10 })).toThrow()
    const fake = fixture()
    expect(() => validateTerrainModelGrid({ ...fake, source: { ...fake.source, authorization: 'provider-dem-model' } })).toThrow()
    expect(() => validateTerrainModelGrid({ ...fake, source: { ...fake.source, productId: 'JEZ_ctx_B_soc_008_DTM' } })).toThrow()
    const nonfinite = fixture()
    nonfinite.values[0] = Infinity
    expect(() => validateTerrainModelGrid(nonfinite)).toThrow()
  })

  it.each([
    { maxUphillDeg: 0 }, { maxDownhillDeg: 90 }, { maxRoughnessM: NaN },
    { roughnessRadiusM: 0 }, { roughnessRadiusM: 251 }, { highCostFraction: 1.1 }, { uphillWeight: -1 },
    { slopeWeight: Infinity }, { unknownCostMultiplier: 0.5 },
  ])('rejects unsupported or negative profile inputs %s', patch => {
    expect(() => validateTerrainProfile({ ...profile, ...patch })).toThrow()
  })
})

describe('preserved real HRSC DEM-model authorization and metrics', () => {
  function preservedHrsc() {
    const bytes = readFileSync('public/data/hrsc-terrain-model.i16')
    const mask = readFileSync('public/data/hrsc-terrain-model.u8')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('e385f36da8ea9137bdd7cece3ac858a64de1bbf5e036ecc01e942d7e9a5439f2')
    const manifest = parseHrscModelManifest(JSON.parse(readFileSync('public/data/hrsc-terrain-model.json', 'utf8')))
    return decodeHrscModel(manifest, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), mask.buffer.slice(mask.byteOffset, mask.byteOffset + mask.byteLength))
  }

  /** Independent haversine baseline; not the production vector implementation. */
  function baseline(grid: TerrainModelGrid, first: number, second: number) {
    const coordinate = (node: number) => {
      const row = Math.floor(node / grid.columns)
      const column = node % grid.columns
      return [(grid.originXM + (column + 0.5) * grid.pixelWidthM) / grid.referenceRadiusM, (grid.originYM + (row + 0.5) * grid.pixelHeightM) / grid.referenceRadiusM]
    }
    const [lonA, latA] = coordinate(first)
    const [lonB, latB] = coordinate(second)
    const haversine = Math.sin((latB - latA) / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin((lonB - lonA) / 2) ** 2
    return 2 * grid.referenceRadiusM * Math.asin(Math.sqrt(haversine))
  }

  it('checks native provider gradients and circular neighborhood statistics against independent formulas', () => {
    const grid = preservedHrsc()
    const analysis = analyzeTerrainModel(grid, DEFAULT_TERRAIN_PROFILE)
    const center = 51 * grid.columns + 51
    const gx = (grid.values[center + 1] - grid.values[center - 1]) / baseline(grid, center - 1, center + 1)
    const gy = (grid.values[center - grid.columns] - grid.values[center + grid.columns]) / baseline(grid, center - grid.columns, center + grid.columns)
    expect(analysis.slopeDeg[center]).toBeCloseTo(Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI, 5)
    const neighbors: number[] = []
    for (let row = 0; row < grid.rows; row++) for (let column = 0; column < grid.columns; column++) {
      const node = row * grid.columns + column
      if (baseline(grid, center, node) <= 100 + 1e-7) neighbors.push(grid.values[node])
    }
    const mean = neighbors.reduce((total, value) => total + value, 0) / neighbors.length
    const std = Math.sqrt(neighbors.reduce((total, value) => total + (value - mean) ** 2, 0) / neighbors.length)
    expect(analysis.roughnessM[center]).toBeCloseTo(std, 5)
    expect(analysis.shapeM[center]).toBeCloseTo(grid.values[center] - mean, 5)
    expect(analysis.reliefM[center]).toBe(Math.max(...neighbors) - Math.min(...neighbors))
    expect(modelDistance(grid, center, center + 1)).toBeCloseTo(baseline(grid, center, center + 1), 6)
    expect(grid.values.length).toBe(10609)
    expect(analysis.states[0]).toBe(0)
    expect(grid.source.qualification).toContain('Physical slope accuracy')
    expect(grid.source.qualification).toContain('remain unverified')
  })

  it('refuses a conflicting vertical interpretation instead of unlocking CTX or physical slopes', () => {
    const grid = preservedHrsc()
    expect(() => analyzeTerrainModel({ ...grid, source: { ...grid.source, verticalReference: 'areoid heights' } }, DEFAULT_TERRAIN_PROFILE)).toThrow(/contract/)
    expect(() => analyzeTerrainModel({ ...grid, source: { ...grid.source, productId: 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0' } }, DEFAULT_TERRAIN_PROFILE)).toThrow(/contract/)
    expect(() => analyzeTerrainModel({ ...grid, source: { ...grid.source, qualification: 'Physical slopes verified' } }, DEFAULT_TERRAIN_PROFILE)).toThrow(/contract/)
  })

  it('keeps the maximum supported physical neighborhood bounded on the real native grid', () => {
    const grid = preservedHrsc()
    const analysis = analyzeTerrainModel(grid, { ...DEFAULT_TERRAIN_PROFILE, roughnessRadiusM: 250 })
    expect(Number.isFinite(analysis.roughnessM[51 * 103 + 51])).toBe(true)
    expect(analysis.states[0]).toBe(0)
    expect(() => analyzeTerrainModel(grid, { ...DEFAULT_TERRAIN_PROFILE, roughnessRadiusM: 251 })).toThrow()
  })
})
