/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import sourceManifest from '../../../public/data/jezero-terrain-grid.json'
import independentDistances from '../../../docs/evidence/scientific-validation/distance-fixtures.json'
import { terrainHeightDifferenceBlocker } from '../../data/terrainScience'
import type { TerrainGrid } from './gridTypes'
import { decodeTerrainGrid, parseTerrainGridManifest } from './terrainGrid'
import { inspectTerrainEdge, measureGridSeparation } from './terrainMetrics'

const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))).buffer
const grid = decodeTerrainGrid(parseTerrainGridManifest(sourceManifest), binary)
const from = { row: 714, column: 650 }

function withTestValue(row: number, column: number, value: number): TerrainGrid {
  const values = grid.values.slice()
  values[(row - 586) * 256 + column - 522] = value
  return { manifest: grid.manifest, values }
}

describe('native-cell reference-sphere separation', () => {
  it.each(independentDistances.gridFixtures)('matches independently generated PROJ source-cell pair $start → $end', ({ start, end, startCoordinate, endCoordinate, distanceM }) => {
    const result = measureGridSeparation(grid, { row: start[0], column: start[1] }, { row: end[0], column: end[1] })
    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error(result.reason)
    expect(result.value.distanceM).toBeCloseTo(distanceM, 6)
    expect(result.value.from.lon).toBeCloseTo(startCoordinate[0], 12)
    expect(result.value.from.lat).toBeCloseTo(startCoordinate[1], 12)
    expect(result.value.to.lon).toBeCloseTo(endCoordinate[0], 12)
    expect(result.value.to.lat).toBeCloseTo(endCoordinate[1], 12)
  })

  it.each([
    [{ row: 714, column: 651 }, 18.968674590506335],
    [{ row: 715, column: 650 }, 20],
    // Independently checked with unit-vector cross/dot atan2 in Python.
    [{ row: 715, column: 651 }, 27.56467529051163],
    [{ row: 714, column: 650 }, 0],
  ])('matches independent source-space distance for %o', (to, distanceM) => {
    const result = measureGridSeparation(grid, from, to)
    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error(result.reason)
    expect(result.value.distanceM).toBeCloseTo(distanceM, 7)
    expect(result.value).toMatchObject({ referenceRadiusM: 3396190, model: 'reference-sphere-shortest-arc', from: { ...from, sourceId: grid.manifest.source.productId, elevationM: -2489.27978515625 }, to: { ...to, sourceId: grid.manifest.source.productId } })
    const reverse = measureGridSeparation(grid, to, from)
    expect(reverse.status).toBe('available')
    if (reverse.status !== 'available') throw new Error(reverse.reason)
    expect(reverse.value.distanceM).toBe(result.value.distanceM)
  })

  it('computes nonadjacent geometric endpoint separation without inventing terrain or routes', () => {
    const result = measureGridSeparation(grid, { row: 650, column: 580 }, { row: 800, column: 730 })
    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error(result.reason)
    // Independent Python unit-vector oracle, not the application's haversine.
    expect(result.value.distanceM).toBeCloseTo(4134.741661399694, 6)
    expect(result.value).not.toHaveProperty('grade')
    expect(result.value).not.toHaveProperty('cost')
    expect(result.value).not.toHaveProperty('route')
    expect(result.value.from.elevationM).toBe(-2401.48681640625)
    expect(result.value.to.elevationM).toBe(-2542.51025390625)
  })

  it('rereads native cells instead of trusting stale endpoint heights or coordinates', () => {
    const stale = { ...from, elevationM: 0, lon: 0, lat: 0, sourceId: 'synthetic-invalid-endpoint' }
    const result = measureGridSeparation(grid, stale, { row: 715, column: 650 })
    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error(result.reason)
    expect(result.value.from.elevationM).toBe(-2489.27978515625)
    expect(result.value.from.lon).toBeCloseTo(77.37995202842774, 12)
    expect(result.value.from.sourceId).toBe(grid.manifest.source.productId)
    expect(grid.values[(714 - 586) * 256 + 650 - 522]).toBe(-2489.27978515625)
  })

  it.each([
    [{ row: 585, column: 650 }, /outside/],
    [{ row: 842, column: 650 }, /outside/],
    [{ row: 714, column: 778 }, /outside/],
    [{ row: 714.5, column: 650 }, /integer/],
    [{ row: 714, column: NaN }, /integer/],
    [{ row: '714' as unknown as number, column: 650 }, /integer/],
  ])('propagates invalid support %o on either endpoint', (invalid, reason) => {
    expect(measureGridSeparation(grid, from, invalid)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(reason) })
    expect(measureGridSeparation(grid, invalid, from)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(reason) })
  })

  it.each([grid.manifest.sourceGrid.noData, NaN, Infinity, -Infinity])('propagates test-only missing/nonfinite source value %s', (value) => {
    const synthetic = withTestValue(714, 650, value)
    expect(measureGridSeparation(synthetic, from, { row: 715, column: 650 })).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/NoData|nonfinite/) })
    expect(measureGridSeparation(synthetic, { row: 715, column: 650 }, from)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/NoData|nonfinite/) })
  })

  it('rejects corrupted storage and unsupported source/projection contracts', () => {
    expect(measureGridSeparation({ manifest: grid.manifest, values: new Float32Array(0) }, from, from)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/storage/) })
    const unsupported = { ...grid, manifest: { ...grid.manifest, projection: { ...grid.manifest.projection, radiusM: 6378137 } } } as unknown as TerrainGrid
    expect(measureGridSeparation(unsupported, from, from)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/contract/) })
    const changedSource = { ...grid, manifest: { ...grid.manifest, source: { ...grid.manifest.source, sha256: '0'.repeat(64) } } }
    expect(measureGridSeparation(changedSource, from, from)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/contract/) })
  })
})

