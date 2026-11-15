import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const baseline = '7143d2c'
const areas = ['public', 'src/features/terrain', 'src/features/routing', 'src/features/mission', 'src/data', 'src/features/map/mapProjection.ts', 'src/features/map/frameReadiness.ts', 'src/features/globe', 'docs/science-routing-audit.md', 'docs/evidence/science-routing-audit', 'docs/evidence/scientific-validation', 'docs/evidence/scientific-gate-resolution', 'docs/evidence/scientific-resolution-2026-11-14']
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, '--', ...areas], { encoding: 'utf8' }).trim().split(/\r?\n/)
const hashes = []
for (const file of files) {
  const expected = execFileSync('git', ['show', `${baseline}:${file}`], { maxBuffer: 40 * 1024 * 1024 })
  const actual = await readFile(file)
  assert.ok(expected.equals(actual), `Protected baseline file changed: ${file}`)
  hashes.push({ file, bytes: actual.length, sha256: createHash('sha256').update(actual).digest('hex') })
}
const result = { baseline, protectedFilesCompared: files.length, differingFiles: 0, ctxCells: 65536, files: hashes }
if (process.argv.includes('--verify-saved')) {
  const saved = JSON.parse(await readFile(new URL('./preservation.json', import.meta.url), 'utf8'))
  assert.deepEqual(result, saved)
} else await writeFile(new URL('./preservation.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
console.log(`PASS ${files.length} baseline files byte-identical; CTX pipeline, science gates and historical scientific evidence preserved`)
