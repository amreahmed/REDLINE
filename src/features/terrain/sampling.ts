import { toDisplayCoordinate } from '../mission/coordinates'
import type { MarsCoordinate, TargetId } from '../mission/types'
import type { TerrainSample, TerrainWindow, TerrainWindows, TerrainWindowSummary } from './types'

export const TERRAIN_SOURCE_ID = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0'
export const TERRAIN_SOURCE_HASH = '16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b'
export const TERRAIN_SOURCE_URL = `https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/${TERRAIN_SOURCE_ID}.tif`

const radiusM = 3396190
const originX = 4573663.250853
const originY = 1109693.140188
const pixelSizeM = 20
const noData = -3.4028226550889045e38
const centers: Record<TargetId, readonly [number, number]> = {
  jezero: [77.69, 18.41],
  belva: [77.38, 18.48],
  neretva: [77.20, 18.55],
}

function record(input: unknown, name: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`Terrain ${name} must be an object.`)
  return input as Record<string, unknown>
}

function requireEqual(input: Record<string, unknown>, expected: Record<string, unknown>, name: string) {
  for (const [key, value] of Object.entries(expected)) {
    if (input[key] !== value) throw new Error(`Terrain ${name}.${key} does not match the verified source contract.`)
  }
}

function integer(input: unknown, name: string, minimum: number): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < minimum) throw new Error(`Terrain ${name} must be an integer of at least ${minimum}.`)
  return input
}

/** This formula applies only to the audited spherical lat_ts=0 product. */
function projectedPixels(lon: number, lat: number): readonly [number, number] {
  const x = radiusM * lon * Math.PI / 180
  const y = radiusM * lat * Math.PI / 180
  return [(x - originX) / pixelSizeM, (originY - y) / pixelSizeM]
}

// Remove arithmetic ULP drift at documented pixel edges (<0.2 micrometre).
// Edges remain half-open: west/north inclusive, east/south exclusive.
function snapPixelEdge(value: number): number {
  const nearest = Math.round(value)
  return Math.abs(value - nearest) < 1e-8 ? nearest : value
}

function parseWindow(input: unknown): TerrainWindow {
  const window = record(input, 'window')
  if (window.id !== 'jezero' && window.id !== 'belva' && window.id !== 'neretva') throw new Error('Terrain window has an unsupported reference ID.')
  const center = centers[window.id]
  if (!Array.isArray(window.center) || window.center.length !== 2 || window.center[0] !== center[0] || window.center[1] !== center[1]) throw new Error(`Terrain ${window.id} window has an unverified reference center.`)
  if (window.halfWidthDeg !== 0.005) throw new Error('Terrain window must retain the documented decimal-display neighborhood.')
  const startColumn = integer(window.startColumn, 'startColumn', 0)
  const startRow = integer(window.startRow, 'startRow', 0)
  const columns = integer(window.columns, 'window columns', 1)
  const rows = integer(window.rows, 'window rows', 1)
  const [west, north] = projectedPixels(center[0] - 0.005, center[1] + 0.005)
  const [east, south] = projectedPixels(center[0] + 0.005, center[1] - 0.005)
  if (startColumn !== Math.floor(west) || startRow !== Math.floor(north) || startColumn + columns !== Math.ceil(east) || startRow + rows !== Math.ceil(south)) throw new Error(`Terrain ${window.id} window is shifted or does not cover its documented native cells.`)
  if (startColumn + columns > 1596 || startRow + rows > 1512) throw new Error('Terrain window exceeds numerical source coverage.')
  if (!Array.isArray(window.values) || window.values.length !== columns * rows) throw new Error('Terrain window sample count does not match its native dimensions.')
  const values = window.values.map((value: unknown) => {
    if (value === null) return null
    if (typeof value !== 'number' || !Number.isFinite(value) || value === noData || Math.fround(value) !== value) throw new Error('Terrain cells must contain native finite float32 values or explicit null NoData.')
    return value
  })
  return { id: window.id, center: [center[0], center[1]], halfWidthDeg: 0.005, startColumn, startRow, columns, rows, values }
}

