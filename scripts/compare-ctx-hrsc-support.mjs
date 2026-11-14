import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { aggregateNativeFootprint, reprojectSphericalEqcFootprint } from './native-support.mjs'

// Audit only: no source fetching, datum correction or production writes.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const evidence = path.join(root, 'docs/evidence/scientific-gate-resolution')
const referenceDir = path.join(evidence, 'hrsc')
const outputDir = path.join(evidence, 'comparison')
const saved = process.argv.includes('--verify-saved')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const ctxManifestBytes = await readFile(path.join(root, 'public/data/jezero-terrain-grid.json'))
const ctxBytes = await readFile(path.join(root, 'public/data/jezero-terrain-grid.f32'))
assert.equal(hash(ctxManifestBytes), 'fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9')
assert.equal(hash(ctxBytes), '4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8')
const ctx = JSON.parse(ctxManifestBytes)
assert.equal(ctx.source.sha256, '16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b')
assert.equal(ctx.source.heightReference, 'provider-declared-iau-sphere-unvalidated')
assert.equal(ctx.source.units, 'm')
assert.deepEqual(ctx.projection, {
  kind: 'equirectangular', radiusM: 3396190, standardParallelDeg: 0, centralMeridianDeg: 0,
  latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeRange: 'signed-180',
})
assert.equal(ctx.grid.rows * ctx.grid.columns, 65536)
assert.equal(ctx.encoding.sampleType, 'float32')
assert.equal(ctx.encoding.byteOrder, 'little-endian')
assert.equal(ctx.encoding.layout, 'row-major')
assert.equal(ctxBytes.length, ctx.encoding.bytes)
const samples = Array.from({ length: 65536 }, (_, index) => ctxBytes.readFloatLE(index * 4))
const nativeGrid = {
  rows: ctx.grid.rows, columns: ctx.grid.columns,
  westM: ctx.sourceGrid.originX + ctx.grid.startColumn * ctx.sourceGrid.pixelSizeM,
  northM: ctx.sourceGrid.originY - ctx.grid.startRow * ctx.sourceGrid.pixelSizeM,
  spacingM: ctx.sourceGrid.pixelSizeM, radiusM: ctx.projection.radiusM,
  samples, validity: samples.map(value => Number.isFinite(value) && value !== ctx.sourceGrid.noData ? 1 : 0),
  noData: ctx.sourceGrid.noData,
}
assert.equal(nativeGrid.spacingM, 20)
assert.equal(nativeGrid.validity.reduce((sum, value) => sum + value, 0), ctx.summary.validCount)
const originalFootprint = {
  westM: nativeGrid.westM, eastM: nativeGrid.westM + nativeGrid.columns * nativeGrid.spacingM,
  northM: nativeGrid.northM, southM: nativeGrid.northM - nativeGrid.rows * nativeGrid.spacingM,
}
const originalSupport = aggregateNativeFootprint(nativeGrid, originalFootprint)
assert.equal(originalSupport.status, 'accepted')

const referenceManifestBytes = await readFile(path.join(referenceDir, 'hrsc-native-reference.json'))
const hrsc = JSON.parse(referenceManifestBytes)
assert.equal(hrsc.schemaVersion, 1)
for (const [key, value] of Object.entries({
  proj: 'eqc', radiusM: 3396000, standardParallelDeg: 0, centralMeridianDeg: 0,
  latitudeOfOriginDeg: 0, falseEastingM: 0, falseNorthingM: 0,
  latitudeConvention: 'planetocentric on sphere', longitudeDirection: 'east-positive', units: 'm',
})) assert.equal(hrsc.projection[key], value)
assert.deepEqual(hrsc.grid, { startRow: 13605, startColumn: 11661, rows: 103, columns: 103 })
assert.deepEqual(hrsc.cropGeotransform, [4583825, 50, 0, 1097925.0000000002, 0, -50])
assert.equal(hrsc.originalCtx.manifestSha256, hash(ctxManifestBytes))
assert.equal(hrsc.originalCtx.binarySha256, hash(ctxBytes))

