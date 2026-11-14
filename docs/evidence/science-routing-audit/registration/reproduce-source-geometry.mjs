import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

// Reuse the preserved source verifier; force saved-only mode and isolate output.
const here = new URL('./', import.meta.url)
const original = new URL('../../scientific-validation/feature-registration/audit-feature-registration.mjs', here)
const originalRoot = new URL('./', original)
const bytes = await readFile(original)
const hash = value => createHash('sha256').update(value).digest('hex')
assert.equal(hash(bytes), '0ca21607b62dcfc6c681451711ea8f24461bfa75735c33356ce1223fe69eec96')
let source = bytes.toString('utf8')
const rootDeclaration = "const root = new URL('./', import.meta.url)"
assert.equal(source.split(rootDeclaration).length, 2)
source = source.replace(rootDeclaration, `const root = new URL(${JSON.stringify(originalRoot.href)}); const outputRoot = new URL(${JSON.stringify(here.href)})`)
const saveDeclaration = "const save = (name, value) => writeFile(new URL(name, root),"
assert.equal(source.split(saveDeclaration).length, 2)
source = source.replace(saveDeclaration, "const save = (name, value) => writeFile(new URL(name, outputRoot),")
source = source.replace("if (process.argv.includes('--verify-saved'))", 'if (true)')
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const saved = await readFile(new URL('registration-checks.json', originalRoot))
const reproduced = await readFile(new URL('registration-checks.json', here))
assert.deepEqual(JSON.parse(reproduced), JSON.parse(saved))
assert.equal(hash(reproduced), hash(saved))
const output = JSON.parse(reproduced)
const summary = {
  sourceScript: 'docs/evidence/scientific-validation/feature-registration/audit-feature-registration.mjs',
  sourceScriptSha256: hash(bytes),
  savedMeasurementSha256: hash(saved),
  reproducedMeasurementSha256: hash(reproduced),
  byteIdentical: true,
  verifiedReceipts: 10,
  verifiedNamedSourceRecords: output.records.length,
  coordinateCornersChecked: output.independentCornerAndCenterChecks.cropCorners,
  nativeCentersChecked: output.independentCornerAndCenterChecks.nativeFixtures,
  featureMappings: output.featureMappings,
  imageExtraEastWidthM: output.imageExtraEastWidthM,
  qualification: 'Source coordinate convention, native metadata and coarse arithmetic placement are verified. Named-feature fine registration and independent absolute control remain unavailable.'
}
await writeFile(new URL('source-geometry-reproduction-summary.json', here), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
