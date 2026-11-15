import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

// Each actual attempt is appended. Failed responses are preserved, not upgraded.
const here = new URL('./', import.meta.url)
const sources = [
  ['hellas', 'https://planetarynames.wr.usgs.gov/Feature/2432'],
  ['curiosity-mission', 'https://science.nasa.gov/mission/msl-curiosity/'],
  ['perseverance-mission', 'https://science.nasa.gov/mission/mars-2020-perseverance/'],
]
const receipts = JSON.parse(await readFile(new URL('source-http.json', here), 'utf8'))
for (const [name, requestedUrl] of sources) {
  const retrievedAt = new Date().toISOString()
  try {
    const response = await fetch(requestedUrl, { signal: AbortSignal.timeout(25000) })
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(new URL(`${name}.html`, here), buffer)
    receipts.push({ name, requestedUrl, finalUrl: response.url, status: response.status, retrievedAt,
      contentType: response.headers.get('content-type'), bytes: buffer.length,
      sha256: createHash('sha256').update(buffer).digest('hex') })
    console.log(name, response.status, buffer.length)
  } catch (error) {
    receipts.push({ name, requestedUrl, retrievedAt, status: null, error: String(error) })
    console.log(name, String(error))
  }
  await writeFile(new URL('source-http.json', here), JSON.stringify(receipts, null, 2) + '\n')
}
