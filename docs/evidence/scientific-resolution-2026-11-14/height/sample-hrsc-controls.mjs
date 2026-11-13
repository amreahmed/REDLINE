import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(directory, '../../../..')
const grid = JSON.parse(await readFile(path.join(root, 'public/data/jezero-terrain-grid.json'), 'utf8'))
const contracts = JSON.parse(await readFile(path.join(directory, 'hrsc-tiff-contracts.json'), 'utf8'))
const receiptPath = path.join(directory, 'hrsc-control-receipts.json')
const saved = process.argv.includes('--verify-saved')
let receipts = []
try { receipts = JSON.parse(await readFile(receiptPath, 'utf8')) } catch { /* first run */ }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const probes = []
const binary = await readFile(path.join(root, 'public/data/jezero-terrain-grid.f32'))
if (hash(binary) !== grid.encoding.sha256) throw new Error('Production terrain binary changed')
const additional = [[600, 600], [820, 760]].map(([row, column]) => {
  const x = grid.sourceGrid.originX + (column + 0.5) * 20
  const y = grid.sourceGrid.originY - (row + 0.5) * 20
  const index = (row - grid.grid.startRow) * grid.grid.columns + column - grid.grid.startColumn
  return { row, column, coordinate: [x / 3396190 * 180 / Math.PI, y / 3396190 * 180 / Math.PI], elevationM: binary.readFloatLE(index * 4) }
})
for (const fixture of [...grid.fixtures, ...additional]) {
  const [lon, lat] = fixture.coordinate
  const x = 3396000 * lon * Math.PI / 180
  const y = 3396000 * lat * Math.PI / 180
  const sample = { coordinate: fixture.coordinate, ctxSourceCell: [fixture.row, fixture.column], ctxNativeM: fixture.elevationM, probeKind: grid.fixtures.includes(fixture) ? 'pinned native fixture' : 'additional native-grid audit location; not a landmark control' }
  for (const kind of ['dt5', 'da5']) {
    const contract = contracts[kind]
    const geokey = key => contract.geokeys.find(entry => entry.key === key)?.value
    if (contract.compression !== 1 || contract.sampleFormat[0] !== 2 || contract.bitsPerSample[0] !== 16 || contract.samplesPerPixel !== 1 || contract.rowsPerStrip !== 1 || contract.pixelScale[0] !== 50 || contract.pixelScale[1] !== 50 || contract.noData !== '-32768' || geokey(3075) !== 17 || geokey(2057)[0] !== 3396000 || geokey(3078)[0] !== 0 || geokey(3088)[0] !== 0 || geokey(3082)[0] !== 0 || geokey(3083)[0] !== 0 || geokey(4099) !== 9001) throw new Error('Unsupported HRSC sample contract')
    const expectedVertical = kind === 'dt5' ? 'Height above spheroid with radius 3396.0 km|' : 'Height above equipotential surface described by potential model GMM3 (PDS dataset MGS-M-MOLA-5-MEGDR-L3-V1.0)|'
    if (geokey(4097) !== expectedVertical) throw new Error('Changed HRSC vertical declaration')
    const row = Math.floor((contract.tiepoint[4] - y) / 50)
    const column = Math.floor((x - contract.tiepoint[3]) / 50)
    if (row < 0 || row >= contract.height || column < 0 || column >= contract.width) throw new Error('Current source-grid fixture outside candidate HRSC raster')
    if (contract.stripByteCounts[row] !== contract.width * 2) throw new Error('Unexpected strip size')
    const start = contract.stripOffsets[row] + column * 2
    const end = start + 1
    const file = `hrsc-${kind}-cell-${row}-${column}.bin`
    const requestedUrl = `https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_${kind}.tif`
    let body
    const previous = receipts.find(receipt => receipt.file === file)
    if (previous) {
      body = await readFile(path.join(directory, file))
      if (body.length !== 2 || hash(body) !== previous.sha256 || previous.contentRange !== `bytes ${start}-${end}/${contract.totalBytes}`) throw new Error('Saved HRSC control changed')
    } else {
      if (saved) throw new Error('Missing HRSC control receipt')
      const startedAt = new Date().toISOString()
      const response = await fetch(requestedUrl, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(45000) })
      if (response.status !== 206) { await response.body?.cancel(); throw new Error('Bounded HRSC control unavailable') }
      body = Buffer.from(await response.arrayBuffer())
      if (body.length !== 2 || response.headers.get('content-range') !== `bytes ${start}-${end}/${contract.totalBytes}`) throw new Error('HRSC sample range mismatch')
      await writeFile(path.join(directory, file), body)
      receipts.push({ file, requestedUrl, finalUrl: response.url, requestedRange: `bytes=${start}-${end}`, startedAt, retrievedAt: new Date().toISOString(), status: response.status, contentRange: response.headers.get('content-range'), bytes: body.length, sha256: hash(body) })
      await writeFile(receiptPath, JSON.stringify(receipts, null, 2) + '\n')
    }
    const value = body.readInt16LE()
    sample[kind] = { row, column, valueM: value === -32768 ? null : value, centerLonLat: [(contract.tiepoint[3] + (column + 0.5) * 50) / 3396000 * 180 / Math.PI, (contract.tiepoint[4] - (row + 0.5) * 50) / 3396000 * 180 / Math.PI] }
  }
  if (sample.dt5.valueM === null || sample.da5.valueM === null) throw new Error('Reference control is NoData')
  sample.hrscMeanings = { heightAbove3396190SphereM: sample.dt5.valueM - 190, areoidRadiusM: 3396000 + sample.dt5.valueM - sample.da5.valueM, ctxMinusAreoidHeightM: sample.ctxNativeM - sample.da5.valueM, ctxMinusHeightAbove3396190SphereM: sample.ctxNativeM - (sample.dt5.valueM - 190) }
  probes.push(sample)
}
const output = JSON.stringify({ purpose: 'Same-geographic-position nearest native HRSC reference cells; different resolution and source lineage, not an exact pixel registration or per-cell uncertainty.', units: 'm', hrscHorizontalSphereRadiusM: 3396000, sourceHorizontalSphereRadiusM: 3396190, probes }, null, 2) + '\n'
const outputPath = path.join(directory, 'hrsc-control-comparison.json')
if (saved) { if (await readFile(outputPath, 'utf8') !== output) throw new Error('Saved HRSC control comparison changed') }
else await writeFile(outputPath, output)
console.log(saved ? `Verified ${receipts.length} range-backed HRSC heights and ${probes.length} paired reference comparisons.` : output)
