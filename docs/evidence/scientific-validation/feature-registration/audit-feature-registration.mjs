import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

// Independent build-time source audit. No app helper or image-derived landmark is used.
const root = new URL('./', import.meta.url)
const sourceRoot = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/'
const imageId = 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0'
const demId = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0'
const resources = [
  ['jezero.html', 'https://planetarynames.wr.usgs.gov/Feature/14300'],
  ['belva.html', 'https://planetarynames.wr.usgs.gov/Feature/15872'],
  ['neretva.html', 'https://planetarynames.wr.usgs.gov/Feature/15879'],
  ['mars-system.html', 'https://planetarynames.wr.usgs.gov/Page/MARS/system'],
  ['gazetteer-faq.html', 'https://planetarynames.wr.usgs.gov/Page/FAQ'],
  ['controlled-image.lbl', `${sourceRoot}${imageId}.lbl`],
  ['controlled-image.vrt', `${sourceRoot}${imageId}_dd.vrt`],
  ['controlled-image.xml', `${sourceRoot}${imageId}.xml`],
  ['numerical-dem.lbl', `${sourceRoot}${demId}.lbl`],
  ['numerical-dem-pds3.lbl', `${sourceRoot}${demId}_pds3.lbl`],
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const read = name => readFile(new URL(name, root))
const save = (name, value) => writeFile(new URL(name, root), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
const clean = html => html.replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|deg);/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
let receipts
if (process.argv.includes('--verify-saved')) {
  receipts = JSON.parse(await read('http-receipts.json'))
} else {
  receipts = await Promise.all(resources.map(async ([file, url]) => {
    const retrievedUtc = new Date().toISOString()
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
      const bytes = Buffer.from(await response.arrayBuffer())
      await writeFile(new URL(file, root), bytes)
      return { file, url, finalUrl: response.url, retrievedUtc, status: response.status, bytes: bytes.length, sha256: hash(bytes), contentType: response.headers.get('content-type'), cors: response.headers.get('access-control-allow-origin') }
    } catch (error) {
      return { file, url, retrievedUtc, error: String(error) }
    }
  }))
  await save('http-receipts.json', receipts)
}
assert.equal(receipts.length, resources.length)
for (const [file, url] of resources) {
  const receipt = receipts.find(value => value.file === file && value.url === url)
  assert(receipt && !receipt.error, `Unavailable audit source: ${file}`)
  assert.equal(receipt.status, 200, file)
  const bytes = await read(file)
  assert.equal(bytes.length, receipt.bytes, file)
  assert.equal(hash(bytes), receipt.sha256, file)
}

const registry = await readFile(new URL('../../../../src/data/scienceTargets.ts', root), 'utf8')
const expected = [['jezero', '14300', 77.69, 18.41], ['belva', '15872', 77.38, 18.48], ['neretva', '15879', 77.20, 18.55]]
const records = []
for (const [id, featureId, lon, lat] of expected) {
  const html = (await read(`${id}.html`)).toString('utf8')
  const hidden = html.match(/<input id="selected_control_net"[^>]*value="(\d+)"[^>]*>\s*([^<]+)/)
  const selected = html.match(/<option label="([^"]+)" value="(\d+)"\s+selected\s*>/)
  assert(hidden || selected, `${id}: selected control network missing`)
  const network = hidden ? { id: hidden[1], name: clean(hidden[2]) } : { id: selected[2], name: selected[1] }
  assert.equal(network.name, 'MDIM 2.1', id)
  const convention = html.match(/<span id="coordinate_system_name"[^>]*>([^<]+)<\/span>/)?.[1]
  assert.equal(convention, 'Planetocentric, +East, 0 - 360', id)
  const rows = [...html.matchAll(new RegExp(`<tr class="geometry geom-${network.id} cs-6">([\\s\\S]*?)<\\/tr>`, 'g'))].map(match => clean(match[1]))
  const field = name => {
    const row = rows.find(value => value.startsWith(`${name} `))
    assert(row, `${id}: selected-network ${name} missing`)
    return row.slice(name.length + 1)
  }
  assert.equal(Number(field('Center Longitude')), lon, id)
  assert.equal(Number(field('Center Latitude')), lat, id)
  const actualId = clean(html.match(/<th>Feature ID<\/th>\s*<td>([\s\S]*?)<\/td>/)?.[1] ?? '')
  assert.equal(actualId, featureId, id)
  assert(registry.includes(`https://planetarynames.wr.usgs.gov/Feature/${featureId}`))
  records.push({ id, featureId, coordinate: [lon, lat], longitudeText: field('Center Longitude'), latitudeText: field('Center Latitude'), controlNetwork: network, convention, empiricalRegistration: 'unavailable: no MDIM-to-controlled-CTX/DEM landmark residuals or validated transform supplied' })
}
assert((await read('mars-system.html')).toString().includes('Both systems are approved for use on Mars'))
assert((await read('gazetteer-faq.html')).toString().includes('Everything in the Gazetteer of Planetary Nomenclature is in the public domain'))

