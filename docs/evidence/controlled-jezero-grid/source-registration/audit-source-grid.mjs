import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { DOMParser } from '@xmldom/xmldom'

// Independent, source-specific byte/geometry audit. This does not use Rasterio,
// the preprocessing script, or application coordinate/terrain helpers.
const here = new URL('./', import.meta.url)
const read = path => readFile(new URL(path, here))
const write = (path, data) => writeFile(new URL(path, here), data)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const imageId = 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0'
const demId = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0'
const archive = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/'
const capabilitiesUrl = `https://trek.nasa.gov/tiles/Mars/EQ/${imageId}/1.0.0/WMTSCapabilities.xml`
const receipts = []
const savedMode = process.argv.includes('--verify-saved')
const savedReceipts = savedMode ? JSON.parse((await read('http-receipts.json')).toString('utf8')) : []

async function fetchEvidence(file, url) {
  if (savedMode) {
    const receipt = savedReceipts.find(item => item.file === file)
    assert(receipt, `No saved receipt for ${file}`)
    assert.equal(receipt.url, url)
    const bytes = await read(file)
    assert.equal(bytes.length, receipt.bytes); assert.equal(sha256(bytes), receipt.sha256)
    receipts.push(receipt)
    return { bytes, receipt }
  }
  const retrievedAt = new Date().toISOString()
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  const bytes = Buffer.from(await response.arrayBuffer())
  const receipt = {
    file, url, finalUrl: response.url, retrievedAt, status: response.status,
    contentType: response.headers.get('content-type'),
    bytes: bytes.length, sha256: sha256(bytes),
    accessControlAllowOrigin: response.headers.get('access-control-allow-origin'),
    etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified'),
    tlsPolicy: 'Node built-in fetch with normal certificate validation; no TLS bypass',
  }
  await write(file, bytes)
  receipts.push(receipt)
  return { bytes, receipt }
}

const metadata = await Promise.all([
  fetchEvidence('controlled-capabilities.xml', capabilitiesUrl),
  fetchEvidence('controlled-isis.lbl', `${archive}${imageId}.lbl`),
  fetchEvidence('controlled-pds3.lbl', `${archive}${imageId}_pds3.lbl`),
  fetchEvidence('controlled-geographic.vrt', `${archive}${imageId}_dd.vrt`),
  fetchEvidence('controlled-fgdc.xml', `${archive}${imageId}.xml`),
])
for (const result of metadata) assert.equal(result.receipt.status, 200)
const [capabilities, isis, pds3, vrt, fgdc] = metadata.map(result => result.bytes.toString('utf8'))
const parse = source => new DOMParser().parseFromString(source, 'text/xml')
const nodes = (root, name) => Array.from(root.getElementsByTagNameNS('*', name))
const text = (root, name) => {
  const element = nodes(root, name)[0]
  assert(element, `Missing ${name}`)
  return element.textContent.trim()
}
const document = parse(capabilities)
const layer = nodes(document, 'Layer').find(element => text(element, 'Identifier') === imageId)
assert(layer)
const bbox = nodes(layer, 'BoundingBox')[0]
const serviceBounds = [
  ...text(bbox, 'LowerCorner').split(/\s+/).map(Number),
  ...text(bbox, 'UpperCorner').split(/\s+/).map(Number),
]
const resource = nodes(layer, 'ResourceURL')[0]
assert.equal(resource.getAttribute('format'), 'image/png')
const template = resource.getAttribute('template')
assert(template.includes('/1.0.0//{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png'))
const matrixSet = nodes(document, 'TileMatrixSet').find(element => {
  const children = Array.from(element.childNodes).filter(child => child.nodeType === 1)
  return children.some(child => child.localName === 'Identifier' && child.textContent.trim() === 'default028mm')
})
assert(matrixSet)
const matrices = nodes(matrixSet, 'TileMatrix').map(element => ({
  id: Number(text(element, 'Identifier')),
  scaleDenominator: Number(text(element, 'ScaleDenominator')),
  topLeftCorner: text(element, 'TopLeftCorner').split(/\s+/).map(Number),
  tileWidth: Number(text(element, 'TileWidth')), tileHeight: Number(text(element, 'TileHeight')),
  matrixWidth: Number(text(element, 'MatrixWidth')), matrixHeight: Number(text(element, 'MatrixHeight')),
}))
assert.equal(matrices.length, 14)
matrices.forEach((matrix, z) => {
  assert.equal(matrix.id, z)
  assert.deepEqual(matrix.topLeftCorner, [-180, 90])
  assert.equal(matrix.tileWidth, 256); assert.equal(matrix.tileHeight, 256)
  assert.equal(matrix.matrixWidth, 2 ** (z + 1)); assert.equal(matrix.matrixHeight, 2 ** z)
})

