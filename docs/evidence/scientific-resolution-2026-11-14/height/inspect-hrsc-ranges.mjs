// Bounded, receipt-backed inspection of paired HRSC TIFFs; no production assets change.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const saved = process.argv.includes('--verify-saved')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const receiptPath = path.join(directory, 'hrsc-extra-range-receipts.json')
let receipts = []
try { receipts = JSON.parse(await readFile(receiptPath, 'utf8')) } catch { /* first run */ }
const results = {}
for (const kind of ['dt5', 'da5']) {
  const requestedUrl = `https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_${kind}.tif`
  const header = await readFile(path.join(directory, `hrsc-${kind}-header.bin`))
  if (header.toString('ascii', 0, 2) !== 'II' || header.readUInt16LE(2) !== 42) throw new Error('Expected inspected little-endian Classic TIFF')
  const headerReceipt = JSON.parse(await readFile(path.join(directory, 'hrsc-header-receipts.json'), 'utf8')).find(receipt => receipt.file === `hrsc-${kind}-header.bin`)
  if (hash(header) !== headerReceipt.sha256) throw new Error('HRSC header changed')
  const totalBytes = Number(headerReceipt.contentRange.split('/')[1])
  async function range(start, bytes) {
    const end = start + bytes - 1
    if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > 2000000 || end >= totalBytes) throw new Error('Range outside bounded inspected TIFF')
    if (end < header.length) return header.subarray(start, end + 1)
    const file = `hrsc-${kind}-range-${start}-${end}.bin`
    const previous = receipts.find(receipt => receipt.file === file)
    if (previous) {
      const body = await readFile(path.join(directory, file))
      if (body.length !== bytes || hash(body) !== previous.sha256 || previous.status !== 206 || previous.contentRange !== `bytes ${start}-${end}/${totalBytes}`) throw new Error('Changed saved range')
      return body
    }
    if (saved) throw new Error(`Missing saved range: ${file}`)
    const startedAt = new Date().toISOString()
    const response = await fetch(requestedUrl, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(45000) })
    if (response.status !== 206) { await response.body?.cancel(); throw new Error(`Bounded range unavailable: HTTP ${response.status}`) }
    const body = Buffer.from(await response.arrayBuffer())
    if (body.length !== bytes || response.headers.get('content-range') !== `bytes ${start}-${end}/${totalBytes}`) throw new Error('Range response mismatch')
    const receipt = { file, requestedUrl, finalUrl: response.url, requestedRange: `bytes=${start}-${end}`, startedAt, retrievedAt: new Date().toISOString(), status: response.status, contentRange: response.headers.get('content-range'), bytes: body.length, sha256: hash(body) }
    await writeFile(path.join(directory, file), body)
    receipts.push(receipt)
    await writeFile(receiptPath, JSON.stringify(receipts, null, 2) + '\n')
    return body
  }
  const offset = header.readUInt32LE(4)
  const count = (await range(offset, 2)).readUInt16LE()
  const ifd = await range(offset + 2, count * 12 + 4)
  const tags = {}
  for (let index = 0; index < count; index += 1) {
    const entry = ifd.subarray(index * 12, index * 12 + 12)
    const tag = entry.readUInt16LE(0)
    const type = entry.readUInt16LE(2)
    const length = entry.readUInt32LE(4)
    const size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8 })[type]
    if (!size) throw new Error(`Unhandled TIFF field type ${type}`)
    const payload = length * size <= 4 ? entry.subarray(8, 8 + length * size) : await range(entry.readUInt32LE(8), length * size)
    if (type === 2) { tags[tag] = payload.toString('ascii').replace(/\0+$/, ''); continue }
    const numbers = []
    for (let n = 0; n < length; n += 1) numbers.push(({ 1: () => payload.readUInt8(n), 3: () => payload.readUInt16LE(n * 2), 4: () => payload.readUInt32LE(n * 4), 5: () => payload.readUInt32LE(n * 8) / payload.readUInt32LE(n * 8 + 4), 11: () => payload.readFloatLE(n * 4), 12: () => payload.readDoubleLE(n * 8) })[type]())
    tags[tag] = numbers
  }
  const keys = []
  const geo = tags[34735]
  for (let index = 0; index < geo[3]; index += 1) {
    const [key, location, length, valueOffset] = geo.slice(4 + index * 4, 8 + index * 4)
    keys.push({ key, value: location === 0 ? valueOffset : typeof tags[location] === 'string' ? tags[location].slice(valueOffset, valueOffset + length) : tags[location].slice(valueOffset, valueOffset + length) })
  }
  results[kind] = { totalBytes, ifdOffset: offset, width: tags[256][0], height: tags[257][0], bitsPerSample: tags[258], compression: tags[259][0], samplesPerPixel: tags[277][0], rowsPerStrip: tags[278][0], sampleFormat: tags[339], pixelScale: tags[33550], tiepoint: tags[33922], geokeys: keys, gdalMetadata: tags[42112] ?? null, noData: tags[42113] ?? null, stripOffsets: tags[273], stripByteCounts: tags[279] }
}
const output = JSON.stringify(results, null, 2) + '\n'
const outputPath = path.join(directory, 'hrsc-tiff-contracts.json')
if (saved) { if (await readFile(outputPath, 'utf8') !== output) throw new Error('Changed HRSC TIFF contract') }
else await writeFile(outputPath, output)
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([kind, result]) => [kind, { ...result, stripOffsets: `${result.stripOffsets.length} receipts-backed strip offsets`, stripByteCounts: `${result.stripByteCounts.length} receipts-backed strip lengths` }])), null, 2))
