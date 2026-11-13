import { describe, expect, it } from 'vitest'
import sourceWindows from '../../../public/data/jezero-terrain-windows.json'
import rasterInspection from '../../../docs/evidence/terrain-validation/raster-inspection.json'
import type { MarsCoordinate } from '../mission/types'
import { parseTerrainWindows, sampleTerrain, summarizeWindow, TERRAIN_SOURCE_ID } from './sampling'
import type { TerrainWindows } from './types'

const terrain = () => parseTerrainWindows(structuredClone(sourceWindows))
const coordinate = (lon: number, lat: number): MarsCoordinate => ({ lon, lat, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeDomain: '-180-180' })
const pixelCoordinate = (column: number, row: number) => coordinate(
  (4573663.250853 + column * 20) * 180 / (Math.PI * 3396190),
  (1109693.140188 - row * 20) * 180 / (Math.PI * 3396190),
)

describe('verified native terrain windows', () => {
  it('retains source provenance and actual independent Rasterio native samples', () => {
    const data = terrain()
    expect(data.source.productId).toBe(TERRAIN_SOURCE_ID)
    for (const fixture of rasterInspection.fixtures) {
      expect(sampleTerrain(data, coordinate(fixture.coordinate[0], fixture.coordinate[1]))).toEqual({
        status: 'valid', row: fixture.row, column: fixture.column, elevationM: fixture.value, sourceId: TERRAIN_SOURCE_ID,
      })
      // Independent Rasterio native cell centers, not app-generated round trips.
      const center = coordinate(fixture.pixelCenter[0] * 180 / (Math.PI * 3396190), fixture.pixelCenter[1] * 180 / (Math.PI * 3396190))
      expect(sampleTerrain(data, center)).toMatchObject({ status: 'valid', row: fixture.row, column: fixture.column, elevationM: fixture.value })
    }
  })

  it('matches Rasterio-derived window ranges and support counts without rounding', () => {
    const data = terrain()
    for (const fixture of rasterInspection.windowSummary) {
      const window = data.windows.find((candidate) => candidate.id === fixture.id)!
      expect(summarizeWindow(window)).toEqual({ validCount: fixture.rows * fixture.columns, missingCount: fixture.missingCount, min: fixture.rangeM[0], max: fixture.rangeM[1] })
    }
  })

  it('does not mutate untrusted metadata or array values during validation', () => {
    const original = structuredClone(sourceWindows)
    const data = parseTerrainWindows(original)
    expect(original).toEqual(sourceWindows)
    expect(data.windows[0].values).not.toBe(original.windows[0].values)
  })

  it.each([
    ['schema', (data: typeof sourceWindows) => { data.schemaVersion = 2 }],
    ['source identity', (data: typeof sourceWindows) => { data.source.productId = 'different-dem' }],
    ['source hash', (data: typeof sourceWindows) => { data.source.sha256 = 'unknown' }],
    ['source URL', (data: typeof sourceWindows) => { data.source.url = 'https://example.test/dem.tif' }],
    ['units', (data: typeof sourceWindows) => { data.source.units = 'feet' }],
    ['height reference', (data: typeof sourceWindows) => { data.source.heightReference = 'areoid' }],
    ['Earth radius', (data: typeof sourceWindows) => { data.projection.radiusM = 6378137 }],
    ['other standard parallel', (data: typeof sourceWindows) => { data.projection.standardParallelDeg = 18.4663 }],
    ['longitude direction', (data: typeof sourceWindows) => { data.projection.longitudeDirection = 'west-positive' }],
    ['grid spacing', (data: typeof sourceWindows) => { data.grid.pixelSizeM = 6 }],
    ['source NoData', (data: typeof sourceWindows) => { data.grid.noData = 0 }],
    ['missing window', (data: typeof sourceWindows) => { data.windows.pop() }],
    ['duplicate IDs', (data: typeof sourceWindows) => { data.windows[0] = structuredClone(data.windows[1]) }],
    ['center', (data: typeof sourceWindows) => { data.windows[0].center[0] = 77.7 }],
    ['neighborhood', (data: typeof sourceWindows) => { data.windows[0].halfWidthDeg = 0.01 }],
    ['shifted row', (data: typeof sourceWindows) => { data.windows[0].startRow += 1 }],
    ['fractional column', (data: typeof sourceWindows) => { data.windows[0].startColumn += 0.5 }],
    ['sample length', (data: typeof sourceWindows) => { data.windows[0].values.pop() }],
    ['NaN', (data: typeof sourceWindows) => { data.windows[0].values[0] = Number.NaN }],
    ['infinity', (data: typeof sourceWindows) => { data.windows[0].values[0] = Number.POSITIVE_INFINITY }],
    ['raw NoData', (data: typeof sourceWindows) => { data.windows[0].values[0] = data.grid.noData }],
    ['non-native precision', (data: typeof sourceWindows) => { data.windows[0].values[0] = 1.1 }],
  ])('rejects an unverified %s contract', (_name, change) => {
    const data = structuredClone(sourceWindows)
    change(data)
    expect(() => parseTerrainWindows(data)).toThrow(/Terrain/i)
  })

  it.each([null, undefined, [], {}, { schemaVersion: 1, source: [] }])('rejects malformed runtime document %j', (data) => {
    expect(() => parseTerrainWindows(data)).toThrow(/Terrain/)
  })
})