const inputs = {}
const inputHashes = {}
for (const kind of ['dt5', 'da5']) {
  const contract = hrsc.products[kind]
  assert.equal(contract.units, 'm')
  assert.equal(contract.scale, 1)
  assert.equal(contract.offset, 0)
  assert.equal(contract.noData, -32768)
  assert.equal(contract.encoding.sampleType, 'int16')
  assert.equal(contract.encoding.byteOrder, 'little-endian')
  assert.equal(contract.encoding.layout, 'row-major')
  assert.equal(contract.validity.encoding, 'uint8')
  assert.equal(contract.validity.validValue, 1)
  assert.equal(contract.validity.noDataValue, 0)
  const expectedVertical = kind === 'dt5' ? 'Height above spheroid with radius 3396.0 km|' : 'Height above equipotential surface described by potential model GMM3 (PDS dataset MGS-M-MOLA-5-MEGDR-L3-V1.0)|'
  assert.equal(contract.verticalReference, expectedVertical)
  const readAsset = async asset => {
    assert.equal(path.basename(asset.file), asset.file)
    const bytes = await readFile(path.join(referenceDir, asset.file))
    assert.equal(bytes.length, asset.bytes)
    assert.equal(hash(bytes), asset.sha256)
    inputHashes[asset.file] = asset.sha256
    return bytes
  }
  const bytes = await readAsset(contract.encoding)
  const validity = await readAsset(contract.validity)
  assert.equal(bytes.length, hrsc.grid.rows * hrsc.grid.columns * 2)
  assert.equal(validity.length, hrsc.grid.rows * hrsc.grid.columns)
  const values = Array.from({ length: validity.length }, (_, index) => bytes.readInt16LE(index * 2))
  for (let index = 0; index < values.length; index++) assert.equal(validity[index], values[index] === contract.noData ? 0 : 1)
  inputs[kind] = { values, validity }
}

