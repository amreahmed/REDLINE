import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const here = new URL('./', import.meta.url)
const saved = process.argv.includes('--verify-saved')
const receipts = saved ? JSON.parse(await readFile(new URL('http-receipts.json', here), 'utf8')) : []
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(here, { recursive: true })
async function resource(file, url, range = null) {
  if (saved) {
    const receipt = receipts.find(item => item.file === file)
    assert(receipt && receipt.url === url && receipt.range === range)
    const bytes = await readFile(new URL(file, here))
    assert.equal(bytes.length, receipt.bytes)
    assert.equal(digest(bytes), receipt.sha256)
    return { bytes, receipt }
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: range ? { Range: range } : {} })
  const bytes = Buffer.from(await response.arrayBuffer())
  const receipt = { file, url, range, finalUrl: response.url, retrievedAt: new Date().toISOString(), status: response.status,
    contentType: response.headers.get('content-type'), contentRange: response.headers.get('content-range'), bytes: bytes.length, sha256: digest(bytes),
    tlsPolicy: 'Node built-in fetch, normal TLS certificate verification' }
  await writeFile(new URL(file, here), bytes)
  receipts.push(receipt)
  await writeFile(new URL('http-receipts.json', here), JSON.stringify(receipts, null, 2) + '\n')
  return { bytes, receipt }
}
const pageUrl = 'https://www.uahirise.org/dtm/ESP_023524_1985'
const page = await resource('hirise-product.html', pageUrl)
assert.equal(page.receipt.status, 200)
const links = [...page.bytes.toString('utf8').matchAll(/href\s*=\s*["']([^"']+)["']/g)].map(match => new URL(match[1], pageUrl).href)
const demUrl = links.find(url => url.endsWith('/DTEEC_023524_1985_023379_1985_U01.IMG'))
assert(demUrl, 'Exact DTM image link missing from authoritative page')
const header = await resource('hirise-dtm-label-range.bin', demUrl, 'bytes=0-65535')
assert.equal(header.receipt.status, 206)
assert.match(header.receipt.contentRange, /^bytes 0-65535\/\d+$/)
assert.equal(header.bytes.length, 65536)
const ascii = header.bytes.toString('latin1')
const end = /^END[ \t]*(?:\r?\n|$)/m.exec(ascii)
assert(end, 'Complete attached PDS label END is absent from range')
const labelBytes = header.bytes.subarray(0, end.index + end[0].length)
assert.match(labelBytes.toString('latin1'), /PRODUCT_ID\s*=\s*["']?DTEEC_023524_1985_023379_1985_U01/)
const labelPath = new URL('hirise-dtm-complete.lbl', here)
if (saved) assert((await readFile(labelPath)).equals(labelBytes))
else await writeFile(labelPath, labelBytes)
console.log(JSON.stringify({ page: page.receipt, labelResponse: header.receipt, completeLabelBytes: labelBytes.length,
  completeLabelSha256: digest(labelBytes),
  associatedOrthoLinks: links.filter(url => /\/ESP_(?:023524|023379)_1985_RED_[AC]_01_ORTHO\.JP2$/.test(url)),
  relevantLinks: links.filter(url => /DTEEC_023524_1985_023379_1985_U01|dtm_about|RDR.*SIS/i.test(url)) }, null, 2))
