import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

// Independent byte/label audit. No application helper, Rasterio, resampling,
// scientific correction, network access, or write outside this evidence folder.
const here = new URL('./', import.meta.url)
const root = new URL('../../../../', here)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const read = path => readFile(new URL(path, root))
const saved = process.argv.includes('--verify-saved')
const productId = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0'
const sourcePath = `docs/evidence/terrain-validation/source-audit/${productId}.tif`
const source = await read(sourcePath)
const manifestBytes = await read('public/data/jezero-terrain-grid.json')
const manifest = JSON.parse(manifestBytes.toString('utf8'))
const grid = await read('public/data/jezero-terrain-grid.f32')
assert.equal(hash(source), '16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b')
assert.equal(hash(manifestBytes), 'fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9')
assert.equal(hash(grid), '4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8')
assert.equal(manifest.source.productId, productId)
assert.equal(manifest.source.sha256, hash(source))
assert.equal(manifest.encoding.sha256, hash(grid))
assert.equal(source.toString('ascii', 0, 2), 'II')
assert.equal(source.readUInt16LE(2), 42)
const typeBytes = { 2: 1, 3: 2, 4: 4, 12: 8 }
const tags = new Map()
const ifd = source.readUInt32LE(4)
for (let index = 0; index < source.readUInt16LE(ifd); index++) {
  const entry = ifd + 2 + 12 * index
  const tag = source.readUInt16LE(entry), type = source.readUInt16LE(entry + 2)
  const count = source.readUInt32LE(entry + 4)
  assert(typeBytes[type], `Unsupported TIFF field type ${type}`)
  const pointer = count * typeBytes[type] <= 4 ? entry + 8 : source.readUInt32LE(entry + 8)
  assert(pointer + count * typeBytes[type] <= source.length)
  const readers = { 3: p => source.readUInt16LE(p), 4: p => source.readUInt32LE(p), 12: p => source.readDoubleLE(p) }
  tags.set(tag, type === 2 ? source.toString('utf8', pointer, pointer + count).replace(/\0$/, '')
    : Array.from({ length: count }, (_, i) => readers[type](pointer + i * typeBytes[type])))
}
assert.equal(source.readUInt32LE(ifd + 2 + source.readUInt16LE(ifd) * 12), 0, 'Unexpected next IFD')
assert.equal(tags.get(256)[0], 1596); assert.equal(tags.get(257)[0], 1512)
assert.equal(tags.get(258)[0], 32); assert.equal(tags.get(259)[0], 1)
assert.equal(tags.get(277)[0], 1); assert.equal(tags.get(278)[0], 1); assert.equal(tags.get(339)[0], 3)
assert.deepEqual(tags.get(33550), [20, 20, 0])
assert.deepEqual(tags.get(33922), [0, 0, 0, 4573663.250853, 1109693.140188, 0])
assert.deepEqual(manifest.grid, { startColumn: 522, startRow: 586, columns: 256, rows: 256 })
assert.equal(manifest.source.units, 'm')
assert.equal(manifest.source.heightReference, 'provider-declared-iau-sphere-unvalidated')
assert.deepEqual(manifest.projection, { kind: 'equirectangular', radiusM: 3396190,
  standardParallelDeg: 0, centralMeridianDeg: 0, latitudeConvention: 'planetocentric',
  longitudeDirection: 'east-positive', longitudeRange: 'signed-180' })
const noData = Math.fround(Number(tags.get(42113)))
assert.equal(manifest.sourceGrid.noData, noData)
assert.equal(grid.length, 65536 * 4)
const offsets = tags.get(273), counts = tags.get(279)
assert.equal(offsets.length, 1512); assert.equal(counts.length, 1512)
let compared = 0, mismatches = 0, missing = 0, minimum = Infinity, maximum = -Infinity
for (let row = 0; row < 256; row++) {
  const sourceRow = row + 586
  assert.equal(counts[sourceRow], 1596 * 4)
  assert(offsets[sourceRow] + counts[sourceRow] <= source.length)
  for (let column = 0; column < 256; column++) {
    const sourceOffset = offsets[sourceRow] + (column + 522) * 4
    const gridOffset = (row * 256 + column) * 4
    if (!source.subarray(sourceOffset, sourceOffset + 4).equals(grid.subarray(gridOffset, gridOffset + 4))) mismatches++
    const value = source.readFloatLE(sourceOffset)
    compared++
    if (!Number.isFinite(value) || value === noData) missing++
    else { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value) }
  }
}
assert.equal(compared, 65536); assert.equal(mismatches, 0); assert.equal(missing, 0)
assert.equal(minimum, manifest.summary.minM); assert.equal(maximum, manifest.summary.maxM)
assert.equal(manifest.summary.validCount, compared); assert.equal(manifest.summary.missingCount, missing)
const geokeyDirectory = tags.get(34735)
const geokeys = Array.from({ length: geokeyDirectory[3] }, (_, i) => geokeyDirectory.slice(4 + i * 4, 8 + i * 4))
const verticalKeys = geokeys.filter(([key]) => key >= 4096 && key <= 4099)
assert.equal(verticalKeys.length, 0, 'New vertical reference keys need review')

