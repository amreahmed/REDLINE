import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const directory = new URL('./', import.meta.url)
const file = 'Mars2020_Rover_PLACES_PDS_SIS.pdf'
const url = 'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/document/Mars2020_Rover_PLACES_PDS_SIS.pdf'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
let receipt
if (process.argv.includes('--verify-saved')) {
  receipt = JSON.parse(await readFile(new URL('places-sis-http-receipt.json', directory), 'utf8'))
} else {
  const retrievedUtc = new Date().toISOString()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
    const bytes = Buffer.from(await response.arrayBuffer())
    await writeFile(new URL(file, directory), bytes)
    receipt = { file, requestedUrl: url, finalUrl: response.url, retrievedUtc, status: response.status, bytes: bytes.length, sha256: hash(bytes), contentType: response.headers.get('content-type') }
  } catch (error) {
    receipt = { file, requestedUrl: url, retrievedUtc, error: String(error) }
  }
  await writeFile(new URL('places-sis-http-receipt.json', directory), JSON.stringify(receipt, null, 2) + '\n')
}
assert.equal(receipt.file, file)
assert.equal(receipt.requestedUrl, url)
if (!receipt.error) {
  const bytes = await readFile(new URL(file, directory))
  assert.equal(bytes.length, receipt.bytes)
  assert.equal(hash(bytes), receipt.sha256)
  if (receipt.status === 200) assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-')
}
console.log(JSON.stringify(receipt, null, 2))