function labelNumber(label, field) {
  const match = label.match(new RegExp(`^\\s*${field}\\s*=\\s*([+\\-\\d.eE]+)`, 'm'))
  assert(match, `Missing label number ${field}`)
  return Number(match[1])
}
const image = {
  columns: labelNumber(isis, 'Samples'), rows: labelNumber(isis, 'Lines'),
  radiusM: labelNumber(isis, 'EquatorialRadius'), polarRadiusM: labelNumber(isis, 'PolarRadius'),
  originX: labelNumber(isis, 'UpperLeftCornerX'), originY: labelNumber(isis, 'UpperLeftCornerY'),
  pixelSizeM: labelNumber(isis, 'PixelResolution'),
  bounds: [labelNumber(isis, 'MinimumLongitude'), labelNumber(isis, 'MinimumLatitude'),
    labelNumber(isis, 'MaximumLongitude'), labelNumber(isis, 'MaximumLatitude')],
}
assert.equal(image.columns, 5322); assert.equal(image.rows, 5040)
assert.equal(image.radiusM, 3396190); assert.equal(image.polarRadiusM, 3396190)
assert.equal(image.pixelSizeM, 6)
assert.match(isis, /LatitudeType\s*=\s*Planetocentric/)
assert.match(isis, /LongitudeDirection\s*=\s*PositiveEast/)
assert.equal(labelNumber(isis, 'LongitudeDomain'), 180)
assert.equal(labelNumber(isis, 'CenterLongitude'), 0)
assert.equal(labelNumber(isis, 'CenterLatitude'), 0)
assert.equal(labelNumber(pds3, 'LINES'), image.rows)
assert.equal(labelNumber(pds3, 'LINE_SAMPLES'), image.columns)
assert.equal(labelNumber(pds3, 'SAMPLE_BITS'), 8)
assert.equal(labelNumber(pds3, 'MAP_SCALE'), 6)
assert.equal(labelNumber(pds3, 'A_AXIS_RADIUS') * 1000, image.radiusM)
assert.equal(labelNumber(pds3, 'B_AXIS_RADIUS') * 1000, image.radiusM)
assert.equal(labelNumber(pds3, 'C_AXIS_RADIUS') * 1000, image.radiusM)
assert.match(pds3, /SAMPLE_TYPE\s*=\s*LSB_UNSIGNED_INTEGER/)
const vrtDocument = parse(vrt)
const vrtGeoTransform = text(vrtDocument, 'GeoTransform').split(',').map(Number)
assert.equal(vrtDocument.documentElement.getAttribute('rasterXSize'), String(image.columns))
assert.equal(vrtDocument.documentElement.getAttribute('rasterYSize'), String(image.rows))
assert.equal(text(vrtDocument, 'ResampleAlg'), 'NearestNeighbour')
assert.equal(Number(text(vrtDocument, 'NoDataValue')), 0)

const near = (actual, expected, tolerance = 1e-10) => assert(Math.abs(actual - expected) <= tolerance,
  `${actual} differs from ${expected} by ${Math.abs(actual - expected)}`)
const toDegrees = (x, y) => [x / image.radiusM * 180 / Math.PI, y / image.radiusM * 180 / Math.PI]
const angularPixel = image.pixelSizeM / image.radiusM * 180 / Math.PI
near(vrtGeoTransform[0], image.bounds[0]); near(vrtGeoTransform[3], image.bounds[3])
near(vrtGeoTransform[1], angularPixel); near(vrtGeoTransform[5], -angularPixel)
near(vrtGeoTransform[2], 0); near(vrtGeoTransform[4], 0)
const nativeWestNorth = toDegrees(image.originX, image.originY)
const nativeEastSouth = toDegrees(image.originX + image.columns * image.pixelSizeM,
  image.originY - image.rows * image.pixelSizeM)
