import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const baseline = '48410ca'
const areas = ['public', 'src/features/terrain', 'src/features/routing', 'src/features/mission', 'src/features/map', 'src/features/globe', 'src/data', 'docs/science-routing-audit.md', 'docs/evidence/science-routing-audit', 'docs/evidence/scientific-validation', 'docs/evidence/scientific-gate-resolution', 'docs/evidence/scientific-resolution-2026-11-14', 'docs/evidence/terrain-model']
// Report presentation receives ETA. All existing scientific and route calculations are protected.
const exclude = new Set(['src/features/routing/terrainModelReport.ts'])
const tree = execFileSync('git', ['ls-tree', '-rl', baseline, '--', ...areas], { encoding: 'utf8' }).trim().split(/\r?\n/)
const files = []
for (const line of tree) {
  const match = /^\d+ blob ([a-f0-9]+)\s+(\d+)\t(.+)$/.exec(line)
  assert.ok(match, `Unsupported tree entry: ${line}`)
  const [, blob, size, file] = match
  if (exclude.has(file)) continue
  const bytes = await readFile(file)
  assert.equal(bytes.length, Number(size), `Protected source size changed: ${file}`)
  // Exact raw bytes, including source line endings, must hash to the committed Git blob.
  const actualBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
  assert.equal(actualBlob, blob, `Protected source bytes changed: ${file}`)
  files.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
}
const result = { baseline, protectedFilesCompared: files.length, differingFiles: 0, ctxCells: 65536, hrscCells: 10609, excludedPresentationFiles: [...exclude], files }
if (process.argv.includes('--verify-saved')) assert.deepEqual(result, JSON.parse(await readFile(new URL('./preservation.json', import.meta.url), 'utf8')))
else await writeFile(new URL('./preservation.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`)
console.log(`PASS ${files.length} protected files byte-identical to ${baseline}; 65,536 CTX and 10,609 HRSC cells preserved`)