/** Validate downloaded metadata/windows before exposing any numeric sample. */
export function parseTerrainWindows(input: unknown): TerrainWindows {
  const terrain = record(input, 'document')
  if (terrain.schemaVersion !== 1) throw new Error('Terrain document uses an unsupported schema version.')
  const source = record(terrain.source, 'source')
  requireEqual(source, { productId: TERRAIN_SOURCE_ID, sha256: TERRAIN_SOURCE_HASH, url: TERRAIN_SOURCE_URL, units: 'm', heightReference: 'provider-declared-iau-sphere-unvalidated' }, 'source')
  const projection = record(terrain.projection, 'projection')
  requireEqual(projection, { kind: 'equirectangular', radiusM, standardParallelDeg: 0, centralMeridianDeg: 0, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive' }, 'projection')
  const grid = record(terrain.grid, 'grid')
  requireEqual(grid, { columns: 1596, rows: 1512, originX, originY, pixelSizeM, noData }, 'grid')
  if (!Array.isArray(terrain.windows) || terrain.windows.length !== 3) throw new Error('Terrain document must contain the three verified reference windows.')
  const windows = terrain.windows.map(parseWindow)
  if (new Set(windows.map((window) => window.id)).size !== 3) throw new Error('Terrain reference windows must have unique IDs.')
  return {
    schemaVersion: 1,
    source: { productId: TERRAIN_SOURCE_ID, sha256: TERRAIN_SOURCE_HASH, url: TERRAIN_SOURCE_URL, units: 'm', heightReference: 'provider-declared-iau-sphere-unvalidated' },
    projection: { kind: 'equirectangular', radiusM, standardParallelDeg: 0, centralMeridianDeg: 0, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive' },
    grid: { columns: 1596, rows: 1512, originX, originY, pixelSizeM, noData },
    windows,
  }
}

/** Internal native-cell inspection, not an elevation observation at a named site. */
export function sampleTerrain(terrain: TerrainWindows, coordinate: MarsCoordinate): TerrainSample {
  const display = toDisplayCoordinate(coordinate)
  if (!display) return { status: 'invalid', reason: 'Unsupported or invalid Mars coordinate convention or range.' }
  const [pixelColumn, pixelRow] = projectedPixels(...display)
  const column = Math.floor(snapPixelEdge(pixelColumn))
  const row = Math.floor(snapPixelEdge(pixelRow))
  if (column < 0 || column >= terrain.grid.columns || row < 0 || row >= terrain.grid.rows) return { status: 'outside', reason: 'Coordinate is outside the numerical source grid.' }
  const window = terrain.windows.find((candidate) => column >= candidate.startColumn && column < candidate.startColumn + candidate.columns && row >= candidate.startRow && row < candidate.startRow + candidate.rows)
  if (!window) return { status: 'outside', reason: 'No extracted numerical terrain window covers this coordinate.' }
  const elevationM = window.values[(row - window.startRow) * window.columns + column - window.startColumn]
  if (elevationM === null || elevationM === undefined || !Number.isFinite(elevationM) || elevationM === terrain.grid.noData) return { status: 'nodata', reason: 'The native terrain cell is missing; no interpolation or zero substitution is applied.' }
  return { status: 'valid', elevationM, row, column, sourceId: terrain.source.productId }
}

export function summarizeWindow(window: TerrainWindow): TerrainWindowSummary {
  let validCount = 0
  let missingCount = 0
  let min: number | null = null
  let max: number | null = null
  for (const value of window.values) {
    if (value === null || !Number.isFinite(value) || value === noData) { missingCount += 1; continue }
    validCount += 1
    min = min === null ? value : Math.min(min, value)
    max = max === null ? value : Math.max(max, value)
  }
  return { validCount, missingCount, min, max }
}
