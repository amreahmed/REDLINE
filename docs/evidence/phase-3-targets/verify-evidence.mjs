import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const read = name => readFile(new URL(name, import.meta.url))
const json = async name => JSON.parse((await read(name)).toString('utf8'))
const receipts = [...await json('source-http.json'), ...await json('additional-source-http.json')]
for (const receipt of receipts) {
  if (receipt.error) continue
  const bytes = await read(receipt.file)
  assert.equal(bytes.length, receipt.bytes, receipt.file)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256, receipt.file)
}
const records = await json('target-records.json')
const inspected = await json('gazetteer-inspection.json')
for (const record of records) {
  const source = inspected.find(item => item.id === record.id)
  assert(source)
  assert.equal(source.coordinateConvention, 'Planetocentric, +East, 0 - 360')
  assert.equal(source.network.name, record.controlNetwork)
  assert.equal(source.network.id, record.controlNetworkId)
  assert.equal(source.featureId, record.featureId)
  assert(source.selectedGeometryRows.some(row => row === `Center Longitude ${record.coordinate.lon.toFixed(2)}` || row === `Center Longitude ${record.coordinate.lon}`))
  assert(source.selectedGeometryRows.some(row => row === `Center Latitude ${record.coordinate.lat.toFixed(2)}` || row === `Center Latitude ${record.coordinate.lat}`))
  assert.equal(receipts.find(receipt => receipt.file === record.coordinateEvidenceFile).status, 200)
  assert.equal(receipts.find(receipt => receipt.file === record.scienceEvidenceFile).status, 200)
}
assert((await read('belva-nasa-science.html')).toString('utf8').includes('vertical cross-section'))
assert((await read('neretva-nasa-science-valid.html')).toString('utf8').includes('PIA26335'))
assert((await read('jezero-nasa-science.html')).toString('utf8').includes('confluence'))
assert((await read('gazetteer-accuracy-text.txt')).toString('utf8').includes('Everything in the Gazetteer of Planetary Nomenclature is in the public domain'))
console.log(JSON.stringify({receiptFilesVerified: receipts.filter(receipt=>!receipt.error).length, proposedRecordsVerified: records.length, coordinateRegistration: 'Convention checked; MDIM 2.1 fine registration to current preliminary CTX remains unverified.', result: 'PASS'},null,2))
