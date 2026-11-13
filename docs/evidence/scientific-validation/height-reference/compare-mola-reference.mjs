// A coarse independent datum sanity check, not fine DEM registration or a conversion.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(directory, '../../../..')
const base = 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const rows = [1143, 1144, 1145]
const columns = [1237, 1238, 1239]
const maps = ['r', 't', 'a']
const receiptsPath = path.join(directory, 'mola-range-receipts.json')
if (!process.argv.includes('--verify-saved')) {
  const receipts = await Promise.all(maps.flatMap(kind => rows.map(async row => {
    const file = `mola-${kind}-row-${row}.bin`
    const url = `${base}meg${kind}90n000eb.img`
    const start = row * 11520
    const end = start + 11519
    const requestedRange = `bytes=${start}-${end}`
    const startedAt = new Date().toISOString()
    const response = await fetch(url, { headers: { Range: requestedRange }, signal: AbortSignal.timeout(45000) })
    const bytes = Buffer.from(await response.arrayBuffer())
    const receipt = { file, requestedUrl: url, requestedRange, finalUrl: response.url, startedAt, retrievedAt: new Date().toISOString(), status: response.status, contentRange: response.headers.get('content-range'), bytes: bytes.length, sha256: hash(bytes) }
    if (response.status !== 206 || receipt.contentRange !== `bytes ${start}-${end}/33177600` || bytes.length !== 11520) throw new Error(`Unexpected MOLA range contract: ${JSON.stringify(receipt)}`)
    await writeFile(path.join(directory, file), bytes)
    return receipt
  })))
  await writeFile(receiptsPath, JSON.stringify(receipts, null, 2) + '\n')
}
const receipts = JSON.parse(await readFile(receiptsPath, 'utf8'))
const data = new Map()
for (const receipt of receipts) {
  const bytes = await readFile(path.join(directory, receipt.file))
  if (bytes.length !== receipt.bytes || hash(bytes) !== receipt.sha256 || receipt.status !== 206) throw new Error(`Changed MOLA evidence: ${receipt.file}`)
  const row = Number(receipt.file.match(/row-(\d+)\.bin$/)[1])
  if (receipt.bytes !== 11520 || receipt.requestedRange !== `bytes=${row * 11520}-${row * 11520 + 11519}` || receipt.contentRange !== `bytes ${row * 11520}-${row * 11520 + 11519}/33177600`) throw new Error('MOLA row response changed')
  data.set(receipt.file, bytes)
}
for (const name of ['radius', 'topography', 'areoid']) {
  const label = await readFile(path.join(directory, `mola-${name}-16.lbl`), 'utf8')
  for (const contract of [/LINES\s*=\s*2880/, /LINE_SAMPLES\s*=\s*5760/, /SAMPLE_TYPE\s*=\s*MSB_INTEGER/, /SAMPLE_BITS\s*=\s*16/, /UNIT\s*=\s*METER/, /MAP_RESOLUTION\s*=\s*16.0/, /COORDINATE_SYSTEM_NAME\s*=\s*"PLANETOCENTRIC"/]) if (!contract.test(label)) throw new Error(`Unexpected MOLA ${name} label`)
  if (name !== 'topography' && !/OFFSET\s*=\s*3396000/.test(label)) throw new Error('Unexpected MOLA radius offset')
}
const product = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0'
const native = await readFile(path.join(root, 'docs/evidence/terrain-validation/source-audit', `${product}.tif`))
if (hash(native) !== '16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b') throw new Error('Source DEM changed')
const results = rows.flatMap(row => columns.map(column => {
  // Bins start at 90 N and 0 E. Check adjacent bins, avoiding dependence on one offset interpretation.
  const lon = (column + 0.5) / 16
  const lat = 90 - (row + 0.5) / 16
  const sourceRow = Math.floor((1109693.140188 - 3396190 * lat * Math.PI / 180) / 20)
  const sourceColumn = Math.floor((3396190 * lon * Math.PI / 180 - 4573663.250853) / 20)
  if (sourceRow < 0 || sourceRow >= 1512 || sourceColumn < 0 || sourceColumn >= 1596) throw new Error('Probe is outside source DEM')
  const ctxValueM = native.readFloatLE(9779 + (sourceRow * 1596 + sourceColumn) * 4)
  if (!Number.isFinite(ctxValueM) || ctxValueM === Math.fround(-3.4028226550889045e38)) throw new Error('Probe DEM source value unavailable')
  const read = kind => data.get(`mola-${kind}-row-${row}.bin`).readInt16BE(column * 2)
  const radiusM = read('r') + 3396000
  const areoidRadiusM = read('a') + 3396000
  const topographyM = read('t')
  return { molaRowZeroBased: row, molaColumnZeroBased: column, binCenterLonLat: [lon, lat], ctxSourceRow: sourceRow, ctxSourceColumn: sourceColumn, ctxValueM, molaMeanRadiusM: radiusM, molaAreoidRadiusM: areoidRadiusM, molaMedianTopographyM: topographyM, molaMeanRadiusMinusIAUSphereM: radiusM - 3396190, ctxMinusMolaTopographyM: ctxValueM - topographyM, ctxMinusMolaRadiusAboveIAUSphereM: ctxValueM - (radiusM - 3396190) }
}))
const result = { purpose: 'Independent coarse height-reference sanity check only; not fine registration, per-cell accuracy, or a validated datum conversion.', molaResolutionDeg: 0.0625, molaReference: 'PDS MGS-M-MOLA-5-MEGDR-L3-V1.0 v2.0; radius means, median topography, GMM3 mgm1025 degree/order 50 areoid', sphereRadiusM: 3396190, sourceSha256: hash(native), probes: results }
const output = JSON.stringify(result, null, 2) + '\n'
const outputPath = path.join(directory, 'mola-reference-comparison.json')
if (process.argv.includes('--verify-saved')) {
  if (await readFile(outputPath, 'utf8') !== output) throw new Error('Saved MOLA comparison changed')
} else await writeFile(outputPath, output)
console.log(process.argv.includes('--verify-saved') ? `Verified ${receipts.length} MOLA range responses and ${results.length} independently reproducible coarse reference probes.` : output)
