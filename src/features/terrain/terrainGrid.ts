import { TERRAIN_SOURCE_HASH, TERRAIN_SOURCE_ID, TERRAIN_SOURCE_URL } from './sampling'
import type { GridCellResult, GridCorner, GridFixture, TerrainGrid, TerrainGridManifest } from './gridTypes'

export const TERRAIN_GRID_BINARY_URL = '/data/jezero-terrain-grid.f32'
export const TERRAIN_GRID_BINARY_SHA256 = '4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8'
export const TERRAIN_GRID_BINARY_BYTES = 262144

const source = {
  productId: TERRAIN_SOURCE_ID, sha256: TERRAIN_SOURCE_HASH, url: TERRAIN_SOURCE_URL,
  units: 'm', heightReference: 'provider-declared-iau-sphere-unvalidated',
} as const
const projection = {
  kind: 'equirectangular', radiusM: 3396190, standardParallelDeg: 0, centralMeridianDeg: 0,
  latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeRange: 'signed-180',
} as const
const sourceGrid = {
  columns: 1596, rows: 1512, originX: 4573663.250853, originY: 1109693.140188,
  pixelSizeM: 20, noData: -3.4028226550889045e38,
} as const
const crop = { startColumn: 522, startRow: 586, columns: 256, rows: 256 } as const
const encoding = {
  url: TERRAIN_GRID_BINARY_URL, sampleType: 'float32', byteOrder: 'little-endian', layout: 'row-major',
  bytes: TERRAIN_GRID_BINARY_BYTES, sha256: TERRAIN_GRID_BINARY_SHA256,
} as const
const processing = 'native cell extraction only; no resampling, interpolation, datum change, or cell alteration'
const boundaryPolicy = 'fixed display-selected prototype crop; boundaries do not represent feature accuracy or a validated traverse area'

function record(input: unknown, name: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`Terrain grid ${name} must be an object.`)
  return input as Record<string, unknown>
}

function requireEqual(input: unknown, expected: Record<string, unknown>, name: string): void {
  const actual = record(input, name)
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) throw new Error(`Terrain grid ${name}.${key} does not match the verified native contract.`)
  }
}

function pair(input: unknown, name: string): readonly [number, number] {
  if (!Array.isArray(input) || input.length !== 2 || !input.every((value: unknown) => typeof value === 'number' && Number.isFinite(value))) throw new Error(`Terrain grid ${name} must contain two finite numbers.`)
  return [input[0] as number, input[1] as number]
}

function samePair(actual: readonly [number, number], expected: readonly [number, number], name: string): void {
  if (actual.some((value, index) => Math.abs(value - expected[index]) > 1e-12)) throw new Error(`Terrain grid ${name} does not match its native source-cell geometry.`)
}

/** Only applies to the audited spherical equirectangular lat_ts=lon_0=0 source. */
function sourceEdgeCoordinate(row: number, column: number): readonly [number, number] {
  const x = sourceGrid.originX + column * sourceGrid.pixelSizeM
  const y = sourceGrid.originY - row * sourceGrid.pixelSizeM
  return [x / projection.radiusM * 180 / Math.PI, y / projection.radiusM * 180 / Math.PI]
}

function parseCorners(input: unknown): readonly GridCorner[] {
  const edges = [
    ['north-west', crop.startRow, crop.startColumn],
    ['north-east', crop.startRow, crop.startColumn + crop.columns],
    ['south-east', crop.startRow + crop.rows, crop.startColumn + crop.columns],
    ['south-west', crop.startRow + crop.rows, crop.startColumn],
  ] as const
  if (!Array.isArray(input) || input.length !== edges.length) throw new Error('Terrain grid must include four native outer corners.')
  return edges.map(([name, row, column], index) => {
    const corner = record(input[index], 'corner')
    requireEqual(corner, { name, sourceRowEdge: row, sourceColumnEdge: column }, 'corner')
    const projectedM = pair(corner.projectedM, 'corner.projectedM')
    const coordinate = pair(corner.coordinate, 'corner.coordinate')
    samePair(projectedM, [sourceGrid.originX + column * 20, sourceGrid.originY - row * 20], 'corner projected coordinates')
    samePair(coordinate, sourceEdgeCoordinate(row, column), 'corner geographic coordinates')
    return { name, sourceRowEdge: row, sourceColumnEdge: column, projectedM, coordinate }
  })
}

function parseFixtures(input: unknown): readonly GridFixture[] {
  const indices = [[586, 522], [586, 777], [841, 777], [841, 522], [714, 650], [650, 580], [800, 730]] as const
  if (!Array.isArray(input) || input.length !== indices.length) throw new Error('Terrain grid must retain the seven independent Rasterio cell fixtures.')
  return indices.map(([row, column], index) => {
    const fixture = record(input[index], 'fixture')
    requireEqual(fixture, { row, column }, 'fixture')
    const pixelCenterM = pair(fixture.pixelCenterM, 'fixture.pixelCenterM')
    const coordinate = pair(fixture.coordinate, 'fixture.coordinate')
    samePair(pixelCenterM, [sourceGrid.originX + (column + 0.5) * 20, sourceGrid.originY - (row + 0.5) * 20], 'fixture center')
    samePair(coordinate, sourceEdgeCoordinate(row + 0.5, column + 0.5), 'fixture geographic center')
    const elevationM = fixture.elevationM
    if (elevationM !== null && (typeof elevationM !== 'number' || !Number.isFinite(elevationM) || Math.fround(elevationM) !== elevationM || elevationM === sourceGrid.noData)) throw new Error('Terrain grid fixture must retain finite native float32 height or explicit null NoData.')
    return { row, column, pixelCenterM, coordinate, elevationM }
  })
}