describe('native terrain missing support and cell conventions', () => {
  it('preserves synthetic null NoData and does not substitute or interpolate neighbor heights', () => {
    // Synthetic test-only gap: the actual three source windows contain no missing cells.
    const data = terrain()
    const fixture = rasterInspection.fixtures[0]
    const window = data.windows[0]
    const values = [...window.values]
    values[(fixture.row - window.startRow) * window.columns + fixture.column - window.startColumn] = null
    const withGap: TerrainWindows = { ...data, windows: [{ ...window, values }, ...data.windows.slice(1)] }
    expect(sampleTerrain(withGap, coordinate(fixture.coordinate[0], fixture.coordinate[1]))).toMatchObject({ status: 'nodata' })
    expect(summarizeWindow(withGap.windows[0])).toMatchObject({ missingCount: 1, validCount: values.length - 1 })
    expect(summarizeWindow({ ...window, values: values.map(() => null) })).toEqual({ validCount: 0, missingCount: values.length, min: null, max: null })
  })

  it('classifies absent windows independently from outside-raster coordinates', () => {
    const data = terrain()
    expect(sampleTerrain(data, coordinate(77.5, 18.5))).toEqual({ status: 'outside', reason: 'No extracted numerical terrain window covers this coordinate.' })
    expect(sampleTerrain(data, coordinate(0, 0))).toEqual({ status: 'outside', reason: 'Coordinate is outside the numerical source grid.' })
  })

  it('uses north-down containing cells and half-open native window edges', () => {
    const data = terrain()
    const window = data.windows[0]
    expect(sampleTerrain(data, pixelCoordinate(window.startColumn, window.startRow))).toMatchObject({ status: 'valid', row: window.startRow, column: window.startColumn, elevationM: window.values[0] })
    expect(sampleTerrain(data, pixelCoordinate(window.startColumn + 0.5, window.startRow + 1.5))).toMatchObject({ status: 'valid', row: window.startRow + 1, column: window.startColumn, elevationM: window.values[window.columns] })
    expect(sampleTerrain(data, pixelCoordinate(window.startColumn + window.columns, window.startRow + 0.5))).toMatchObject({ status: 'outside' })
    expect(sampleTerrain(data, pixelCoordinate(window.startColumn + 0.5, window.startRow + window.rows))).toMatchObject({ status: 'outside' })
    expect(sampleTerrain(data, pixelCoordinate(window.startColumn - 0.01, window.startRow + 0.5))).toMatchObject({ status: 'outside' })
  })

  it('matches the published native upper-left corner and includes only north/west source edges', () => {
    // Synthetic test-only windows isolate boundary indexing; their values are not observations.
    const data = terrain()
    const synthetic: TerrainWindows = { ...data, windows: [{ ...data.windows[0], startColumn: 0, startRow: 0, columns: 1, rows: 1, values: [1] }] }
    expect(sampleTerrain(synthetic, coordinate(77.16046545922367, 18.721194481872804))).toMatchObject({ status: 'valid', row: 0, column: 0 })
    expect(sampleTerrain(data, pixelCoordinate(1596, 1))).toMatchObject({ status: 'outside' })
    expect(sampleTerrain(data, pixelCoordinate(1, 1512))).toMatchObject({ status: 'outside' })
  })

  it('normalizes supported longitude domains without accepting other Mars conventions', () => {
    const data = terrain()
    expect(sampleTerrain(data, { ...coordinate(77.69, 18.41), longitudeDomain: '0-360' })).toMatchObject({ status: 'valid', column: 1569, row: 922 })
    expect(sampleTerrain(data, { ...coordinate(359, 18.41), longitudeDomain: '0-360' })).toMatchObject({ status: 'outside' })
    expect(sampleTerrain(data, { ...coordinate(77.69, 18.41), latitudeConvention: 'planetographic' })).toMatchObject({ status: 'invalid' })
    expect(sampleTerrain(data, { ...coordinate(77.69, 18.41), longitudeDirection: 'west-positive' })).toMatchObject({ status: 'invalid' })
    expect(sampleTerrain(data, coordinate(Number.NaN, 18.41))).toMatchObject({ status: 'invalid' })
    expect(sampleTerrain(data, coordinate(77.69, 90.1))).toMatchObject({ status: 'invalid' })
  })
})
