import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
if (process.argv.includes('--verify-saved')) {
  const receipts = JSON.parse(await readFile(path.join(directory, 'hrsc-header-receipts.json'), 'utf8'))
  for (const receipt of receipts) {
    const bytes = await readFile(path.join(directory, receipt.file))
    if (receipt.status !== 206 || bytes.length !== 65536 || createHash('sha256').update(bytes).digest('hex') !== receipt.sha256 || !/^bytes 0-65535\/\d+$/.test(receipt.contentRange)) throw new Error('Changed HRSC header response')
  }
  console.log('Verified two saved HRSC 64KiB header ranges.')
} else {
await mkdir(directory, { recursive: true })
const urls = ['dt5', 'da5'].map(kind => [`hrsc-${kind}-header.bin`, `https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_${kind}.tif`])
const receipts = await Promise.all(urls.map(async ([file, requestedUrl]) => {
  const startedAt = new Date().toISOString()
  const response = await fetch(requestedUrl, { headers: { Range: 'bytes=0-65535' }, signal: AbortSignal.timeout(45000) })
  if (response.status !== 206) {
    await response.body?.cancel()
    return { requestedUrl, finalUrl: response.url, startedAt, retrievedAt: new Date().toISOString(), status: response.status, contentType: response.headers.get('content-type'), contentLength: response.headers.get('content-length'), contentRange: response.headers.get('content-range'), failure: 'Expected bounded HTTP 206; did not consume an unbounded response' }
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  const receipt = { file, requestedUrl, finalUrl: response.url, startedAt, retrievedAt: new Date().toISOString(), status: response.status, contentType: response.headers.get('content-type'), contentRange: response.headers.get('content-range'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
  await writeFile(path.join(directory, file), bytes)
  return receipt
}))
await writeFile(path.join(directory, 'hrsc-header-receipts.json'), JSON.stringify(receipts, null, 2) + '\n')
console.log(JSON.stringify(receipts, null, 2))
}
