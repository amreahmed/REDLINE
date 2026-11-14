import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const directory = new URL('./', import.meta.url)
const base = 'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/'
const sources = [
  ['places-root-index.html', base],
  ['places-bundle.xml', `${base}bundle.xml`],
  ['localizations-index.html', `${base}data_localizations/`],
  ['maps-index.html', `${base}data_maps/`],
  ['orbital-index.html', `${base}data_orbital/`],
  ['best_tactical.csv', `${base}data_localizations/best_tactical.csv`],
  ['best_tactical.csv.xml', `${base}data_localizations/best_tactical.csv.xml`],
  ['view_metadata.csv', `${base}data_localizations/view_metadata.csv`],
  ['view_metadata.csv.xml', `${base}data_localizations/view_metadata.csv.xml`],
  ['m20_orbital_map.xml', `${base}data_maps/m20_orbital_map.xml`],
  ['m20_orbital_dem.xml', `${base}data_maps/m20_orbital_dem.xml`],
  ['orbital_1_metadata.csv', `${base}data_orbital/orbital_1_metadata.csv`],
  ['orbital_1_metadata.csv.xml', `${base}data_orbital/orbital_1_metadata.csv.xml`],
  ['orbital_2_metadata.csv', `${base}data_orbital/orbital_2_metadata.csv`],
  ['orbital_2_metadata.csv.xml', `${base}data_orbital/orbital_2_metadata.csv.xml`],
  ['orbital_origin.csv', `${base}data_orbital/orbital_origin.csv`],
  ['orbital_origin.csv.xml', `${base}data_orbital/orbital_origin.csv.xml`],
  ['orbital_origin_global.csv', `${base}data_orbital/orbital_origin_global.csv`],
  ['orbital_origin_global.csv.xml', `${base}data_orbital/orbital_origin_global.csv.xml`],
  ['places-product-md5.txt', `${base}urn-nasa-pds-mars2020_rover_places.md5`],
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(directory, { recursive: true })
let receipts
if (process.argv.includes('--verify-saved')) {
  receipts = JSON.parse(await readFile(new URL('places-http-receipts.json', directory), 'utf8'))
} else {
  const pending = sources.slice()
  receipts = []
  // Bounded concurrency; no raster downloads in this metadata/control retrieval.
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (pending.length) {
      const [file, url] = pending.shift()
      const retrievedUtc = new Date().toISOString()
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
        const bytes = Buffer.from(await response.arrayBuffer())
        await writeFile(new URL(file, directory), bytes)
        receipts.push({ file, requestedUrl: url, finalUrl: response.url, retrievedUtc, status: response.status, bytes: bytes.length, sha256: hash(bytes), contentType: response.headers.get('content-type'), cors: response.headers.get('access-control-allow-origin') })
      } catch (error) {
        receipts.push({ file, requestedUrl: url, retrievedUtc, error: String(error) })
      }
    }
  }))
  receipts.sort((a, b) => sources.findIndex(([f]) => f === a.file) - sources.findIndex(([f]) => f === b.file))
  await writeFile(new URL('places-http-receipts.json', directory), JSON.stringify(receipts, null, 2) + '\n')
}
assert.equal(receipts.length, sources.length)
for (const [file, url] of sources) {
  const receipt = receipts.find(value => value.file === file && value.requestedUrl === url)
  assert(receipt, file)
  if (receipt.error) continue
  const bytes = await readFile(new URL(file, directory))
  assert.equal(bytes.length, receipt.bytes, file)
  assert.equal(hash(bytes), receipt.sha256, file)
}
console.log(JSON.stringify(receipts.map(({ file, status, bytes, error }) => ({ file, status, bytes, error })), null, 2))
