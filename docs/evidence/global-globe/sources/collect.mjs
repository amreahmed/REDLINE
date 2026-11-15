import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const here = new URL('./', import.meta.url)
await mkdir(here, { recursive: true })
if (process.argv.includes('--verify-saved')) {
  const receipts = JSON.parse(await readFile(new URL('http-receipts.json', here), 'utf8'))
  let verified = 0
  for (const receipt of receipts) {
    if (receipt.error) continue
    const body = await readFile(new URL(receipt.file, here))
    assert.equal(body.length, receipt.bytes)
    assert.equal(createHash('sha256').update(body).digest('hex'), receipt.sha256)
    verified++
    if (receipt.headers['content-type'] === 'image/png') {
      assert.equal(body.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
      const expectedSize = receipt.file.startsWith('global-ctx') ? 512 : 256
      assert.equal(body.readUInt32BE(16), expectedSize)
      assert.equal(body.readUInt32BE(20), expectedSize)
      assert.equal(receipt.status, 200)
      assert.equal(receipt.headers['access-control-allow-origin'], '*')
    }
    if (receipt.headers['content-type'] === 'image/jpeg') {
      assert.equal(body.readUInt16BE(0), 0xffd8)
      let cursor = 2
      let dimensions
      while (cursor < body.length) {
        assert.equal(body[cursor++], 0xff)
        while (body[cursor] === 0xff) cursor++
        const marker = body[cursor++]
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          dimensions = [body.readUInt16BE(cursor + 5), body.readUInt16BE(cursor + 3)]
          break
        }
        assert.notEqual(marker, 0xda, 'JPEG dimensions must precede scan data')
        const segmentLength = body.readUInt16BE(cursor)
        assert.ok(segmentLength >= 2)
        cursor += segmentLength
      }
      assert.deepEqual(dimensions, [256, 256])
      assert.equal(receipt.status, 200)
      assert.equal(receipt.headers['access-control-allow-origin'], '*')
    }
  }
  console.log(JSON.stringify({ savedVerification: true, bodies: verified, recordedFailures: receipts.filter(receipt => receipt.error || receipt.status !== 200).length }))
  process.exit(0)
}
const requests = [
  ['trek-main-home.html', 'https://trek.nasa.gov/mars/'],
  ['trek-main-run.js.txt', 'https://trek.nasa.gov/mars/app/run.js?v=3.4.123-Mars'],
  ['trek-main-config.json', 'https://trek.nasa.gov/mars/jpl/config/config.json'],
  ['trek-main-basemap-list.json', 'https://trek.nasa.gov/mars/jpl/config/basemapList.json'],
  ['viking-capabilities.xml', 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml'],
  ['viking-tile0.jpg', 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/0/0/0.jpg'],
  ['viking-tile1.jpg', 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/0/0/1.jpg'],
  ['viking-trek-metadata.html', 'https://trek.nasa.gov/mars/TrekWS/rest/cat/metadata/fgdc/html?label=Mars_Viking_MDIM21_ClrMosaic_global_232m'],
  ['viking-trek-abstract.txt', 'https://trek.nasa.gov/mars/TrekWS/rest/cat/abstract?label=Mars_Viking_MDIM21_ClrMosaic_global_232m'],
  ['global-ctx-capabilities.xml', 'https://trek.nasa.gov/tiles/Mars/EQ/CTX_beta01_uncontrolled_5m_Caltech/1.0.0/WMTSCapabilities.xml'],
  ['mola-capabilities.xml', 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml'],
  ['controlled-ctx-capabilities.xml', 'https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/WMTSCapabilities.xml'],
  ['preliminary-ctx-capabilities.xml', 'https://trek.nasa.gov/tiles/Mars/EQ/Jezero_CTX_BlockAdj_dd/1.0.0/WMTSCapabilities.xml'],
  ['hirise-capabilities.xml', 'https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml'],
  ['global-ctx-tile0.png', 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/0/0/0'],
  ['global-ctx-tile1.png', 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/0/0/1'],
  ['global-ctx-tile12-jezero.png', 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/12/1628/5856'],
  ['global-ctx-arcgis.json', 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer?f=pjson'],
  ['global-ctx-trek-metadata.html', 'https://trek.nasa.gov/mars/TrekWS/rest/cat/metadata/fgdc/html?label=CTX_beta01_uncontrolled_5m_Caltech'],
  ['global-ctx-trek-abstract.txt', 'https://trek.nasa.gov/mars/TrekWS/rest/cat/abstract?label=CTX_beta01_uncontrolled_5m_Caltech'],
  ['hirise-trek-metadata.html', 'https://trek.nasa.gov/mars/TrekWS/rest/cat/metadata/fgdc/html?label=JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd'],
  ['hirise-usgs-metadata.xml', 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0.xml'],
  ['hirise-usgs-first-metadata.xml', 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.xml'],
  ['hirise-usgs-first.lbl', 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.lbl'],
  ['hirise-tile.png', 'https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/default/default028mm/13/3256/11713.png'],
  ['mars-trek-services.html', 'https://trek.nasa.gov/mars/trekWS/'],
  ['mars-trek-mapservice-capabilities.body', 'https://trek.nasa.gov/mars/trekWS/MapService?request=GetCapabilities'],
  ['caltech-global.html', 'https://murray-lab.caltech.edu/CTX/'],
]
const receipts = await Promise.all(requests.map(async ([file, url]) => {
  const started = new Date().toISOString()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { Origin: 'http://127.0.0.1:4174' } })
    const body = new Uint8Array(await response.arrayBuffer())
    await writeFile(new URL(file, here), body)
    const receipt = { file, requestedUrl: url, finalUrl: response.url, retrievedAt: started, status: response.status, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), headers: Object.fromEntries(['content-type', 'access-control-allow-origin', 'etag', 'last-modified'].map(name => [name, response.headers.get(name)])) }
    console.log(JSON.stringify(receipt))
    return receipt
  } catch (error) {
    const receipt = { file, requestedUrl: url, retrievedAt: started, error: String(error), cause: String(error.cause ?? '') }
    console.log(JSON.stringify(receipt))
    return receipt
  }
}))
await writeFile(new URL('http-receipts.json', here), JSON.stringify(receipts, null, 2) + '\n')