/** Reject projection, encoding, source, and crop changes before decoding numbers. */
export function parseTerrainGridManifest(input: unknown): TerrainGridManifest {
  const manifest = record(input, 'manifest')
  requireEqual(manifest, { schemaVersion: 1, processing, boundaryPolicy }, 'manifest')
  requireEqual(manifest.source, source, 'source')
  requireEqual(manifest.projection, projection, 'projection')
  requireEqual(manifest.sourceGrid, sourceGrid, 'sourceGrid')
  requireEqual(manifest.grid, crop, 'grid')
  requireEqual(manifest.encoding, encoding, 'encoding')
  const summary = { validCount: 65536, missingCount: 0, minM: -2560.28857421875, maxM: -2363.345703125 } as const
  requireEqual(manifest.summary, summary, 'summary')
  return {
    schemaVersion: 1, source, projection, sourceGrid, grid: crop, encoding,
    processing, boundaryPolicy, summary, outerCorners: parseCorners(manifest.outerCorners), fixtures: parseFixtures(manifest.fixtures),
  }
}

/** The loader verifies hashes first; decode explicitly so host byte order is irrelevant. */
export function decodeTerrainGrid(manifest: TerrainGridManifest, bytes: ArrayBuffer): TerrainGrid {
  if (bytes.byteLength !== manifest.encoding.bytes) throw new Error('Terrain grid binary size does not match its native cell count.')
  const view = new DataView(bytes)
  const values = new Float32Array(manifest.grid.rows * manifest.grid.columns)
  let validCount = 0
  let missingCount = 0
  let minM = Infinity
  let maxM = -Infinity
  for (let index = 0; index < values.length; index += 1) {
    const value = view.getFloat32(index * 4, true)
    if (!Number.isFinite(value)) throw new Error('Terrain grid contains a nonfinite source cell; numeric inspection is unavailable.')
    values[index] = value
    if (value === manifest.sourceGrid.noData) { missingCount += 1; continue }
    validCount += 1
    minM = Math.min(minM, value)
    maxM = Math.max(maxM, value)
  }
  const summary = manifest.summary
  if (validCount !== summary.validCount || missingCount !== summary.missingCount || (validCount ? minM : null) !== summary.minM || (validCount ? maxM : null) !== summary.maxM) throw new Error('Terrain grid samples do not match the independent native summary.')
  for (const fixture of manifest.fixtures) {
    const value = values[(fixture.row - manifest.grid.startRow) * manifest.grid.columns + fixture.column - manifest.grid.startColumn]
    if ((value === manifest.sourceGrid.noData ? null : value) !== fixture.elevationM) throw new Error('Terrain grid sample disagrees with an independent Rasterio fixture.')
  }
  return { manifest, values }
}

/** Outer crop bounds [west, south, east, north], in signed planetocentric degrees. */
export function terrainGridBounds(grid: TerrainGrid): [number, number, number, number] {
  const { startRow, startColumn, rows, columns } = grid.manifest.grid
  const [west, north] = sourceEdgeCoordinate(startRow, startColumn)
  const [east, south] = sourceEdgeCoordinate(startRow + rows, startColumn + columns)
  return [west, south, east, north]
}

/** Indices are global source rows/columns; never snap missing/outside inputs. */
export function getGridCell(grid: TerrainGrid, row: number, column: number): GridCellResult {
  if (!Number.isSafeInteger(row) || !Number.isSafeInteger(column)) return { status: 'invalid', reason: 'Terrain cell indices must be finite integer source rows and columns.' }
  const { startRow, startColumn, rows, columns } = grid.manifest.grid
  if (row < startRow || row >= startRow + rows || column < startColumn || column >= startColumn + columns) return { status: 'outside', reason: 'The selected source cell is outside the fixed prototype terrain crop.' }
  if (grid.values.length !== rows * columns) return { status: 'invalid', reason: 'Terrain cell storage does not match the validated crop dimensions.' }
  const elevationM = grid.values[(row - startRow) * columns + column - startColumn]
  if (!Number.isFinite(elevationM)) return { status: 'invalid', reason: 'The selected terrain cell is nonfinite; numeric inspection is unavailable.' }
  if (elevationM === grid.manifest.sourceGrid.noData) return { status: 'missing', reason: 'The native terrain cell is NoData; no interpolation or zero substitution is applied.' }
  const [lon, lat] = sourceEdgeCoordinate(row + 0.5, column + 0.5)
  return { status: 'valid', cell: { row, column, lon, lat, elevationM, sourceId: grid.manifest.source.productId } }
}

// Remove arithmetic ULP drift at native pixel edges (<0.2 micrometre).
// West/north edges stay inclusive; east/south outer edges stay exclusive.
function snapPixelEdge(value: number): number {
  const nearest = Math.round(value)
  return Math.abs(value - nearest) < 1e-8 ? nearest : value
}

/** [lon, lat] must be signed east-positive, planetocentric; returns native center. */
export function gridCellForCoordinate(grid: TerrainGrid, coordinate: readonly [number, number]): GridCellResult {
  if (!Array.isArray(coordinate) || coordinate.length !== 2 || !coordinate.every(Number.isFinite) || coordinate[0] < -180 || coordinate[0] > 180 || coordinate[1] < -90 || coordinate[1] > 90) return { status: 'invalid', reason: 'Use finite signed east-positive longitude and planetocentric latitude within Mars coordinate ranges.' }
  const [lon, lat] = coordinate
  const x = projection.radiusM * lon * Math.PI / 180
  const y = projection.radiusM * lat * Math.PI / 180
  const column = Math.floor(snapPixelEdge((x - sourceGrid.originX) / sourceGrid.pixelSizeM))
  const row = Math.floor(snapPixelEdge((sourceGrid.originY - y) / sourceGrid.pixelSizeM))
  return getGridCell(grid, row, column)
}
