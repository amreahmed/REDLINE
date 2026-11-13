import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const read = (name) => readFile(new URL(name, import.meta.url))
const json = async (name) => JSON.parse((await read(name)).toString('utf8'))
const sets = [
  ['source-audit/', 'source-http.json'],
  ['source-audit/', 'numeric-source-http.json'],
  ['source-audit/', 'datum-research-http.json'],
  ['registration-sources/', 'http-receipts.json'],
]
let verified = 0
for (const [folder, file] of sets) {
  for (const receipt of await json(folder + file)) {
    if (receipt.error) continue
    const bytes = await read(folder + receipt.file)
    assert.equal(bytes.length, receipt.bytes, receipt.file)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256, receipt.file)
    verified++
  }
}
for (const [name, file] of [['header-range', 'header-range.bin'], ['belva-row-range', 'belva-row-range.bin']]) {
  const receipt = (await json('source-audit/range-http.json')).find((item) => item.name === name)
  assert(receipt)
  assert.equal(receipt.status, 206)
  const bytes = await read('source-audit/' + file)
  assert.equal(bytes.length, receipt.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256)
}
const inspection = await json('raster-inspection.json')
const asset = await read('../../../public/data/jezero-terrain-windows.json')
const expectedAssetHash = '7b655f1593091fede555394f2c685386b6a677ed4ca1a8ac0eb910130ea5928a'
assert.equal(asset.length, inspection.derivedBytes)
assert.equal(inspection.derivedSha256, expectedAssetHash)
assert.equal(createHash('sha256').update(asset).digest('hex'), expectedAssetHash)
assert(!asset.includes(13), 'Derived JSON must retain canonical LF bytes on every host')
const windows = JSON.parse(asset.toString('utf8'))
for (const fixture of inspection.fixtures) {
  const window = windows.windows.find((item) => item.id === fixture.id)
  assert(window)
  assert.equal(window.values[(fixture.row - window.startRow) * window.columns + fixture.column - window.startColumn], fixture.value)
}
console.log(JSON.stringify({ result: 'PASS', responseHashesVerified: verified, rangeHashesVerified: 2, nativeSampleFixturesVerified: inspection.fixtures.length, derivedBytes: asset.length, derivedSha256: expectedAssetHash, derivedEncoding: 'UTF-8/LF' }, null, 2))
