import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { readFile, writeFile } from 'node:fs/promises'

const dir = new URL('./', import.meta.url)
const plan = JSON.parse(await readFile(new URL('native-patch-plan.json', dir), 'utf8'))
const placesUrl = 'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_maps/m20_orbital_map.img'
const ctxUrl = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif'
const hash = b => createHash('sha256').update(b).digest('hex')
function decodeNative(bytes, receipt) {
  const b = receipt.file.endsWith('.gz') ? gunzipSync(bytes) : bytes
  if (receipt.encoding === 'horizontal-delta-u8-gzip') {
    const width = receipt.compressionRowWidth
    for (let i = 0; i < b.length; i++) if (i % width) b[i] = (b[i] + b[i-1]) & 255
  }
  return b
}
const ctxRanges = [
  { file: 'ctx-header-range.bin', start: 0, end: 65535 },
  // Byte offset from exact provider PDS3 label; preserved crop plus guard rows.
  { file: 'ctx-crop-row-range.bin', start: 30921 + 1900 * 5322, end: 30921 + 2851 * 5322 - 1 },
]

function unpackMultipart(bytes, type, ranges) {
  const boundary = type.match(/boundary=(?:"([^"]+)"|([^;]+))/)
  assert(boundary, type)
  const marker = Buffer.from('--' + (boundary[1] ?? boundary[2]))
  const parts = []
  let cursor = 0
  for (const range of ranges) {
    assert.equal(bytes.indexOf(marker, cursor), cursor)
    const headerStart = cursor + marker.length + 2
    const headerEnd = bytes.indexOf(Buffer.from('\r\n\r\n'), headerStart)
    assert(headerEnd >= 0)
    const header = bytes.subarray(headerStart, headerEnd).toString('ascii')
    const cr = header.match(/Content-Range: bytes (\d+)-(\d+)\/(\d+)/i)
    assert(cr, header)
    assert.equal(Number(cr[1]), range.start)
    assert.equal(Number(cr[2]), range.end)
    assert.equal(Number(cr[3]), 3893110400)
    const start = headerEnd + 4
    const end = start + range.end - range.start + 1
    parts.push(bytes.subarray(start, end))
    assert.equal(bytes.subarray(end, end + 2).toString('ascii'), '\r\n')
    cursor = end + 2
  }
  assert(bytes.subarray(cursor).toString('ascii').startsWith(marker.toString('ascii') + '--'))
  return Buffer.concat(parts)
}

if (process.argv.includes('--verify-saved')) {
  let receipts
  try { receipts = JSON.parse(gunzipSync(await readFile(new URL('native-patch-http-receipts.json.gz', dir))).toString('utf8')) }
  catch { receipts = JSON.parse(await readFile(new URL('native-patch-http-receipts.json', dir), 'utf8')) }
  for (const r of receipts.ctx) {
    const b = decodeNative(await readFile(new URL(r.file, dir)), r)
    assert.equal(hash(b), r.sha256)
    assert.equal(b.length, r.end-r.start+1)
  }
  for (const p of receipts.patches) {
    const b = decodeNative(await readFile(new URL(p.file, dir)), p)
    assert.equal(hash(b), p.rawSha256)
    assert.equal(b.length, p.size * p.size)
    for (const batch of p.requests) {
      const piece = b.subarray(batch.patchOffsetBytes, batch.patchOffsetBytes + batch.selectedDataBytes)
      assert.equal(hash(piece), batch.selectedDataSha256)
    }
  }
  console.log(`Verified ${receipts.ctx.length} CTX ranges and ${receipts.patches.length} lossless native PLACES patches.`)
  process.exit(0)
}

const receipts = { purpose: 'Native imagery byte-range evidence. PLACES first band only, no interpolation, resampling or radiometric conversion in retrieval.', ctx: [], patches: [] }
for (const r of ctxRanges) {
  const retrievedUtc = new Date().toISOString()
  const response = await fetch(ctxUrl, { headers: { Range: `bytes=${r.start}-${r.end}` }, signal: AbortSignal.timeout(55000) })
  assert.equal(response.status, 206)
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(bytes.length, r.end-r.start+1)
  await writeFile(new URL(r.file, dir), bytes)
  receipts.ctx.push({ ...r, requestedUrl: ctxUrl, finalUrl: response.url, retrievedUtc, status: response.status, contentRange: response.headers.get('content-range'), bytes: bytes.length, sha256: hash(bytes), cors: response.headers.get('access-control-allow-origin') })
}
await writeFile(new URL('native-patch-http-receipts.json', dir), JSON.stringify(receipts, null, 2) + '\n')

const jobs = []
for (const p of plan.patches) {
  const record = { ...p, file: `places-native-${p.id}-band0.u8.gz`, requests: [] }
  receipts.patches.push(record)
  const output = Buffer.alloc(p.size*p.size)
  record.output = output
  for (let row = 0; row < p.size; row += 64) {
    const rows = Math.min(64, p.size-row)
    const ranges = Array.from({ length: rows }, (_, i) => {
      const start = plan.mapOffsetBytes + (p.placesBandIndexZeroBased * plan.mapLines + p.placesLineStart+row+i)*plan.mapSamples + p.placesSampleStart
      return { start, end: start+p.size-1 }
    })
    jobs.push({ record, row, ranges })
  }
}
await Promise.all(Array.from({ length: 6 }, async () => {
  while (jobs.length) {
    const { record, row, ranges } = jobs.shift()
    const range = 'bytes=' + ranges.map(r => `${r.start}-${r.end}`).join(',')
    const retrievedUtc = new Date().toISOString()
    let lastError
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(placesUrl, { headers: { Range: range }, signal: AbortSignal.timeout(30000) })
        assert.equal(response.status, 206)
        const bytes = Buffer.from(await response.arrayBuffer())
        const selected = unpackMultipart(bytes, response.headers.get('content-type'), ranges)
        assert.equal(selected.length, ranges.length*record.size)
        selected.copy(record.output, row*record.size)
        record.requests.push({ requestedUrl: placesUrl, retrievedUtc, status: response.status, range, responseBytes: bytes.length, responseSha256: hash(bytes), selectedDataBytes: selected.length, selectedDataSha256: hash(selected), patchOffsetBytes: row*record.size, attempts: attempt+1 })
        lastError = undefined
        break
      } catch (error) { lastError = error }
    }
    if (lastError) throw lastError
  }
}))
for (const p of receipts.patches) {
  p.requests.sort((a,b) => a.patchOffsetBytes-b.patchOffsetBytes)
  p.rawSha256 = hash(p.output)
  p.rawBytes = p.output.length
  const compressed = gzipSync(p.output)
  p.compressedBytes = compressed.length
  await writeFile(new URL(p.file, dir), compressed)
  delete p.output
}
await writeFile(new URL('native-patch-http-receipts.json', dir), JSON.stringify(receipts, null, 2) + '\n')
console.log(JSON.stringify({ ctxRangeBytes: receipts.ctx.map(r=>r.bytes), nativePatches: receipts.patches.map(p=>({ id:p.id, bytes:p.rawBytes, compressedBytes:p.compressedBytes, requests:p.requests.length })) }, null, 2))