const comparisonRows = []
const rejected = { outsideGrid: 0, missingCtxSupport: 0, missingReferencePair: 0 }
const differencesDa5 = []
const differencesDt5 = []
let acceptedAreaM2 = 0
for (let row = 0; row < hrsc.grid.rows; row++) {
  for (let column = 0; column < hrsc.grid.columns; column++) {
    const index = row * hrsc.grid.columns + column
    const [west, spacing, , north] = hrsc.cropGeotransform
    const footprint = reprojectSphericalEqcFootprint({
      westM: west + column * spacing, eastM: west + (column + 1) * spacing,
      northM: north - row * spacing, southM: north - (row + 1) * spacing,
    }, hrsc.projection.radiusM, ctx.projection.radiusM)
    const support = aggregateNativeFootprint(nativeGrid, footprint)
    if (support.status === 'rejected') {
      rejected[support.reason === 'outside-grid' ? 'outsideGrid' : 'missingCtxSupport']++
      continue
    }
    if (inputs.dt5.validity[index] !== 1 || inputs.da5.validity[index] !== 1) {
      rejected.missingReferencePair++
      continue
    }
    const da5 = inputs.da5.values[index]
    const dt5 = inputs.dt5.values[index]
    // Reference-only change of constant sphere radius: radial height − (3396190−3396000).
    // Never applied to CTX and never used as a proposed CTX geoid conversion.
    const dt5AboveCtxSphere = dt5 - (ctx.projection.radiusM - hrsc.projection.radiusM)
    const deltaDa5 = support.meanM - da5
    const deltaDt5 = support.meanM - dt5AboveCtxSphere
    differencesDa5.push(deltaDa5)
    differencesDt5.push(deltaDt5)
    acceptedAreaM2 += support.surfaceAreaM2
    comparisonRows.push([
      row + hrsc.grid.startRow, column + hrsc.grid.startColumn,
      support.meanM, da5, dt5, deltaDa5, deltaDt5, support.coveredCells, support.surfaceAreaM2,
    ])
  }
}
assert.equal(comparisonRows.length, hrsc.coverage.nativeCellsWhollyInsideOriginalFootprint)
assert.equal(rejected.outsideGrid, hrsc.coverage.boundaryOverhangCells)
assert.equal(comparisonRows.length + Object.values(rejected).reduce((sum, value) => sum + value, 0), hrsc.grid.rows * hrsc.grid.columns)
function statistics(values) {
  const sorted = [...values].sort((left, right) => left - right)
  const count = sorted.length
  assert.ok(count > 0)
  const mean = values.reduce((sum, value) => sum + value, 0) / count
  const median = count % 2 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2
  return { count, minM: sorted[0], maxM: sorted[count - 1], meanM: mean, medianM: median }
}
const csv = 'hrsc_source_row,hrsc_source_column,ctx_area_weighted_scalar_m,hrsc_da5_m,hrsc_dt5_m,ctx_minus_da5_m,ctx_minus_dt5_above_3396190_sphere_m,ctx_support_cells,spherical_support_area_m2\n' + comparisonRows.map(row => row.join(',')).join('\n') + '\n'
const audit = {
  purpose: 'Complete native-footprint comparison diagnostics; not datum identification, independent accuracy or terrain-cost authorization',
  originalCtx: { productId: ctx.source.productId, sourceSha256: ctx.source.sha256, manifestSha256: hash(ctxManifestBytes), binarySha256: hash(ctxBytes), preservedCells: samples.length, verticalStatus: ctx.source.heightReference },
  reference: { manifestSha256: hash(referenceManifestBytes), assetHashes: inputHashes, nativePostingM: 50, retainedCells: hrsc.grid.rows * hrsc.grid.columns },
  model: 'CTX samples constant within native cell footprints; spherical surface-area weighted support at each wholly covered original HRSC cell. Reference original int16 samples retained without interpolation. Geographic edges converted by radius ratio only.',
  equation: 'CTX mean − DA5; CTX mean − (DT5 − 190 m). The latter adjusts only the documented HRSC sphere height to the app sphere for comparison.',
  acceptedComparisons: comparisonRows.length,
  rejected,
  acceptedRowsInclusive: [comparisonRows[0][0], comparisonRows.at(-1)[0]],
  acceptedColumnsInclusive: [Math.min(...comparisonRows.map(row => row[1])), Math.max(...comparisonRows.map(row => row[1]))],
  surfaceAreaFractionOfOriginalCrop: acceptedAreaM2 / originalSupport.surfaceAreaM2,
  ctxMinusDa5: statistics(differencesDa5),
  ctxMinusDt5Above3396190Sphere: statistics(differencesDt5),
  perCellFile: 'native-support-comparisons.csv', perCellSha256: hash(Buffer.from(csv)),
  limitations: [
    'A raster sample is not necessarily a measured footprint average; the explicit piecewise-constant support model is a comparison assumption.',
    'Shared HRSC/CTX control lineage and unmeasured image-registration errors prevent independent absolute accuracy claims.',
    'The areoid label and sphere label describe HRSC only; similarity cannot prove the final CTX surface, correction model/version or sign.',
    '50 m posting and 1 m quantization do not establish effective spatial resolution or local vertical error.',
    'Boundary overhangs are retained in reference evidence but excluded from the comparison; no missing support is normalized away.',
    'No production terrain asset, scientific gate, transformation, slope, cost or route is modified.',
  ],
}
for (const [file, body] of [['native-support-comparisons.csv', csv], ['audit.json', JSON.stringify(audit, null, 2) + '\n']]) {
  if (saved) assert.equal(await readFile(path.join(outputDir, file), 'utf8'), body)
  else { await mkdir(outputDir, { recursive: true }); await writeFile(path.join(outputDir, file), body) }
}
console.log(JSON.stringify({ verifiedSaved: saved, acceptedComparisons: audit.acceptedComparisons, rejected, ctxMinusDa5: audit.ctxMinusDa5, ctxMinusDt5Above3396190Sphere: audit.ctxMinusDt5Above3396190Sphere }, null, 2))
