import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const directory = path.dirname(fileURLToPath(import.meta.url))
const resources = [
  ['jezero-stratigraphy-2021.pdf', 'https://elib.dlr.de/143146/1/Holm-Alwmark_et_al.Jezero_Floor_Stratigraphy.JGR_2021.pdf'],
  ['usgs-hirise-ard-docs.html', 'https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/'],
  ['hirise-dtm-about.html', 'https://www.uahirise.org/dtm/about.php'],
  ['hirise-rdr-sis.pdf', 'https://hirise-pds.lpl.arizona.edu/PDS4/DOCUMENT/HIRISE_RDR_SIS.PDF'],
  ['hrsc-mc13e-quads.html', 'https://hrscteam.dlr.de/public/data/HMC30/quads.php?quad=mc13e'],
  ['ctx-f05-aux.xml', 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/DTM_MOLAtopography_DeltaGeoid_20m_Jezero_F05X_v7pt1_Eqc_latTs0_lon0.tif.aux.xml'],
  ['ctx-dtm-history-response.xml', 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.History.IsisCube'],
  ['ctx-dtm-aux-response.xml', 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif.aux.xml'],
  ['ctx-f05-native.tif', 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/DTM_MOLAtopography_DeltaGeoid_20m_Jezero_F05X_v7pt1_Eqc_latTs0_lon0.tif'],
  ['ctx-j03-native.tif', 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/DTM_MOLAtopography_DeltaGeoid_20m_Jezero_J03X_v7pt1_Eqc_latTs0_lon0.tif'],
  ['ctx-j21-j22-native.tif', 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/DTM_MOLAtopography_DeltaGeoid_20m_Jezero_J21_J22X_v7pt1_Eqc_latTs0_lon0.tif'],
  ['hrsc-readme.txt', 'https://hrscteam.dlr.de/public/data/HMC30/MC13E/AA_README_HMC30.txt'],
  ['hrsc-tiling-naming.pdf', 'https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC30_tiling_scheme_and_file_naming.pdf'],
  ['hrsc-jezero-map-2021.pdf', 'https://www.hou.usra.edu/meetings/lpsc2021/pdf/2509.pdf'],
  ['asp-dem-geoid-source.cc', 'https://raw.githubusercontent.com/NeoGeographyToolkit/StereoPipeline/master/src/asp/Tools/dem_geoid.cc'],
  ['hirise-stac-collection.json', 'https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_controlled_socet_dtms'],
  ['hirise-stac-crop-items.json', 'https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_controlled_socet_dtms/items?bbox=77.33659457394239,18.437093496062143,77.42297207081594,18.523470992935692&limit=100'],
  ['stac-collections.json', 'https://stac.astrogeology.usgs.gov/api/collections'],
  ['hirise-current-stac-collection.json', 'https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_socet_dtms'],
  ['hirise-current-stac-crop-items.json', 'https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_socet_dtms/items?bbox=77.33659457394239,18.437093496062143,77.42297207081594,18.523470992935692&limit=100'],
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(directory, { recursive: true })
const receiptPath = path.join(directory, 'http-receipts.json')
if (process.argv.includes('--verify-saved')) {
  const receipts = JSON.parse(await readFile(receiptPath, 'utf8'))
  for (const receipt of receipts) {
    if (!receipt.file) continue
    const bytes = await readFile(path.join(directory, receipt.file))
    if (bytes.length !== receipt.bytes || hash(bytes) !== receipt.sha256) throw new Error(`Changed source body: ${receipt.file}`)
  }
  console.log(`Verified ${receipts.filter(receipt => receipt.file).length} new saved height-investigation bodies.`)
} else {
  let priorReceipts = []
  try { priorReceipts = JSON.parse(await readFile(receiptPath, 'utf8')) } catch { /* first run */ }
  const receipts = await Promise.all(resources.map(async ([file, url]) => {
    const previous = priorReceipts.find(receipt => receipt.file === file && receipt.requestedUrl === url)
    if (previous && !process.argv.includes('--refresh')) {
      const body = await readFile(path.join(directory, file))
      if (body.length !== previous.bytes || hash(body) !== previous.sha256) throw new Error(`Changed cached body: ${file}`)
      return previous
    }
    const startedAt = new Date().toISOString()
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) })
      const bytes = Buffer.from(await response.arrayBuffer())
      await writeFile(path.join(directory, file), bytes)
      return { file, requestedUrl: url, finalUrl: response.url, startedAt, retrievedAt: new Date().toISOString(), status: response.status, contentType: response.headers.get('content-type'), bytes: bytes.length, sha256: hash(bytes) }
    } catch (error) {
      return { requestedUrl: url, startedAt, retrievedAt: new Date().toISOString(), error: error.message, cause: error.cause?.message ?? null }
    }
  }))
  await writeFile(receiptPath, JSON.stringify(receipts, null, 2) + '\n')
  console.log(JSON.stringify(receipts.map(({ file, status, bytes, contentType, error }) => ({ file, status, bytes, contentType, error })), null, 2))
}
