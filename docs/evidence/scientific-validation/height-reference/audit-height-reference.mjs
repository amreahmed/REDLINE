import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const directory = path.dirname(fileURLToPath(import.meta.url))
const product = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0'
const base = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/'
const resources = [
  ['ctx-dtm-product.html', 'https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic'],
  ['ctx-dtm-fgdc.xml', `${base}${product}.xml`],
  ['ctx-dtm-isis.lbl', `${base}${product}.lbl`],
  ['ctx-dtm-pds3.lbl', `${base}${product}_pds3.lbl`],
  ['usgs-catalog-fgdc.xml', 'https://data.usgs.gov/datacatalog/metadata/USGS.f354e990-9f17-451b-9006-dcbbdb26ea0c.xml'],
  ['trn-generation-2020.pdf', 'https://www.hou.usra.edu/meetings/lpsc2020/pdf/2020.pdf'],
  ['stereo-dtm-quality-2020.pdf', 'https://isprs-archives.copernicus.org/articles/XLIII-B3-2020/1129/2020/isprs-archives-XLIII-B3-2020-1129-2020.pdf'],
  ['tao-jezero-2023-response.html', 'https://refubium.fu-berlin.de/bitstream/handle/fub188/41095/Earth%20and%20Space%20Science%20-%202023%20-%20Tao%20-%20A%20High-Resolution%20Digital%20Terrain%20Model%20Mosaic%20of%20the%20Mars%202020%20Perseverance%20Rover.pdf?save=y&sequence=1'],
  ['mola-megdr-guide.html', 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html'],
  ['mola-radius-16.lbl', 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megr90n000eb.lbl'],
  ['mola-topography-16.lbl', 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.lbl'],
  ['mola-areoid-16.lbl', 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/mega90n000eb.lbl'],
  ['asp-cassis-docs.html', 'https://stereopipeline.readthedocs.io/en/latest/examples/cassis.html'],
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(directory, { recursive: true })
if (process.argv.includes('--verify-saved')) {
  const receipts = JSON.parse(await readFile(path.join(directory, 'http-receipts.json'), 'utf8'))
  for (const receipt of receipts) {
    if (!receipt.file) continue
    const bytes = await readFile(path.join(directory, receipt.file))
    if (bytes.length !== receipt.bytes || hash(bytes) !== receipt.sha256) throw new Error(`Evidence changed: ${receipt.file}`)
  }
  const fgdc = await readFile(path.join(directory, 'ctx-dtm-fgdc.xml'), 'utf8')
  const catalog = await readFile(path.join(directory, 'usgs-catalog-fgdc.xml'), 'utf8')
  const declaration = 'Elevation values are in meters and refer to the Mars 2020 IAU Sphere with a radius of 3396190m.'
  if (!fgdc.includes(declaration) || !catalog.includes(declaration)) throw new Error('Provider height-reference declaration changed')
  const pds = await readFile(path.join(directory, 'ctx-dtm-pds3.lbl'), 'utf8')
  if (!/SCALING_FACTOR\s*=\s*1.0/.test(pds) || !/OFFSET\s*=\s*0.0/.test(pds) || !/SAMPLE_TYPE\s*=\s*IEEE_REAL/.test(pds)) throw new Error('Native value encoding changed')
  console.log(`Verified ${receipts.filter(receipt => receipt.file).length} saved height-reference source bodies.`)
} else {
  const receipts = await Promise.all(resources.map(async ([file, url]) => {
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
  await writeFile(path.join(directory, 'http-receipts.json'), JSON.stringify(receipts, null, 2) + '\n')
  console.log(JSON.stringify(receipts.map(({ file, status, bytes, error }) => ({ file, status, bytes, error })), null, 2))
}
