import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const read = name => readFile(new URL(name, import.meta.url))
const json = async name => JSON.parse((await read(name)).toString('utf8'))
const receipts = await json('http-receipts.json')
let authenticatedResponseHashesVerified = 0
let diagnosticResponseHashesVerified = 0
let failuresRecorded = 0
for (const receipt of receipts) {
  if (receipt.error) { failuresRecorded++; continue }
  const bytes = await read(receipt.file)
  assert.equal(bytes.length, receipt.bytes, receipt.name)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256, receipt.name)
  if (receipt.tlsVerified === false) {
    assert.match(receipt.tlsWarning, /does not establish authenticated/)
    diagnosticResponseHashesVerified++
  } else authenticatedResponseHashesVerified++
}
const tiles = ['controlled-ctx-jezero-tile', 'controlled-ctx-belva-tile', 'controlled-ctx-neretva-tile']
for (const name of tiles) {
  const receipt = receipts.find(item => item.name === name)
  assert(receipt)
  assert.equal(receipt.status, 200)
  assert.equal(receipt.responseHeaders['access-control-allow-origin'], '*')
  const bytes = await read(receipt.file)
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR')
  assert.equal(bytes.readUInt32BE(16), 256)
  assert.equal(bytes.readUInt32BE(20), 256)
}
const geology = await json('jezero-geology-units-example-query.json')
assert.equal(geology.geometryType, 'esriGeometryPolygon')
assert.equal(geology.features.length, 1)
assert(geology.features[0].geometry.rings.length > 0)
assert.match(geology.spatialReference.wkt, /Mars_2000_Sphere/)
assert.match(geology.spatialReference.wkt, /3396190/)
assert.match(geology.spatialReference.wkt, /Transverse_Mercator/)
assert.match(geology.spatialReference.wkt, /Central_Meridian[^0-9]*77\.5/)
console.log(JSON.stringify({ result: 'PASS', authenticatedResponseHashesVerified, diagnosticResponseHashesVerified, failedRequestsRecorded: failuresRecorded, pngTileContractsVerified: tiles.length, nativeGeologyResponseVerified: true, browserOrRegistrationClaim: false }, null, 2))