const pdsFirstCenterSample = (image.originX + 3) / 6 + labelNumber(pds3, 'SAMPLE_PROJECTION_OFFSET') + 1
const pdsFirstCenterLine = -(image.originY - 3) / 6 + labelNumber(pds3, 'LINE_PROJECTION_OFFSET') + 1
near(pdsFirstCenterSample, 1, 1e-7); near(pdsFirstCenterLine, 1, 1e-7)
near(nativeWestNorth[0], image.bounds[0]); near(nativeWestNorth[1], image.bounds[3])
near(nativeEastSouth[0], image.bounds[2]); near(nativeEastSouth[1], image.bounds[1])
serviceBounds.forEach((value, i) => near(value, image.bounds[i], 5e-8))

// Minimal independent TIFF IFD parser for this pinned uncompressed row-strip DEM.
const source = await read(`../../terrain-validation/source-audit/${demId}.tif`)
const manifestBytes = await read('../../../../public/data/jezero-terrain-grid.json')
const manifest = JSON.parse(manifestBytes.toString('utf8'))
const grid = await read('../../../../public/data/jezero-terrain-grid.f32')
assert.equal(sha256(source), '16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b')
assert.equal(manifest.source.sha256, sha256(source))
assert.equal(manifest.source.productId, demId)
assert.equal(manifest.source.units, 'm')
assert.equal(manifest.source.heightReference, 'provider-declared-iau-sphere-unvalidated')
assert.deepEqual(manifest.projection, { kind: 'equirectangular', radiusM: image.radiusM,
  standardParallelDeg: 0, centralMeridianDeg: 0, latitudeConvention: 'planetocentric',
  longitudeDirection: 'east-positive', longitudeRange: 'signed-180' })
