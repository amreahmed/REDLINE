import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
const baseline = 'b5ebd0d05ca393be3da06d3305c745c355794d45'
const areas = ['public', 'src/features/terrain', 'src/features/routing', 'src/features/mission', 'src/data/marsLayers.ts', 'src/data/marsGlobe.ts', 'src/data/scienceTargets.ts', 'src/features/map/mapProjection.ts', 'src/features/map/frameReadiness.ts', 'src/features/globe/createMarsGlobe.ts', 'docs/science-routing-audit.md', 'docs/evidence/science-routing-audit', 'docs/evidence/scientific-validation']
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, '--', ...areas], { encoding: 'utf8' }).trim().split(/\r?\n/)
const hashes = []
for (const file of files) {
  const expected = execFileSync('git', ['show', `${baseline}:${file}`], { maxBuffer: 32 * 1024 * 1024 })
  const actual = await readFile(file)
  assert.ok(expected.equals(actual), `Protected file changed: ${file}`)
  hashes.push({ file, bytes: actual.length, sha256: createHash('sha256').update(actual).digest('hex') })
}
const result = { baseline, checkedAt: new Date().toISOString(), protectedFilesCompared: files.length, differingFiles: 0, files: hashes }
await writeFile(new URL('./preservation.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
console.log(`Verified ${files.length} protected files byte-for-byte against ${baseline}`)
