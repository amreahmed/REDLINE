import { writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const sources = [
  ['neretva-nasa-science-valid.html', 'https://science.nasa.gov/photojournal/perseverances-view-of-neretva-vallis-river-channel/'],
  ['jezero-nasa-science.html', 'https://science.nasa.gov/resource/perseverance-view-of-the-delta-in-jezero-crater/'],
  ['gazetteer-accuracy.html', 'https://planetarynames.wr.usgs.gov/Page/FAQ'],
]
const receipts = await Promise.all(sources.map(async ([file, url]) => {
  const startedAt = new Date().toISOString()
  try {
    const response = await fetch(url, { headers: { Origin: 'http://127.0.0.1:5173', 'User-Agent': 'REDLINE-source-verification/0.1' }, signal: AbortSignal.timeout(45000) })
    const bytes = Buffer.from(await response.arrayBuffer())
    await writeFile(new URL(file, import.meta.url), bytes)
    return { file, requestedUrl: url, finalUrl: response.url, status: response.status, startedAt, retrievedAt: new Date().toISOString(), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), contentType: response.headers.get('content-type'), cors: response.headers.get('access-control-allow-origin') }
  } catch (error) { return { file, requestedUrl: url, startedAt, completedAt: new Date().toISOString(), error: String(error) } }
}))
await writeFile(new URL('additional-source-http.json', import.meta.url), JSON.stringify(receipts, null, 2) + '\n')
console.log(JSON.stringify(receipts, null, 2))