assert.equal(source.toString('ascii', 0, 2), 'II'); assert.equal(source.readUInt16LE(2), 42)
const typeBytes = { 2: 1, 3: 2, 4: 4, 12: 8 }
const tags = new Map()
const ifd = source.readUInt32LE(4)
for (let index = 0; index < source.readUInt16LE(ifd); index++) {
  const entry = ifd + 2 + 12 * index
  const tag = source.readUInt16LE(entry), type = source.readUInt16LE(entry + 2)
  const count = source.readUInt32LE(entry + 4)
  assert(typeBytes[type])
  const pointer = count * typeBytes[type] <= 4 ? entry + 8 : source.readUInt32LE(entry + 8)
  assert(pointer + count * typeBytes[type] <= source.length)
  const readers = { 3: p => source.readUInt16LE(p), 4: p => source.readUInt32LE(p), 12: p => source.readDoubleLE(p) }
  tags.set(tag, type === 2 ? source.toString('utf8', pointer, pointer + count).replace(/\0$/, '')
    : Array.from({ length: count }, (_, i) => readers[type](pointer + i * typeBytes[type])))
}
assert.deepEqual(tags.get(33550), [20, 20, 0])
assert.deepEqual(tags.get(33922), [0, 0, 0, image.originX, image.originY, 0])
assert.equal(tags.get(256)[0], 1596); assert.equal(tags.get(257)[0], 1512)
assert.equal(tags.get(258)[0], 32); assert.equal(tags.get(259)[0], 1)
assert.equal(tags.get(277)[0], 1); assert.equal(tags.get(278)[0], 1); assert.equal(tags.get(339)[0], 3)
assert.deepEqual(manifest.grid, { startColumn: 522, startRow: 586, columns: 256, rows: 256 })
const noData = Math.fround(Number(tags.get(42113)))
assert.equal(manifest.sourceGrid.noData, noData)
assert.equal(manifest.sourceGrid.columns, 1596); assert.equal(manifest.sourceGrid.rows, 1512)
assert.equal(manifest.sourceGrid.originX, image.originX); assert.equal(manifest.sourceGrid.originY, image.originY)
assert.equal(manifest.sourceGrid.pixelSizeM, 20)
assert.equal(grid.length, 256 * 256 * 4); assert.equal(manifest.encoding.bytes, grid.length)
assert.equal(manifest.encoding.sha256, sha256(grid))
assert.equal(manifest.encoding.sampleType, 'float32'); assert.equal(manifest.encoding.byteOrder, 'little-endian')
assert.equal(manifest.encoding.layout, 'row-major')
const offsets = tags.get(273), byteCounts = tags.get(279)
assert.equal(offsets.length, 1512); assert.equal(byteCounts.length, 1512)
let compared = 0, missing = 0, min = Infinity, max = -Infinity, byteMismatches = 0
for (let r = 0; r < 256; r++) {
  const sourceRow = 586 + r
  assert.equal(byteCounts[sourceRow], 1596 * 4)
  const stripStart = offsets[sourceRow]
  assert(stripStart + byteCounts[sourceRow] <= source.length)
  for (let c = 0; c < 256; c++) {
    const sourceOffset = stripStart + (522 + c) * 4, gridOffset = (r * 256 + c) * 4
    if (!source.subarray(sourceOffset, sourceOffset + 4).equals(grid.subarray(gridOffset, gridOffset + 4))) byteMismatches++
    const original = source.readFloatLE(sourceOffset), extracted = grid.readFloatLE(gridOffset)
    assert.equal(extracted, original)
    compared++
    if (!Number.isFinite(original) || original === noData) missing++
    else { min = Math.min(min, original); max = Math.max(max, original) }
  }
}
assert.equal(byteMismatches, 0); assert.equal(missing, 0)
assert.equal(manifest.summary.validCount, compared - missing); assert.equal(manifest.summary.missingCount, missing)
assert.equal(manifest.summary.minM, min); assert.equal(manifest.summary.maxM, max)
const corners = [
  ['north-west', 586, 522], ['north-east', 586, 778],
  ['south-east', 842, 778], ['south-west', 842, 522],
].map(([name, row, column]) => {
  const projectedM = [image.originX + column * 20, image.originY - row * 20]
  const coordinate = toDegrees(...projectedM)
  const nativeImagePixelEdge = [column * 20 / 6, row * 20 / 6]
  assert(nativeImagePixelEdge[0] >= 0 && nativeImagePixelEdge[0] <= image.columns)
  assert(nativeImagePixelEdge[1] >= 0 && nativeImagePixelEdge[1] <= image.rows)
  const recorded = manifest.outerCorners.find(item => item.name === name)
  assert(recorded); assert.equal(recorded.sourceRowEdge, row); assert.equal(recorded.sourceColumnEdge, column)
  projectedM.forEach((value, i) => near(recorded.projectedM[i], value, 1e-7))
  coordinate.forEach((value, i) => near(recorded.coordinate[i], value))
  return { name, sourceRowEdge: row, sourceColumnEdge: column, projectedM, coordinate, nativeImagePixelEdge }
})
for (const fixture of manifest.fixtures) {
  const expectedPosition = [image.originX + (fixture.column + 0.5) * 20, image.originY - (fixture.row + 0.5) * 20]
  expectedPosition.forEach((value, i) => near(fixture.pixelCenterM[i], value, 1e-7))
  toDegrees(...expectedPosition).forEach((value, i) => near(fixture.coordinate[i], value))
  assert.equal(fixture.elevationM, source.readFloatLE(offsets[fixture.row] + fixture.column * 4))
}

const tileFor = (coordinate, z) => {
  const span = 360 / 2 ** (z + 1)
  return { z, row: Math.floor((90 - coordinate[1]) / span), column: Math.floor((coordinate[0] + 180) / span) }
}
const tileUrl = ({ z, row, column }) => template.replace('{Style}', 'default')
  .replace('{TileMatrixSet}', 'default028mm').replace('{TileMatrix}', String(z))
  .replace('{TileRow}', String(row)).replace('{TileCol}', String(column))
const center = toDegrees(image.originX + (522 + 128) * 20, image.originY - (586 + 128) * 20)
const probes = [...corners.map(corner => ({ purpose: `crop-${corner.name}`, coordinate: corner.coordinate, ...tileFor(corner.coordinate, 13) })),
  { purpose: 'crop-center', coordinate: center, ...tileFor(center, 13) },
  { purpose: 'image-east-boundary', coordinate: [image.bounds[2], (image.bounds[1] + image.bounds[3]) / 2],
    ...tileFor([image.bounds[2], (image.bounds[1] + image.bounds[3]) / 2], 12) },
  { purpose: 'outside-image', coordinate: [image.bounds[0] - 0.3, image.bounds[1] - 0.3],
    ...tileFor([image.bounds[0] - 0.3, image.bounds[1] - 0.3], 12) }]

