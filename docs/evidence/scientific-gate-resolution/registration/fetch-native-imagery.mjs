import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const directory = new URL('./', import.meta.url)
const places = 'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/'
const ctx = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0'
const sources = [
  ['controlled-ctx-native.tif', `${ctx}.tif`],
  ['controlled-ctx-native.xml', `${ctx}.xml`],
  ['controlled-ctx-native.lbl', `${ctx}.lbl`],
  ['controlled-ctx-native-pds3.lbl', `${ctx}_pds3.lbl`],
  ['best_tactical-siteframe.xmlx', `${places}data_localizations/best_tactical_raw/m20_best_tactical_siteframe.xmlx`],
  ['best_tactical-siteframe.xmlx.xml', `${places}data_localizations/best_tactical_raw/m20_best_tactical_siteframe.xmlx.xml`],
  ['places-map-headers.bin', `${places}data_maps/m20_orbital_map.img`, 'bytes=0-118399'],
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
let receipts
if (process.argv.includes('--verify-saved')) receipts = JSON.parse(await readFile(new URL('native-imagery-http-receipts.json', directory), 'utf8'))
else {
  receipts = await Promise.all(sources.map(async ([file, url, range]) => {
    const retrievedUtc = new Date().toISOString()
    try {
      const response = await fetch(url, { headers: range ? { Range: range } : {}, signal: AbortSignal.timeout(55000) })
      // Reject an ignored range rather than downloading the multi-GB map.
      if (range && response.status !== 206) { await response.body?.cancel(); return { file, requestedUrl: url, retrievedUtc, status: response.status, range, error: 'Server did not honor byte range' } }
      const bytes = Buffer.from(await response.arrayBuffer())
      await writeFile(new URL(file, directory), bytes)
      return { file, requestedUrl: url, finalUrl: response.url, retrievedUtc, status: response.status, range, contentRange: response.headers.get('content-range'), bytes: bytes.length, sha256: hash(bytes), contentType: response.headers.get('content-type'), cors: response.headers.get('access-control-allow-origin') }
    } catch (error) { return { file, requestedUrl: url, retrievedUtc, range, error: String(error) } }
  }))
  await writeFile(new URL('native-imagery-http-receipts.json', directory), JSON.stringify(receipts, null, 2) + '\n')
}
for (const receipt of receipts) {
  if (receipt.error) continue
  const bytes = await readFile(new URL(receipt.file, directory))
  assert.equal(bytes.length, receipt.bytes)
  assert.equal(hash(bytes), receipt.sha256)
}
console.log(JSON.stringify(receipts.map(({ file, status, bytes, error }) => ({ file, status, bytes, error })), null, 2))
