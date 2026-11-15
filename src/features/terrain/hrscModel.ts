import type { TerrainModelGrid } from './modelTypes'

export const HRSC_MODEL_SOURCE_HASH = '5d7c16b7589df237b3dbb45365cff2b94fc28ffd46764b336783f58bb60c4fdc'
export const HRSC_MODEL_MANIFEST_URL = '/data/hrsc-terrain-model.json'
export const HRSC_MODEL_MANIFEST_BYTES = 2467
export const HRSC_MODEL_MANIFEST_SHA256 = '36f932f7abbb9d193c058187c41219bbd417155dad64d83b86e1eab11573d5bb'
export const HRSC_MODEL_BINARY_URL = '/data/hrsc-terrain-model.i16'
export const HRSC_MODEL_BINARY_BYTES = 21218
export const HRSC_MODEL_BINARY_SHA256 = 'e385f36da8ea9137bdd7cece3ac858a64de1bbf5e036ecc01e942d7e9a5439f2'
export const HRSC_MODEL_VALIDITY_URL = '/data/hrsc-terrain-model.u8'
export const HRSC_MODEL_VALIDITY_BYTES = 10609
export const HRSC_MODEL_VALIDITY_SHA256 = 'c7129c480eb63e9537de9c8b4678fcbebcabac8ae3450a35bdec8e2a0a63da67'

/** A separate source contract: never inherits the unresolved CTX interpretation. */
const contract = {
  schemaVersion: 1,
  source: {
    productId: 'HMC_13E10_DT5',
    url: 'https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_dt5.tif',
    sourceHash: HRSC_MODEL_SOURCE_HASH,
    sourceHashDefinition: 'SHA-256 of preserved hrsc-native-reference.json; binds exact TIFF metadata, native row receipts, samples and masks; not a full-TIFF checksum',
    fullResourceSha256: null,
    resourceBytes: 638313017,
    scientificReleaseVersion: null,
    acquisitionDates: null,
    units: 'm',
    verticalReference: 'Positive-up height above the 3,396,000 m sphere (HRSC DT5)',
    verticalCitation: 'Height above spheroid with radius 3396.0 km|',
    attribution: 'Terrain data: ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/igo/',
    providerTermsUrl: 'https://hrscteam.dlr.de/imprint_hrsc_en.php',
    authorization: 'provider-dem-model',
    qualification: 'Sphere-relative provider DEM model. Physical slope accuracy, local uncertainty, precise feature registration, hazards, and rover/human safety remain unverified.',
  },
  projection: {
    kind: 'equirectangular', radiusM: 3396000, standardParallelDeg: 0,
    centralMeridianDeg: 0, latitudeOfOriginDeg: 0, falseEastingM: 0, falseNorthingM: 0,
    latitudeConvention: 'planetocentric-on-sphere', longitudeDirection: 'east-positive',
    longitudeRange: '0-360', units: 'm',
  },
  grid: { rows: 103, columns: 103, startRow: 13605, startColumn: 11661,
    originXM: 4583825, originYM: 1097925.0000000002, pixelWidthM: 50, pixelHeightM: -50 },
  encoding: { url: HRSC_MODEL_BINARY_URL, sampleType: 'int16', byteOrder: 'little-endian',
    layout: 'row-major', scale: 1, offset: 0, noData: -32768, quantizationM: 1, bytes: HRSC_MODEL_BINARY_BYTES, sha256: HRSC_MODEL_BINARY_SHA256 },
  validity: { url: HRSC_MODEL_VALIDITY_URL, sampleType: 'uint8', validValue: 1,
    noDataValue: 0, bytes: HRSC_MODEL_VALIDITY_BYTES, sha256: HRSC_MODEL_VALIDITY_SHA256 },
  summary: { validCount: 10609, missingCount: 0, minM: -4039, maxM: -3854 },
  processing: 'Native spatial subset with separately supplied validity mask; original integer heights retained. No resampling, interpolation, height correction, or CTX modification.',
  coverageQualification: '103 x 103 native rectangle around the preserved CTX crop, including 408 border-overhang cells. Bounds are declared grid geometry, not a surveyed route area. Outside support and incomplete metric neighborhoods remain unknown.',
} as const

export type HrscModelManifest = typeof contract

function requireContract(actual: unknown, expected: unknown, path: string): void {
  const failure = () => new Error(`Terrain model ${path} does not match the pinned native HRSC contract.`)
  if (expected === null || typeof expected !== 'object') {
    if (actual !== expected) throw failure()
    return
  }
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) throw failure()
  const expectedObject = expected as Record<string, unknown>
  const actualObject = actual as Record<string, unknown>
  const keys = Object.keys(expectedObject)
  if (Object.keys(actualObject).length !== keys.length || keys.some(key => !Object.hasOwn(actualObject, key))) throw failure()
  for (const key of keys) requireContract(actualObject[key], expectedObject[key], `${path}.${key}`)
}

/** Closed contract includes limitations and rejects injected scientific claims. */
export function parseHrscModelManifest(input: unknown): HrscModelManifest {
  requireContract(input, contract, 'manifest')
  return structuredClone(contract)
}

/** Caller verifies all asset checksums first. No source values are corrected. */
export function decodeHrscModel(input: HrscModelManifest, sampleBytes: ArrayBuffer, validityBytes: ArrayBuffer): TerrainModelGrid {
  const manifest = parseHrscModelManifest(input)
  if (sampleBytes.byteLength !== manifest.encoding.bytes || validityBytes.byteLength !== manifest.validity.bytes) throw new Error('Terrain model native sample or mask byte size has changed.')
  const view = new DataView(sampleBytes)
  const values = new Float32Array(manifest.grid.rows * manifest.grid.columns)
  const valid = new Uint8Array(validityBytes.slice(0))
  let validCount = 0
  let missingCount = 0
  let minM = Infinity
  let maxM = -Infinity
  for (let index = 0; index < values.length; index += 1) {
    const value = view.getInt16(index * 2, true)
    const mask = valid[index]
    if ((mask !== 0 && mask !== 1) || (mask === 0) !== (value === manifest.encoding.noData)) throw new Error('Terrain model validity mask disagrees with native NoData or contains an invalid state.')
    // Every int16 value is exactly representable in float32, including NoData.
    values[index] = value
    if (!mask) { missingCount += 1; continue }
    validCount += 1
    minM = Math.min(minM, value)
    maxM = Math.max(maxM, value)
  }
  if (validCount !== manifest.summary.validCount || missingCount !== manifest.summary.missingCount || minM !== manifest.summary.minM || maxM !== manifest.summary.maxM) throw new Error('Terrain model samples do not match the preserved native HRSC summary.')
  return {
    ...manifest.grid, referenceRadiusM: manifest.projection.radiusM, values, valid,
    source: {
      productId: manifest.source.productId, gridHash: manifest.encoding.sha256,
      sourceHash: manifest.source.sourceHash, verticalReference: manifest.source.verticalReference,
      attribution: manifest.source.attribution, qualification: manifest.source.qualification,
      authorization: manifest.source.authorization,
    },
  }
}
