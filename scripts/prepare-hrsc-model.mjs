/** Copy the preserved native HRSC DT5 evidence without resampling or CTX edits.
 * node scripts/prepare-hrsc-model.mjs [--verify-saved]
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const evidence = new URL('docs/evidence/scientific-gate-resolution/hrsc/', root)
const sourceHash = '5d7c16b7589df237b3dbb45365cff2b94fc28ffd46764b336783f58bb60c4fdc'
const gridHash = 'e385f36da8ea9137bdd7cece3ac858a64de1bbf5e036ecc01e942d7e9a5439f2'
const validityHash = 'c7129c480eb63e9537de9c8b4678fcbebcabac8ae3450a35bdec8e2a0a63da67'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const pinned = (url, sha) => {
  const bytes = readFileSync(url)
  assert.equal(hash(bytes), sha, `Changed preserved input: ${fileURLToPath(url)}`)
  return bytes
}
const preservedCtx = [
  ['public/data/jezero-terrain-grid.f32', '4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8'],
  ['public/data/jezero-terrain-grid.json', 'fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9'],
]
for (const [path, sha] of preservedCtx) pinned(new URL(path, root), sha)
const reference = JSON.parse(pinned(new URL('hrsc-native-reference.json', evidence), sourceHash).toString('utf8'))
const samples = pinned(new URL('hrsc-dt5-native.i16', evidence), gridHash)
const validity = pinned(new URL('hrsc-dt5-validity.u8', evidence), validityHash)
assert.deepEqual(reference.grid, { startRow: 13605, startColumn: 11661, rows: 103, columns: 103 })
assert.deepEqual(reference.cropGeotransform, [4583825, 50, 0, 1097925.0000000002, 0, -50])
assert.equal(reference.products.dt5.productId, 'HMC_13E10_DT5')
assert.equal(reference.products.dt5.verticalReference, 'Height above spheroid with radius 3396.0 km|')
assert.equal(reference.products.dt5.units, 'm')
assert.equal(reference.products.dt5.scale, 1)
assert.equal(reference.products.dt5.offset, 0)
assert.equal(reference.products.dt5.noData, -32768)
assert.equal(reference.projection.radiusM, 3396000)
assert.equal(reference.projection.projString, '+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396000 +units=m +no_defs +type=crs')
assert.equal(samples.byteLength, 21218)
assert.equal(validity.byteLength, 10609)
const values = Array.from({ length: 10609 }, (_, i) => samples.readInt16LE(i * 2))
assert(values.every((value, i) => value !== -32768 && validity[i] === 1))
assert.equal(Math.min(...values), -4039)
assert.equal(Math.max(...values), -3854)
assert.equal(reference.coverage.pairedValidCount, 10609)

const manifest = {
  schemaVersion: 1,
  source: {
    productId: 'HMC_13E10_DT5',
    url: 'https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_dt5.tif',
    sourceHash,
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
  encoding: { url: '/data/hrsc-terrain-model.i16', sampleType: 'int16', byteOrder: 'little-endian',
    layout: 'row-major', scale: 1, offset: 0, noData: -32768, quantizationM: 1, bytes: 21218, sha256: gridHash },
  validity: { url: '/data/hrsc-terrain-model.u8', sampleType: 'uint8', validValue: 1,
    noDataValue: 0, bytes: 10609, sha256: validityHash },
  summary: { validCount: 10609, missingCount: 0, minM: -4039, maxM: -3854 },
  processing: 'Native spatial subset with separately supplied validity mask; original integer heights retained. No resampling, interpolation, height correction, or CTX modification.',
  coverageQualification: '103 x 103 native rectangle around the preserved CTX crop, including 408 border-overhang cells. Bounds are declared grid geometry, not a surveyed route area. Outside support and incomplete metric neighborhoods remain unknown.',
}
const outputs = [
  ['public/data/hrsc-terrain-model.json', Buffer.from(JSON.stringify(manifest) + '\n', 'utf8')],
  ['public/data/hrsc-terrain-model.i16', samples],
  ['public/data/hrsc-terrain-model.u8', validity],
]
const verify = process.argv.includes('--verify-saved')
for (const [path, bytes] of outputs) {
  const url = new URL(path, root)
  if (existsSync(url)) assert(readFileSync(url).equals(bytes), `Existing output differs; review before replacing ${path}`)
  else {
    assert(!verify, `Missing prepared asset: ${path}`)
    mkdirSync(new URL('public/data/', root), { recursive: true })
    writeFileSync(url, bytes)
  }
}
for (const [path, sha] of preservedCtx) pinned(new URL(path, root), sha)
console.log(JSON.stringify({ result: 'PASS', mode: verify ? 'saved verification (no writes)' : 'native preparation', cells: 10609,
  sourceHashScope: manifest.source.sourceHashDefinition,
  assets: outputs.map(([file, bytes]) => ({ file, bytes: bytes.byteLength, sha256: hash(bytes) })),
  preservedCtxCells: 65536,
}, null, 2))
