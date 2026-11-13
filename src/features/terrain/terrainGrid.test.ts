/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import sourceManifest from '../../../public/data/jezero-terrain-grid.json'
import { decodeTerrainGrid, getGridCell, gridCellForCoordinate, parseTerrainGridManifest, terrainGridBounds } from './terrainGrid'
import type { TerrainGrid } from './gridTypes'

const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))).buffer
const manifest = parseTerrainGridManifest(sourceManifest)
const grid = decodeTerrainGrid(manifest, binary)
const realFixtures = [
  { row: 586, column: 522, lon: 77.33676327999098, lat: 18.523302286887112, height: -2377.045654296875 },
  { row: 586, column: 777, lon: 77.42280336476735, lat: 18.523302286887112, height: -2530.604248046875 },
  { row: 841, column: 777, lon: 77.42280336476735, lat: 18.437262202110723, height: -2540.54541015625 },
  { row: 841, column: 522, lon: 77.33676327999098, lat: 18.437262202110723, height: -2374.85400390625 },
  { row: 714, column: 650, lon: 77.37995202842774, lat: 18.48011353845034, height: -2489.27978515625 },
  { row: 650, column: 580, lon: 77.3563331816264, lat: 18.501707912668724, height: -2401.48681640625 },
  { row: 800, column: 730, lon: 77.40694499620072, lat: 18.45109609809438, height: -2542.51025390625 },
]