describe('terrain-edge support and independent height-reference gate', () => {
  it('keeps real source-derived grade and cost blocked when the scientific review has a blocker', () => {
    const blocker = terrainHeightDifferenceBlocker(grid)
    expect(blocker).toEqual(expect.any(String))
    for (const to of [{ row: 715, column: 650 }, { row: 715, column: 651 }]) {
      expect(inspectTerrainEdge(grid, from, to, 4)).toEqual({ status: 'unavailable', reason: blocker })
    }
    expect(grid.values).toHaveLength(65536)
    expect(grid.values[(714 - 586) * 256 + 650 - 522]).toBe(-2489.27978515625)
  })

  it.each([{ row: 714, column: 650 }, { row: 716, column: 650 }, { row: 650, column: 580 }])('rejects identical or nonadjacent cells %o before any height-based calculation', (to) => {
    expect(inspectTerrainEdge(grid, from, to, 4)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/distinct adjacent/) })
  })

  it.each([[714, 651], [715, 650]])('rejects a test-only missing diagonal flank r%s c%s, in either direction', (row, column) => {
    const missing = withTestValue(row, column, grid.manifest.sourceGrid.noData)
    const to = { row: 715, column: 651 }
    expect(inspectTerrainEdge(missing, from, to, 4)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/diagonal flank.*NoData/) })
    expect(inspectTerrainEdge(missing, to, from, 4)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/diagonal flank.*NoData/) })
  })

  it('rejects nonfinite diagonal flanks and outside endpoints before height authorization', () => {
    const nonfinite = withTestValue(714, 651, NaN)
    expect(inspectTerrainEdge(nonfinite, from, { row: 715, column: 651 }, 4)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/diagonal flank.*nonfinite/) })
    expect(inspectTerrainEdge(grid, { row: 586, column: 522 }, { row: 585, column: 521 }, 4)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/outside/) })
  })

  it.each([-1, NaN, Infinity])('rejects unsupported hypothetical weights %s', (weight) => {
    expect(inspectTerrainEdge(grid, from, { row: 715, column: 650 }, weight)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/weight/) })
  })
})
