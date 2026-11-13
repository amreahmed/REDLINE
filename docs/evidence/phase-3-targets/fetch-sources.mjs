import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const folder = fileURLToPath(new URL('.', import.meta.url))
await mkdir(folder, { recursive: true })
const sources = [
  ['jezero-gazetteer.html', 'https://planetarynames.wr.usgs.gov/Feature/14300'],
  ['belva-gazetteer.html', 'https://planetarynames.wr.usgs.gov/Feature/15872'],
  ['neretva-gazetteer.html', 'https://planetarynames.wr.usgs.gov/Feature/15879'],
  ['sava-gazetteer.html', 'https://planetarynames.wr.usgs.gov/Feature/15904'],
  ['mars-coordinate-guidance.html', 'https://planetarynames.wr.usgs.gov/Page/MARS/system'],
  ['belva-nasa-science.html', 'https://science.nasa.gov/resource/perseverance-takes-in-view-at-belva-crater/'],
  ['belva-jpl-science.html', 'https://www.jpl.nasa.gov/news/nasas-perseverance-rover-captures-view-of-mars-belva-crater/'],
  ['jezero-jpl-science.html', 'https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/landing_site/'],
  ['neretva-nasa-science.html', 'https://science.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-perseverance-rover-to-begin-long-climb-up-martian-crater-rim/'],
  ['usgs-copyright.html', 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits'],
  ['nasa-use-guidance.html', 'https://www.nasa.gov/nasa-brand-center/images-and-media/'],
  ['m20-waypoints.json', 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json'],
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
await writeFile(new URL('source-http.json', import.meta.url), JSON.stringify(receipts, null, 2) + '\n')
console.log(JSON.stringify(receipts, null, 2))
