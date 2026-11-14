import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const directory = path.dirname(fileURLToPath(import.meta.url))
const receiptPath = path.join(directory, 'http-receipts.json')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(directory, { recursive: true })
let receipts = []
try { receipts = JSON.parse(await readFile(receiptPath, 'utf8')) } catch { /* first run */ }

if (process.argv.includes('--verify-saved')) {
  for (const receipt of receipts) {
    if (!receipt.file) continue
    const bytes = await readFile(path.join(directory, receipt.file))
    if (bytes.length !== receipt.bytes || hash(bytes) !== receipt.sha256) {
      throw new Error(`Changed evidence: ${receipt.file}`)
    }
  }
  console.log(`Verified ${receipts.filter(receipt => receipt.file).length} saved public response bodies.`)
} else {
  const resources = JSON.parse(await readFile(path.join(directory, process.argv[2] ?? 'resources.json'), 'utf8'))
  for (const resource of resources) {
    if (!/^[a-zA-Z0-9._-]+$/.test(resource.file)) throw new Error(`Unsafe filename: ${resource.file}`)
    const prior = receipts.find(receipt => receipt.file === resource.file && receipt.requestedUrl === resource.url)
    if (prior) {
      const bytes = await readFile(path.join(directory, prior.file))
      if (bytes.length !== prior.bytes || hash(bytes) !== prior.sha256) throw new Error(`Changed evidence: ${prior.file}`)
      console.log(JSON.stringify({ file: prior.file, cached: true, status: prior.status, bytes: prior.bytes }))
      continue
    }
    const startedAt = new Date().toISOString()
    let receipt
    try {
      const response = await fetch(resource.url, { signal: AbortSignal.timeout(30000), headers: resource.headers })
      const limit = resource.maxBytes ?? 8000000
      const reader = response.body.getReader()
      const parts = []
      let total = 0
      while (true) {
        const part = await reader.read()
        if (part.done) break
        total += part.value.length
        if (total > limit) { await reader.cancel(); throw new Error(`Response exceeds ${limit} byte evidence limit`) }
        parts.push(Buffer.from(part.value))
      }
      const bytes = Buffer.concat(parts)
      await writeFile(path.join(directory, resource.file), bytes)
      receipt = {
        file: resource.file, requestedUrl: resource.url, finalUrl: response.url,
        startedAt, retrievedAt: new Date().toISOString(), status: response.status,
        requestHeaders: resource.headers ?? {}, responseHeaders: Object.fromEntries(response.headers),
        contentType: response.headers.get('content-type'), bytes: bytes.length, sha256: hash(bytes),
      }
    } catch (error) {
      receipt = { requestedUrl: resource.url, startedAt, retrievedAt: new Date().toISOString(), error: error.message, cause: error.cause?.message ?? null }
    }
    receipts.push(receipt)
    await writeFile(receiptPath, JSON.stringify(receipts, null, 2) + '\n')
    console.log(JSON.stringify({ file: receipt.file, status: receipt.status, bytes: receipt.bytes, contentType: receipt.contentType, error: receipt.error }))
  }
}