function inspectPng(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  let width, height, depth, colorType, interlace
  const compressed = []
  for (let position = 8; position < bytes.length;) {
    const length = bytes.readUInt32BE(position), type = bytes.toString('ascii', position + 4, position + 8)
    const data = bytes.subarray(position + 8, position + 8 + length)
    assert.equal(data.length, length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      depth = data[8]; colorType = data[9]; interlace = data[12]
    }
    if (type === 'IDAT') compressed.push(data)
    position += length + 12
    if (type === 'IEND') break
  }
  assert.equal(width, 256); assert.equal(height, 256); assert.equal(depth, 8); assert.equal(interlace, 0)
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  assert(channels, `Unimplemented PNG color type ${colorType}`)
  const unpacked = inflateSync(Buffer.concat(compressed)), stride = width * channels
  assert.equal(unpacked.length, (stride + 1) * height)
  const pixels = Buffer.alloc(width * height * channels)
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y++) {
    const filter = unpacked[y * (stride + 1)]
    assert(filter <= 4)
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0
      const above = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const upperLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0
      const prediction = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, upperLeft)][filter]
      pixels[y * stride + x] = (unpacked[y * (stride + 1) + 1 + x] + prediction) & 255
    }
  }
  let opaque = 0, transparent = 0, partial = 0, nonGrayscale = 0, minValue = Infinity, maxValue = -Infinity
  let minVisibleColumn = width, maxVisibleColumn = -1, minVisibleRow = height, maxVisibleRow = -1
  for (let i = 0; i < width * height; i++) {
    const offset = i * channels, alpha = colorType === 6 ? pixels[offset + 3] : colorType === 4 ? pixels[offset + 1] : 255
    if (alpha === 255) opaque++; else if (alpha === 0) transparent++; else partial++
    if (alpha > 0) {
      const column = i % width, row = Math.floor(i / width)
      minVisibleColumn = Math.min(minVisibleColumn, column); maxVisibleColumn = Math.max(maxVisibleColumn, column)
      minVisibleRow = Math.min(minVisibleRow, row); maxVisibleRow = Math.max(maxVisibleRow, row)
      minValue = Math.min(minValue, pixels[offset]); maxValue = Math.max(maxValue, pixels[offset])
      if (channels >= 3 && (pixels[offset] !== pixels[offset + 1] || pixels[offset] !== pixels[offset + 2])) nonGrayscale++
    }
  }
  return { width, height, bitDepth: depth, colorType, opaque, transparent, partial, nonGrayscale,
    visibleGrayMinimum: minValue, visibleGrayMaximum: maxValue,
    visiblePixelBoundsInclusive: [minVisibleColumn, minVisibleRow, maxVisibleColumn, maxVisibleRow] }
}
const tileResults = await Promise.all(probes.map(async probe => {
  const file = `tile-${probe.z}-${probe.row}-${probe.column}.png`
  const result = await fetchEvidence(file, tileUrl(probe))
  const analysis = result.receipt.status === 200 ? inspectPng(result.bytes) : null
  if (probe.purpose.startsWith('crop-')) {
    assert.equal(result.receipt.status, 200)
    assert.equal(analysis.transparent, 0); assert.equal(analysis.partial, 0)
    assert.equal(analysis.nonGrayscale, 0); assert(analysis.visibleGrayMaximum > analysis.visibleGrayMinimum)
    assert.equal(result.receipt.accessControlAllowOrigin, '*')
  }
  if (probe.purpose === 'image-east-boundary') {
    assert.equal(result.receipt.status, 200)
    assert(analysis.opaque > 0 && analysis.transparent > 0 && analysis.partial > 0)
    assert.equal(result.receipt.accessControlAllowOrigin, '*')
  }
  if (probe.purpose === 'outside-image') {
    assert.equal(result.receipt.status, 404); assert.equal(result.receipt.accessControlAllowOrigin, null)
  }
  const tileAngularResolution = 0.703125 / 2 ** probe.z
  const tileNorthWest = [-180 + probe.column * 256 * tileAngularResolution, 90 - probe.row * 256 * tileAngularResolution]
  const coordinateInTilePixelEdges = [(probe.coordinate[0] - tileNorthWest[0]) / tileAngularResolution,
    (tileNorthWest[1] - probe.coordinate[1]) / tileAngularResolution]
  return { ...probe, file, status: result.receipt.status, tileNorthWest,
    tileAngularResolution, coordinateInTilePixelEdges, analysis }
}))
const geometry = {
  controlledImage: image, nativeWestNorth, nativeEastSouth, vrtGeoTransform, serviceBounds,
  pdsFirstCenterSample, pdsFirstCenterLine,
  tileMatrix: { declaredCrs: text(matrixSet, 'SupportedCRS'), template, matrices,
    angularResolutionFormula: '0.703125 / 2**zoom degrees per pixel',
    maximumZoomNominalEquatorialSampleM: 0.703125 / 2 ** 13 * Math.PI / 180 * image.radiusM,
    scaleDenominatorUsedForPlacement: false },
  crop: { ...manifest.grid, corners, center, nativeImageOuterSpanPixels: [256 * 20 / 6, 256 * 20 / 6] },
  imageDemOverlap: { sharedProjectedNorthWestCorner: true, imageNativeSampleM: 6, demNativeSampleM: 20,
    imageEastLongitude: image.bounds[2], demEastLongitude: toDegrees(image.originX + 1596 * 20, image.originY)[0],
    nativeImageExtraEastWidthM: image.columns * 6 - 1596 * 20,
    nativeImageExtraSouthHeightM: image.rows * 6 - 1512 * 20 },
  fgdcAssertions: {
    relativeHorizontalDisplacement9_6m: /9\.6/.test(fgdc), relativeVerticalRegistration3_8m: /3\.8/.test(fgdc),
    verticalShift183_3m: /183\.3/.test(fgdc), referencesHrsc: /HRSC/.test(fgdc),
  },
  limitations: [
    'Arithmetic metadata/grid alignment does not independently establish absolute landmark accuracy or MDIM 2.1 named-feature registration.',
    'Crop bounds are deliberately selected prototype support; they are not measured boundaries of a science feature or validated traverse area.',
    'A 20 m native DEM cell covers 3 1/3 native 6 m image pixels per axis; the grids have a shared origin but different cell boundaries.',
    'PNG values were verified as rendered grayscale imagery with coverage, not matched to native imagery samples; service resampling/rendering is not a numerical DEM.',
    'Zoom 13 display sampling is approximately 5.088 m at the equator but source imagery is 6 m; resampling does not create new measured detail.',
    'Provider-declared Mars IAU sphere vertical reference remains independently unvalidated. No vertical correction is applied.',
    'All-valid DEM samples do not establish source stereo/fill support, hazards, traversability, safety, or route suitability.',
    'Node HTTPS/CORS headers do not replace root isolated-browser rendering and browser CORS checks.',
  ],
}
const gridChecks = {
  sourceFile: `docs/evidence/terrain-validation/source-audit/${demId}.tif`, sourceBytes: source.length,
  sourceSha256: sha256(source), manifestFile: 'public/data/jezero-terrain-grid.json',
  manifestBytes: manifestBytes.length, manifestSha256: sha256(manifestBytes),
  binaryFile: 'public/data/jezero-terrain-grid.f32', binaryBytes: grid.length, binarySha256: sha256(grid),
  comparedCells: compared, differingValues: 0, differingFloat32Bytes: byteMismatches,
  validCells: compared - missing, noDataOrNonFiniteCells: missing, minimumM: min, maximumM: max,
  connectedValidRectangle: missing === 0,
  inspectedNoDataSentinel: noData, sourceGeometryVerifiedFromTiffTags: true,
  recordedCornersMatched: corners.length, recordedCenterFixturesMatched: manifest.fixtures.length,
  processingLibraryUsed: 'Node Buffer raw row-strip byte reads; independent of Rasterio/preprocessing/app helpers',
  missingPolicyScope: 'This audit validates actual crop support only; application injected-missing/outside/edge behavior is reviewed separately.',
}
await write('http-receipts.json', JSON.stringify(receipts.sort((a, b) => a.file.localeCompare(b.file)), null, 2) + '\n')
await write('geometry-checks.json', JSON.stringify(geometry, null, 2) + '\n')
await write('grid-cell-checks.json', JSON.stringify(gridChecks, null, 2) + '\n')
await write('tile-checks.json', JSON.stringify(tileResults, null, 2) + '\n')
console.log(JSON.stringify({ verificationMode: savedMode ? 'saved receipt/hash verification' : 'fresh normal-TLS fetch',
  metadataResources: metadata.length, gridChecks, tileResults }, null, 2))
