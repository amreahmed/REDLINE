import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import https from 'node:https'

const directory = new URL('./', import.meta.url)
const manifestPath = new URL('http-receipts.json', directory)
let receipts
try { receipts = JSON.parse(await readFile(manifestPath, 'utf8')) } catch { receipts = [] }

const resources = JSON.parse(process.argv[2])
for (let start = 0; start < resources.length; start += 4) {
  const results = await Promise.all(resources.slice(start, start + 4).map(async ({ name, url, method = 'GET', headers = {}, diagnosticUnverifiedTls = false }) => {
    const fetchedAt = new Date().toISOString()
    try {
      const response = diagnosticUnverifiedTls ? await new Promise((resolve, reject) => {
        const request = https.request(url, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'REDLINE-source-audit/1.0', ...headers }, timeout: 35_000 }, result => {
          const chunks = []
          result.on('data', chunk => chunks.push(chunk))
          result.on('end', () => resolve({ url, status: result.statusCode, headers: new Headers(result.headers), arrayBuffer: async () => Buffer.concat(chunks) }))
          result.on('error', reject)
        })
        request.on('error', reject)
        request.on('timeout', () => request.destroy(new Error('Diagnostic HTTPS request timed out')))
        request.end()
      }) : await fetch(url, { method, headers: { 'User-Agent': 'REDLINE-source-audit/1.0', ...headers }, signal: AbortSignal.timeout(35_000) })
      const bytes = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get('content-type') ?? ''
      const extension = contentType.includes('json') ? 'json' : contentType.includes('xml') ? 'xml' : contentType.includes('image/png') ? 'png' : contentType.includes('pdf') ? 'pdf' : contentType.includes('html') ? 'html' : 'bin'
      const file = `${name}.${extension}`
      await writeFile(new URL(file, directory), bytes)
      const receipt = { name, requestedUrl: url, finalUrl: response.url, fetchedAt, method, requestHeaders: headers, tlsVerified: !diagnosticUnverifiedTls, tlsWarning: diagnosticUnverifiedTls ? 'Diagnostic public-page retrieval only: the normal TLS chain validation failed; this response does not establish authenticated current official rules.' : undefined, status: response.status, contentType, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), file, responseHeaders: Object.fromEntries(response.headers) }
      return receipt
    } catch (error) {
      return { name, requestedUrl: url, fetchedAt, method, requestHeaders: headers, error: String(error), cause: error.cause ? String(error.cause) : undefined }
    }
  }))
  for (const receipt of results) {
    receipts = receipts.filter(existing => existing.name !== receipt.name)
    receipts.push(receipt)
    console.log(JSON.stringify({ name: receipt.name, status: receipt.status, finalUrl: receipt.finalUrl, bytes: receipt.bytes, contentType: receipt.contentType, error: receipt.error }))
  }
  await writeFile(manifestPath, JSON.stringify(receipts, null, 2) + '\n')
}