describe('verified native terrain crop', () => {
  it('retains the audited 20m source, qualified height reference, and display-selected bounds', () => {
    expect(manifest.grid).toEqual({ startRow: 586, startColumn: 522, rows: 256, columns: 256 })
    expect(grid.values).toHaveLength(65536)
    expect(manifest.sourceGrid.pixelSizeM).toBe(20)
    expect(manifest.source.heightReference).toBe('provider-declared-iau-sphere-unvalidated')
    expect(manifest.boundaryPolicy).toMatch(/do not represent feature accuracy/)
    expect(manifest.processing).toMatch(/no resampling, interpolation, datum change/)
    expect(manifest.summary).toEqual({ validCount: 65536, missingCount: 0, minM: -2560.28857421875, maxM: -2363.345703125 })
  })

  it.each(realFixtures)('matches independent Rasterio fixture row$row column$column', ({ row, column, lon, lat, height }) => {
    const result = getGridCell(grid, row, column)
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') throw new Error('Fixture should have valid numerical support')
    expect(result.cell.row).toBe(row)
    expect(result.cell.column).toBe(column)
    expect(result.cell.elevationM).toBe(height)
    expect(result.cell.lon).toBeCloseTo(lon, 12)
    expect(result.cell.lat).toBeCloseTo(lat, 12)
    const fromCoordinate = gridCellForCoordinate(grid, [lon, lat])
    expect(fromCoordinate).toEqual(result)
  })

  it('returns the containing native center instead of silently retaining an approximate feature center', () => {
    const result = gridCellForCoordinate(grid, [77.38, 18.48])
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') throw new Error('Published coordinate has native cell support')
    expect(result.cell.row).toBe(714)
    expect(result.cell.column).toBe(650)
    expect(result.cell.lon).toBeCloseTo(77.37995202842774, 12)
    expect(result.cell.lat).toBeCloseTo(18.48011353845034, 12)
    expect([result.cell.lon, result.cell.lat]).not.toEqual([77.38, 18.48])
  })

  it('uses independent native outer corners and half-open edges in north-down rows', () => {
    const [west, south, east, north] = terrainGridBounds(grid)
    expect(west).toBeCloseTo(77.33659457394239, 12)
    expect(south).toBeCloseTo(18.437093496062143, 12)
    expect(east).toBeCloseTo(77.42297207081594, 12)
    expect(north).toBeCloseTo(18.523470992935692, 12)
    expect(gridCellForCoordinate(grid, [west, north])).toMatchObject({ status: 'valid', cell: { row: 586, column: 522 } })
    expect(gridCellForCoordinate(grid, [east, north]).status).toBe('outside')
    expect(gridCellForCoordinate(grid, [west, south]).status).toBe('outside')
    expect(gridCellForCoordinate(grid, [east, south]).status).toBe('outside')
    expect(gridCellForCoordinate(grid, [east - 0.000001, south + 0.000001])).toMatchObject({ status: 'valid', cell: { row: 841, column: 777 } })
    expect(gridCellForCoordinate(grid, [west - 0.000001, north]).status).toBe('outside')
    expect(gridCellForCoordinate(grid, [west, north + 0.000001]).status).toBe('outside')
  })

  it('uses global source indices and rejects adjacent outside cells instead of snapping', () => {
    for (const [row, column] of [[585, 522], [586, 521], [842, 777], [841, 778], [0, 0]]) expect(getGridCell(grid, row, column).status).toBe('outside')
  })

  it.each([[NaN, 650], [714, Infinity], [714.5, 650], [714, 650.5]])('rejects invalid source indices %s,%s', (row, column) => {
    expect(getGridCell(grid, row, column).status).toBe('invalid')
  })

  it.each([[NaN, 18], [77, Infinity], [181, 18], [-181, 18], [77, 91], [77, -91], [437.38, 18.48]])('rejects unsupported signed coordinate %s,%s', (lon, lat) => {
    expect(gridCellForCoordinate(grid, [lon, lat]).status).toBe('invalid')
  })

  it('distinguishes coordinate-domain validity from crop coverage', () => {
    expect(gridCellForCoordinate(grid, [-180, -90]).status).toBe('outside')
    expect(gridCellForCoordinate(grid, [180, 90]).status).toBe('outside')
    expect(gridCellForCoordinate(grid, [18.48, 77.38]).status).toBe('outside')
  })

  it('propagates synthetic test-only NoData and corrupt storage without zero substitution', () => {
    const synthetic = { manifest, values: grid.values.slice() }
    synthetic.values[(714 - 586) * 256 + 650 - 522] = manifest.sourceGrid.noData
    expect(getGridCell(synthetic, 714, 650)).toMatchObject({ status: 'missing', reason: expect.stringMatching(/no interpolation or zero substitution/) })
    expect(gridCellForCoordinate(synthetic, [77.38, 18.48]).status).toBe('missing')
    synthetic.values[(714 - 586) * 256 + 650 - 522] = NaN
    expect(getGridCell(synthetic, 714, 650).status).toBe('invalid')
    expect(getGridCell({ manifest, values: new Float32Array(0) }, 714, 650).status).toBe('invalid')
  })

  it('preserves the binary NoData sentinel when supplied a synthetic test-only mask summary', () => {
    const syntheticBytes = binary.slice(0)
    new DataView(syntheticBytes).setFloat32(((700 - 586) * 256 + 700 - 522) * 4, manifest.sourceGrid.noData, true)
    const syntheticManifest = { ...manifest, summary: { ...manifest.summary, validCount: 65535, missingCount: 1 } }
    const synthetic: TerrainGrid = decodeTerrainGrid(syntheticManifest, syntheticBytes)
    expect(getGridCell(synthetic, 700, 700).status).toBe('missing')
  })

  it('rejects a changed dimension, source, projection, height reference, or encoding', () => {
    const mutations = [
      { grid: { ...sourceManifest.grid, startColumn: 523 } },
      { grid: { ...sourceManifest.grid, rows: 255 } },
      { source: { ...sourceManifest.source, sha256: '0'.repeat(64) } },
      { source: { ...sourceManifest.source, heightReference: 'areoid' } },
      { projection: { ...sourceManifest.projection, radiusM: 6378137 } },
      { projection: { ...sourceManifest.projection, latitudeConvention: 'planetographic' } },
      { projection: { ...sourceManifest.projection, standardParallelDeg: 18.48 } },
      { encoding: { ...sourceManifest.encoding, byteOrder: 'big-endian' } },
      { encoding: { ...sourceManifest.encoding, bytes: 262140 } },
      { sourceGrid: { ...sourceManifest.sourceGrid, noData: 0 } },
      { boundaryPolicy: 'validated feature accuracy' },
    ]
    for (const change of mutations) expect(() => parseTerrainGridManifest({ ...sourceManifest, ...change })).toThrow(/verified native contract/)
  })

  it('rejects malformed manifests, corner geometry, and native pixel fixtures', () => {
    expect(() => parseTerrainGridManifest(null)).toThrow(/must be an object/)
    expect(() => parseTerrainGridManifest({ ...sourceManifest, fixtures: [] })).toThrow(/seven independent/)
    expect(() => parseTerrainGridManifest({ ...sourceManifest, outerCorners: [] })).toThrow(/four native/)
    const changed = structuredClone(sourceManifest)
    changed.outerCorners[0].projectedM[0] += 20
    expect(() => parseTerrainGridManifest(changed)).toThrow(/geometry/)
    const nonfinite = structuredClone(sourceManifest)
    nonfinite.fixtures[0].elevationM = Infinity
    expect(() => parseTerrainGridManifest(nonfinite)).toThrow(/finite native float32/)
  })

  it('rejects truncated, nonfinite, shifted, and altered binary data', () => {
    expect(() => decodeTerrainGrid(manifest, binary.slice(0, -4))).toThrow(/binary size/)
    const nonfinite = binary.slice(0)
    new DataView(nonfinite).setFloat32(0, Infinity, true)
    expect(() => decodeTerrainGrid(manifest, nonfinite)).toThrow(/nonfinite/)
    const fixtureChange = binary.slice(0)
    new DataView(fixtureChange).setFloat32(0, -2376, true)
    expect(() => decodeTerrainGrid(manifest, fixtureChange)).toThrow(/independent Rasterio fixture/)
    const shifted = binary.slice(0)
    new Uint8Array(shifted).reverse()
    expect(() => decodeTerrainGrid(manifest, shifted)).toThrow()
  })
})