const label = (await readFile(new URL('hirise-dtm-complete.lbl', here))).toString('latin1')
assert.equal(hash(Buffer.from(label, 'latin1')), '220e7ff937b18d6eaf5e2eb712c452980053daf6ca9f468bf21219577173d5cd')
const number = field => {
  const found = label.match(new RegExp(`^\\s*${field}\\s*=\\s*([+\\-\\d.eE]+)`, 'm'))
  assert(found, `Missing HiRISE numeric field ${field}`)
  return Number(found[1])
}
assert.match(label, /meters above the martian equipotential surface \(Mars\s+2000 Datum\)/)
assert.match(label, /SAMPLE_TYPE\s*=\s*PC_REAL/)
assert.equal(number('SCALING_FACTOR'), 1); assert.equal(number('OFFSET'), 0)
const hiriseBounds = [number('WESTERNMOST_LONGITUDE'), number('MINIMUM_LATITUDE'),
  number('EASTERNMOST_LONGITUDE'), number('MAXIMUM_LATITUDE')]
const cropCoordinates = manifest.outerCorners.map(item => item.coordinate)
const cropBounds = [Math.min(...cropCoordinates.map(c => c[0])), Math.min(...cropCoordinates.map(c => c[1])),
  Math.max(...cropCoordinates.map(c => c[0])), Math.max(...cropCoordinates.map(c => c[1]))]
const intersectionBounds = [Math.max(cropBounds[0], hiriseBounds[0]), Math.max(cropBounds[1], hiriseBounds[1]),
  Math.min(cropBounds[2], hiriseBounds[2]), Math.min(cropBounds[3], hiriseBounds[3])]
const overlaps = intersectionBounds[0] < intersectionBounds[2] && intersectionBounds[1] < intersectionBounds[3]
assert.equal(overlaps, false)
const priorFolder = 'docs/evidence/scientific-resolution-2026-11-14/height/'
const priorReceipts = JSON.parse((await read(`${priorFolder}http-receipts.json`)).toString('utf8'))
const reusedDocuments = []
for (const file of ['hirise-dtm-about.html', 'hirise-rdr-sis.pdf']) {
  const receipt = priorReceipts.find(item => item.file === file)
  assert(receipt); assert.equal(receipt.status, 200)
  const bytes = await read(`${priorFolder}${file}`)
  assert.equal(bytes.length, receipt.bytes); assert.equal(hash(bytes), receipt.sha256)
  reusedDocuments.push({ ...receipt, reusedPath: `${priorFolder}${file}`, auditUse: 'General method; not product-specific control residuals' })
}
const output = { schemaVersion: 1, method: 'Independent raw TIFF IFD and row-strip reads; complete PDS label parse; receipt/hash verification',
  currentCtx: { productId, sourcePath, sourceBytes: source.length, sourceSha256: hash(source),
    manifestSha256: hash(manifestBytes), binaryBytes: grid.length, binarySha256: hash(grid),
    sourceDimensions: [1596, 1512], crop: manifest.grid, comparedCells: compared, differingFloat32Bytes: mismatches,
    validCells: compared - missing, noDataOrNonFiniteCells: missing, noDataSentinel: noData,
    minimumProviderM: minimum, maximumProviderM: maximum, cropBounds, projection: manifest.projection,
    pixelSpacingProjectedM: 20, encoding: manifest.encoding, geoKeys: geokeys, verticalGeoKeys: verticalKeys,
    gdalMetadata: tags.get(42112) ?? null, extraSamplesOrSubIfd: { extraSamples: tags.get(338) ?? null, subIfd: tags.get(330) ?? null },
    extraction: manifest.processing, upstreamPerCellStereoFillQualityValidated: false,
    heightConclusion: 'Exact final vertical equation/model/sign unresolved; mapping sphere is horizontal metadata' },
  candidateHirise: { productId: 'DTEEC_023524_1985_023379_1985_U01', version: 1,
    sourcePair: ['ESP_023524_1985', 'ESP_023379_1985'], dimensions: [number('LINE_SAMPLES'), number('LINES')],
    bounds: hiriseBounds, overlapsCurrentCrop: overlaps, eastWestSeparationDeg: hiriseBounds[0] - cropBounds[2],
    mappingRadiusM: number('A_AXIS_RADIUS') * 1000, standardParallelDeg: number('CENTER_LATITUDE'),
    centralMeridianDeg: number('CENTER_LONGITUDE'), projectedSampleM: number('MAP_SCALE'),
    verticalReference: 'metres above equipotential Mars 2000 Datum, Smith et al. (2001), positive above',
    scale: number('SCALING_FACTOR'), offset: number('OFFSET'), missingBitsHex: 'FF7FFFFB',
    completeLabelSha256: hash(Buffer.from(label, 'latin1')), fullImageDownloaded: false,
    imageSizeBytesFromRangeReceipt: 700271460, currentCropReplacementOrValidation: false },
  reusedDocuments,
  limits: ['All finite cells do not establish measured stereo support or absence of fill.',
    'Byte equality establishes extraction preservation, not height datum, physical slope, hazard or safety accuracy.',
    'Candidate HiRISE label has a clear height contract but no overlap with the current CTX crop.',
    'No source grid, application module, coordinate transform, DEM value, routing logic, or scientific gate changed.'] }
const text = JSON.stringify(output, null, 2) + '\n'
const resultPath = new URL('provenance-checks.json', here)
if (saved) assert.equal(await readFile(resultPath, 'utf8'), text)
else await writeFile(resultPath, text)
console.log(JSON.stringify({ savedVerification: saved, comparedCells: compared, differingFloat32Bytes: mismatches,
  validCells: compared - missing, verticalGeoKeys: verticalKeys.length, hiriseOverlapsCurrentCrop: overlaps,
  reusedDocumentsVerified: reusedDocuments.length, currentHeightConclusion: output.currentCtx.heightConclusion }, null, 2))
