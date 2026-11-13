import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const name = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0'
const read = file => readFile(new URL(file, import.meta.url))
const bytes = await read(`${name}.tif`)
const receipts = JSON.parse((await read('numeric-source-http.json')).toString('utf8'))
const receipt = receipts.find(item => item.file === `${name}.tif`)
assert.equal(bytes.length, receipt.bytes)
assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256)
assert.equal(bytes.toString('ascii', 0, 2), 'II')
assert.equal(bytes.readUInt16LE(2), 42)

const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }
const ifd = bytes.readUInt32LE(4)
const count = bytes.readUInt16LE(ifd)
const tags = new Map()
for (let index = 0; index < count; index++) {
  const entry = ifd + 2 + 12 * index
  const tag = bytes.readUInt16LE(entry)
  const type = bytes.readUInt16LE(entry + 2)
  const length = bytes.readUInt32LE(entry + 4)
  assert(sizes[type])
  const pointer = length * sizes[type] <= 4 ? entry + 8 : bytes.readUInt32LE(entry + 8)
  assert(pointer + length * sizes[type] <= bytes.length)
  let value
  if (type === 2) value = bytes.toString('utf8', pointer, pointer + length).replace(/\0$/, '')
  else if (type === 3) value = Array.from({ length }, (_, i) => bytes.readUInt16LE(pointer + i * 2))
  else if (type === 4) value = Array.from({ length }, (_, i) => bytes.readUInt32LE(pointer + i * 4))
  else if (type === 12) value = Array.from({ length }, (_, i) => bytes.readDoubleLE(pointer + i * 8))
  else throw new Error(`Unsupported TIFF tag type ${type}; revalidate the source`)
  tags.set(tag, value)
}
const width = tags.get(256)[0]
const height = tags.get(257)[0]
assert.equal(width, 1596)
assert.equal(height, 1512)
assert.equal(tags.get(258)[0], 32)
assert.equal(tags.get(259)[0], 1) // Uncompressed, not a general TIFF decoder.
assert.equal(tags.get(277)[0], 1)
assert.equal(tags.get(278)[0], 1)
assert.equal(tags.get(339)[0], 3)
assert.deepEqual(tags.get(33550), [20, 20, 0])
assert.deepEqual(tags.get(33922), [0, 0, 0, 4573663.250853, 1109693.140188, 0])
const noData = Math.fround(Number(tags.get(42113)))
const offsets = tags.get(273)
const stripBytes = tags.get(279)
assert.equal(offsets.length, height)
assert.equal(stripBytes.length, height)
let valid = 0
let missing = 0
let minimum = Infinity
let maximum = -Infinity
for (let row = 0; row < height; row++) {
  assert.equal(stripBytes[row], width * 4)
  assert(offsets[row] + stripBytes[row] <= bytes.length)
  for (let column = 0; column < width; column++) {
    const value = bytes.readFloatLE(offsets[row] + column * 4)
    if (value === noData || !Number.isFinite(value)) { missing++; continue }
    valid++
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  }
}
const summary = {
  source: name,
  sourceBytes: bytes.length,
  sourceSha256: receipt.sha256,
  format: 'Classic little-endian GeoTIFF, uncompressed single-row strips; not COG',
  width, height, bands: 1, sampleType: 'IEEE float32', scale: 1, offset: 0,
  geotransform: [4573663.250853, 20, 0, 1109693.140188, 0, -20],
  noData, validCells: valid, missingCells: missing, minimum, maximum,
  valueUnit: 'meters according to provider FGDC',
  verticalReference: 'Provider FGDC declares Mars 2020 IAU Sphere, radius 3396190m; not independently validated',
  metadataRangeMatchesActualPayload: false,
}
await writeFile(new URL('numeric-inspection.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
