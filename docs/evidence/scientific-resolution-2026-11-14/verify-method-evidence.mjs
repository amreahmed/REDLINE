import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const root = new URL('./', import.meta.url)
const status = JSON.parse(await readFile(new URL('method-status.json', root), 'utf8'))
const receipts = JSON.parse(await readFile(new URL('method-sources/http-receipts.json', root), 'utf8'))
const excluded = new Set(status.excludedResponseFiles)
assert.equal(receipts.length, 9)
for (const receipt of receipts) {
  const bytes = await readFile(new URL(`method-sources/${receipt.file}`, root))
  assert.equal(bytes.length, receipt.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256)
  if (!excluded.has(receipt.file)) {
    assert.equal(receipt.status, 200)
    if (receipt.file.endsWith('.pdf')) assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
  }
}
const challenge = await readFile(new URL('method-sources/kirk-2021-dtm-quality.html', root), 'utf8')
assert.match(challenge, /akamai\/interstitial|bm-verify/)
assert.equal(receipts.find((r) => r.file === 'gdal-baseline-slope.py').status, 404)
const label = await readFile(new URL('method-sources/jezero-west-slope-isis.lbl', root), 'utf8')
assert.match(label, /Samples\s*=\s*2093/)
assert.match(label, /Lines\s*=\s*5235/)
assert.match(label, /LatitudeType\s*=\s*Planetocentric/)
assert.match(label, /CenterLongitude\s*=\s*180\.0/)
assert.match(label, /PixelResolution\s*=\s*20\.201297749849001/)
const candidate = status.providerSlopeCandidate
for (const [key, value] of [['EquatorialRadius', candidate.radiusM], ['PolarRadius', candidate.radiusM], ['Samples', candidate.columns], ['Lines', candidate.rows], ['CenterLongitude', candidate.centralMeridianDeg], ['PixelResolution', candidate.projectedSpacingM]]) {
  const match = label.match(new RegExp(`^\\s*${key}\\s*=\\s*([-\\d.]+)`, 'm'))
  assert(match, `Missing ${key}`)
  assert(Math.abs(Number(match[1]) - value) < 1e-12, `Mismatched ${key}`)
}
assert.match(label, /ProjectionName\s*=\s*Equirectangular/)
assert.match(label, /LongitudeDirection\s*=\s*PositiveEast/)
assert.equal(status.providerSlopeCandidate.numericalUnits, null)
assert.equal(status.providerSlopeCandidate.noData, null)
assert.equal(status.providerSlopeCandidate.tiffDecoded, false)
const manifestBytes = await readFile(new URL('../../../public/data/jezero-terrain-grid.json', root))
const binary = await readFile(new URL('../../../public/data/jezero-terrain-grid.f32', root))
assert.equal(createHash('sha256').update(manifestBytes).digest('hex'), status.currentSource.manifestSha256)
assert.equal(createHash('sha256').update(binary).digest('hex'), status.currentSource.binarySha256)
assert.equal(binary.length / 4, status.currentSource.cellCount)
const manifest = JSON.parse(manifestBytes.toString('utf8'))
const [west, south, east, north] = status.providerSlopeCandidate.declaredBoundsLonLat
for (const corner of manifest.outerCorners) {
  const [lon, lat] = corner.coordinate
  assert(lon >= west && lon <= east && lat >= south && lat <= north)
}
const hrsc = JSON.parse(await readFile(new URL('height/hrsc-tiff-contracts.json', root), 'utf8'))
const vertical = (contract) => contract.geokeys.find((entry) => entry.key === 4097).value
assert.equal(vertical(hrsc.dt5), 'Height above spheroid with radius 3396.0 km|')
assert.equal(vertical(hrsc.da5), 'Height above equipotential surface described by potential model GMM3 (PDS dataset MGS-M-MOLA-5-MEGDR-L3-V1.0)|')
assert.deepEqual(hrsc.dt5.tiepoint, hrsc.da5.tiepoint)
assert.deepEqual(hrsc.dt5.pixelScale, [50, 50, 1])
assert.deepEqual(hrsc.dt5.pixelScale, hrsc.da5.pixelScale)
for (const contract of Object.values(hrsc)) {
  assert.equal(contract.noData, '-32768')
  assert.deepEqual(contract.sampleFormat, [2])
  assert.deepEqual(contract.bitsPerSample, [16])
}
const comparisons = JSON.parse(await readFile(new URL('height/hrsc-control-comparison.json', root), 'utf8'))
assert.equal(comparisons.probes.length, 9)
for (const probe of comparisons.probes) {
  assert.equal(probe.dt5.row, probe.da5.row)
  assert.equal(probe.dt5.column, probe.da5.column)
  assert.equal(probe.dt5.valueM - 190, probe.hrscMeanings.heightAbove3396190SphereM)
  assert.equal(3396000 + probe.dt5.valueM - probe.da5.valueM, probe.hrscMeanings.areoidRadiusM)
  assert.equal(probe.ctxNativeM - probe.da5.valueM, probe.hrscMeanings.ctxMinusAreoidHeightM)
  assert.equal(probe.ctxNativeM - (probe.dt5.valueM - 190), probe.hrscMeanings.ctxMinusHeightAbove3396190SphereM)
}
console.log('Verified 9 method receipt bodies; 7 accepted primary responses; candidate metadata/envelope; paired HRSC vertical contract/algebra; production terrain hashes and 65,536 cells unchanged. No physical slope/cost authorization.')