const numberField = (label, name) => {
  const match = label.match(new RegExp(`^\\s*${name}\\s*=\\s*([-+\\d.eE]+)`, 'm'))
  assert(match, `Missing native field ${name}`)
  return Number(match[1])
}
const model = async file => {
  const label = (await read(file)).toString('utf8')
  for (const field of ['TargetName           = Mars', 'LatitudeType         = Planetocentric', 'LongitudeDirection   = PositiveEast', 'ProjectionName       = Equirectangular']) assert(label.includes(field), `${file}: ${field}`)
  const value = name => numberField(label, name)
  assert.equal(value('LongitudeDomain'), 180)
  assert.equal(value('CenterLatitude'), 0)
  assert.equal(value('CenterLongitude'), 0)
  assert.equal(value('EquatorialRadius'), 3396190)
  assert.equal(value('PolarRadius'), 3396190)
  return { radiusM: value('EquatorialRadius'), originX: value('UpperLeftCornerX'), originY: value('UpperLeftCornerY'), spacingM: value('PixelResolution'), columns: value('Samples'), rows: value('Lines'), publishedBounds: [value('MinimumLongitude'), value('MinimumLatitude'), value('MaximumLongitude'), value('MaximumLatitude')] }
}
const image = await model('controlled-image.lbl')
const dem = await model('numerical-dem.lbl')
assert.equal(image.originX, dem.originX)
assert.equal(image.originY, dem.originY)
assert.equal(image.spacingM, 6)
assert.equal(dem.spacingM, 20)
assert.equal(dem.columns, 1596)
assert.equal(dem.rows, 1512)
const toDegrees = radians => radians * 180 / Math.PI
const edge = (source, row, column) => [toDegrees((source.originX + column * source.spacingM) / source.radiusM), toDegrees((source.originY - row * source.spacingM) / source.radiusM)]
const closePair = (a, b, tolerance = 1e-12) => a.forEach((v, index) => assert(Math.abs(v - b[index]) < tolerance, `${v} vs ${b[index]}`))
for (const source of [image, dem]) {
  closePair(edge(source, 0, 0), [source.publishedBounds[0], source.publishedBounds[3]])
  closePair(edge(source, source.rows, source.columns), [source.publishedBounds[2], source.publishedBounds[1]])
}
const vrt = (await read('controlled-image.vrt')).toString('utf8')
const geoTransform = vrt.match(/<GeoTransform>([^<]+)<\/GeoTransform>/)?.[1].split(',').map(Number)
assert(geoTransform && geoTransform.length === 6)
closePair([geoTransform[0], geoTransform[3]], edge(image, 0, 0))
closePair([geoTransform[1], geoTransform[5]], [toDegrees(6 / image.radiusM), -toDegrees(6 / image.radiusM)], 1e-15)
assert.equal(geoTransform[2], 0)
assert.equal(geoTransform[4], 0)
const pds = (await read('numerical-dem-pds3.lbl')).toString('utf8')
assert.equal(numberField(pds, 'MAP_SCALE'), 20)
assert.equal(numberField(pds, 'A_AXIS_RADIUS') * 1000, dem.radiusM)
assert.equal(numberField(pds, 'LINE_FIRST_PIXEL'), 1)
assert.equal(numberField(pds, 'SAMPLE_FIRST_PIXEL'), 1)
// PDS offsets refer to first center (one-based sample/line 1); do not add a second half pixel.
closePair([-numberField(pds, 'SAMPLE_PROJECTION_OFFSET') * 20, numberField(pds, 'LINE_PROJECTION_OFFSET') * 20], [dem.originX + 10, dem.originY - 10], 1e-8)
const manifestBytes = await readFile(new URL('../../../../public/data/jezero-terrain-grid.json', root))
assert.equal(hash(manifestBytes), 'fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9')
const manifest = JSON.parse(manifestBytes)
for (const corner of manifest.outerCorners) closePair(corner.coordinate, edge(dem, corner.sourceRowEdge, corner.sourceColumnEdge))
for (const fixture of manifest.fixtures) closePair(fixture.coordinate, edge(dem, fixture.row + .5, fixture.column + .5))
const featureMappings = records.map(record => {
  const [lon, lat] = record.coordinate
  const x = lon * Math.PI / 180 * dem.radiusM
  const y = lat * Math.PI / 180 * dem.radiusM
  const row = Math.floor((dem.originY - y) / dem.spacingM)
  const column = Math.floor((x - dem.originX) / dem.spacingM)
  const { startRow, startColumn, rows, columns } = manifest.grid
  return { id: record.id, approximateCoordinate: record.coordinate, arithmeticSourceRow: row, arithmeticSourceColumn: column, nativeCellCenter: edge(dem, row + .5, column + .5), insideNativeDemEnvelope: row >= 0 && row < dem.rows && column >= 0 && column < dem.columns, insidePlanningCrop: row >= startRow && row < startRow + rows && column >= startColumn && column < startColumn + columns, qualification: 'Arithmetical mapping only; not a registered named-feature measurement or automatic route endpoint.' }
})
const output = { records, image, dem, geographicVrt: geoTransform, independentCornerAndCenterChecks: { cropCorners: manifest.outerCorners.length, nativeFixtures: manifest.fixtures.length, manifestSha256: hash(manifestBytes), providerCorners: 'agree within 1e-12 degrees', pdsFirstCenter: 'agrees within 1e-8 projected metres' }, featureMappings, imageExtraEastWidthM: image.columns * image.spacingM - dem.columns * dem.spacingM, featureRegistration: 'not validated: supplied source references establish convention and coarse coordinate placement, not landmark registration', nativeGeometry: 'validated against fetched ISIS/PDS3/VRT metadata', result: 'PASS: evidence integrity and native geometry checks; named-feature fine registration remains unavailable' }
await save('registration-checks.json', output)
console.log(JSON.stringify({ receiptsVerified: receipts.length, recordsVerified: records.length, nativeGeometry: output.nativeGeometry, featureMappings, featureRegistration: output.featureRegistration }, null, 2))
