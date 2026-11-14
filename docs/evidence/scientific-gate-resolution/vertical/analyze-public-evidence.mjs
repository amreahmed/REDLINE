import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { DOMParser } from '@xmldom/xmldom'

const directory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(directory, '../../../..')
const saved = process.argv.includes('--verify-saved')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const product = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0'
const parse = text => new DOMParser().parseFromString(text.replace(/^\uFEFF/, ''), 'text/xml')
const children = (node, tag) => Array.from(node.getElementsByTagName(tag))
const value = (node, tag) => children(node, tag)[0]?.textContent ?? null
const receipts = JSON.parse(await readFile(path.join(directory, 'http-receipts.json'), 'utf8'))
for (const receipt of receipts) {
  if (!receipt.file) continue
  const body = await readFile(path.join(directory, receipt.file))
  assert.equal(body.length, receipt.bytes, receipt.file)
  assert.equal(hash(body), receipt.sha256, receipt.file)
}
const inventories = []
for (const file of ['ctx-s3-object-list.xml', 'trn-s3-object-list.xml']) {
  const xml = parse(await readFile(path.join(directory, file), 'utf8'))
  const contents = children(xml, 'Contents').map(item => ({
    key: value(item, 'Key'), lastModified: value(item, 'LastModified'), size: Number(value(item, 'Size')), etag: value(item, 'ETag'),
  }))
  assert.equal(value(xml, 'IsTruncated'), 'false')
  inventories.push({ file, prefix: value(xml, 'Prefix'), isTruncated: false, keys: contents.length,
    processingRecordCandidates: contents.filter(item => /readme|manifest|version|history|\.py$|\.sh$/i.test(item.key)),
    exactProductObjects: contents.filter(item => item.key.includes(product)),
  })
}
assert.equal(inventories[0].keys, 35)
assert.equal(inventories[1].keys, 92)
const datumDeclarations = []
for (const file of ['ctx-current-metadata.xml', 'catalogue-current-metadata.xml', 'ctx-f05-fgdc.xml', 'ctx-j03-fgdc.xml', 'ctx-j21-j22-fgdc.xml']) {
  const xml = parse(await readFile(path.join(directory, file), 'utf8'))
  const description = value(xml, 'abstract')
  const processes = children(xml, 'procdesc').map(item => item.textContent)
  assert.ok(processes.some(text => text.includes('3396190m')), file)
  datumDeclarations.push({ file, processDates: children(xml, 'procdate').map(item => item.textContent), metadataDate: value(xml, 'metd'),
    heightStatement: 'Elevation values are in meters and refer to the Mars 2020 IAU Sphere with a radius of 3396190m.',
    descriptionExplicitlyNamesHrscDt5: description.includes('HRSC) DT5'),
    exactFinalEquationPresent: false, exactGeoidGridVersionPresent: false, exactOperationSignPresent: false,
  })
}
const doi = JSON.parse(await readFile(path.join(directory, 'datacite-doi.json'), 'utf8')).data.attributes
const repo = JSON.parse(await readFile(path.join(directory, 'mars2020-trn-github-repo.json'), 'utf8'))
const tree = JSON.parse(await readFile(path.join(directory, 'mars2020-trn-github-tree.json'), 'utf8'))
const commits = JSON.parse(await readFile(path.join(directory, 'mars2020-trn-github-commits.json'), 'utf8'))
const sourceBodies = []
for (const relativePath of ['public/data/jezero-terrain-grid.json', 'public/data/jezero-terrain-grid.f32', 'public/data/jezero-terrain-windows.json']) {
  const body = await readFile(path.join(root, relativePath))
  const checkpoint = execFileSync('git', ['show', `e79448a:${relativePath}`], { cwd: root, maxBuffer: 16000000 })
  assert.deepEqual(body, checkpoint, `Preservation failure: ${relativePath}`)
  sourceBodies.push({ relativePath, bytes: body.length, sha256: hash(body), identicalToCheckpoint: 'e79448a' })
}
const originalTiff = await readFile(path.join(root, 'docs/evidence/terrain-validation/source-audit', `${product}.tif`))
assert.equal(hash(originalTiff), '16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b')
const grid = JSON.parse(await readFile(path.join(root, 'public/data/jezero-terrain-grid.json'), 'utf8'))
assert.equal(grid.summary.validCount, 65536)
assert.equal(grid.grid.columns * grid.grid.rows, 65536)
assert.equal(grid.projection.radiusM, 3396190)
assert.equal(grid.sourceGrid.pixelSizeM, 20)
const auxiliaryFiles = ['cheng-web-tool-retrieval.json', 'kirk-tilt-web-tool-retrieval.json', 'trn-processing-2019.txt', 'dtm-quality-2021-mdpi.txt', 'trn-notebook-conversion.txt', 'trn-notebook-offset.txt']
const auxiliaryHashes = []
for (const file of auxiliaryFiles) {
  const body = await readFile(path.join(directory, file))
  auxiliaryHashes.push({ file, bytes: body.length, sha256: hash(body) })
}
const result = {
  schemaVersion: 1, productId: product, conclusion: 'exact-final-vertical-equation-unresolved',
  investigationMethod: 'Bounded public release inventory, metadata revision endpoints, pinned source-repository history, and primary production publications; no new elevation comparisons and no producer contact.',
  receipts: { total: receipts.length, bodies: receipts.filter(receipt => receipt.file).length,
    statuses: receipts.reduce((counts, receipt) => { const key = receipt.status ?? 'network-error'; counts[key] = (counts[key] ?? 0) + 1; return counts }, {}),
    unexpectedOrUnavailable: receipts.filter(receipt => receipt.status !== 200 || /\.json$/.test(receipt.file ?? '') && !(receipt.contentType ?? '').includes('json')).map(({ file, requestedUrl, status, contentType, error }) => ({ file, requestedUrl, status, contentType, error })),
  }, inventories, datumDeclarations,
  assessmentLimits: 'The absence of a final equation/model/sign is the investigator assessment of the saved records, not a general proof that no record exists elsewhere. Availability results describe the exact audited public endpoints.',
  doi: { identifier: doi.doi, registered: doi.registered, updated: doi.updated, version: doi.version, relatedIdentifiers: doi.relatedIdentifiers, url: doi.url },
  repository: { fullName: repo.full_name, defaultBranch: repo.default_branch, pushedAt: repo.pushed_at, treeCommit: tree.sha,
    treeTruncated: tree.truncated, treePaths: tree.tree.map(item => item.path), commitsReturned: commits.length, latestCommit: commits[0].sha,
    latestCommitDate: commits[0].commit.committer.date, exactProductProcessingRecordFound: false,
  },
  missingFacts: ['final sample-to-radius or sample-to-areoid equation', 'positive-up/down sample sign', 'exact final areoid/geoid model/grid version and checksum if used',
    'signed/order-specific DeltaGeoid operation and 183.3 m alignment transformation for exact final TIFF', 'relationship between public 20 m equirectangular TIFF and flight 12 m orthographic tangent-plane elevation map',
    'official correction/revision notice if sphere declaration is erroneous'],
  preserved: { originalTiff: { bytes: originalTiff.length, sha256: hash(originalTiff) }, sourceBodies, validCells: grid.summary.validCount,
    sourceGrid: grid.sourceGrid, crop: grid.grid, projection: grid.projection }, auxiliaryHashes,
}
const output = JSON.stringify(result, null, 2) + '\n'
const outputPath = path.join(directory, 'public-evidence-analysis.json')
if (saved) assert.equal(await readFile(outputPath, 'utf8'), output, 'Saved analysis differs')
else await writeFile(outputPath, output)
console.log(JSON.stringify({ savedVerification: saved, bodiesVerified: result.receipts.bodies, inventoryKeys: inventories.map(item => item.keys), preservedCells: grid.summary.validCount, conclusion: result.conclusion }))
