// Diagnostic only. Imports the actual unchanged TypeScript modules with Node's
// native type stripping; no copy or second implementation of app mathematics.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { extname } from 'node:path'

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !extname(specifier)) return nextResolve(`${specifier}.ts`, context)
  return nextResolve(specifier, context)
} })
const { decodeTerrainGrid, getGridCell, gridCellForCoordinate, parseTerrainGridManifest } = await import('../../../../src/features/terrain/terrainGrid.ts')
const { marsSurfaceDistance } = await import('../../../../src/features/terrain/terrainMath.ts')
const { measureGridSeparation } = await import('../../../../src/features/terrain/terrainMetrics.ts')
const root = new URL('../../../../', import.meta.url)
const here = new URL('./', import.meta.url)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const manifestBytes = await readFile(new URL('public/data/jezero-terrain-grid.json', root))
const binary = await readFile(new URL('public/data/jezero-terrain-grid.f32', root))
assert.equal(hash(manifestBytes), 'fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9')
assert.equal(hash(binary), '4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8')
const grid = decodeTerrainGrid(parseTerrainGridManifest(JSON.parse(manifestBytes)), Uint8Array.from(binary).buffer)
const { startRow, startColumn, rows, columns } = grid.manifest.grid
const coords = []
const points = []
const coordinate = (lon, lat, domain = '-180-180') => ({lon, lat, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeDomain: domain})
for (let row = startRow; row < startRow + rows; row++) for (let column = startColumn; column < startColumn + columns; column++) {
  const result = getGridCell(grid, row, column)
  assert.equal(result.status, 'valid')
  const point = result.cell
  coords.push(point.lon, point.lat)
  points.push(coordinate(point.lon, point.lat))
  const mapped = gridCellForCoordinate(grid, [point.lon, point.lat])
  assert.equal(mapped.status, 'valid')
  assert.equal(mapped.cell.row, row)
  assert.equal(mapped.cell.column, column)
}
const steps = [[0,1], [1,0], [1,1], [1,-1]]
const lengths = []
const counts = steps.map(() => 0)
for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) for (let direction = 0; direction < steps.length; direction++) {
  const [dr, dc] = steps[direction]
  if (row + dr >= rows || column + dc < 0 || column + dc >= columns) continue
  const result = marsSurfaceDistance(points[row * columns + column], points[(row + dr) * columns + column + dc])
  assert.equal(result.status, 'available')
  lengths.push(result.value)
  counts[direction]++
}
assert.deepEqual(counts, [65280, 65280, 65025, 65025])
const cases = [
  ['one-degree-meridian', coordinate(0,0), coordinate(0,1)],
  ['quarter-circumference', coordinate(0,0), coordinate(90,0)],
  ['antipodal', coordinate(0,0), coordinate(180,0)],
  ['near-antipodal', coordinate(0,0), coordinate(179.9999999,0.0000001)],
  ['high-latitude', coordinate(0,60), coordinate(90,60)],
  ['longitude-wrap', coordinate(179,0), coordinate(-179,0)],
  ['domain-0-360-wrap', coordinate(359,0,'0-360'), coordinate(1,0,'0-360')],
  ['equivalent-domains', coordinate(359,10,'0-360'), coordinate(-1,10)],
  ['same-pole', coordinate(0,90), coordinate(90,90)],
  ['same-position', coordinate(77.38,18.48), coordinate(77.38,18.48)],
  ['submillimetre', coordinate(77.38,18.48), coordinate(77.380000001,18.48)],
]
const fixtures = cases.map(([name, from, to]) => {
  const result = marsSurfaceDistance(from, to)
  assert.equal(result.status, 'available')
  return {name, from, to, applicationDistanceM: result.value}
})
for (const [name, from, to] of [
  ['east-west', [714,650], [714,651]], ['north-south', [714,650], [715,650]],
  ['diagonal', [714,650], [715,651]], ['opposite-boundaries', [586,522], [841,777]],
  ['long-regional', [650,580], [800,730]],
]) {
  const result = measureGridSeparation(grid, {row:from[0],column:from[1]}, {row:to[0],column:to[1]})
  assert.equal(result.status, 'available')
  fixtures.push({name, from:coordinate(result.value.from.lon,result.value.from.lat), to:coordinate(result.value.to.lon,result.value.to.lat), applicationDistanceM:result.value.distanceM, sourceIndices:[from,to]})
}
const rejectionCases = [
  {...coordinate(0,0),lat:91}, {...coordinate(0,0),lon:181},
  {...coordinate(0,0),latitudeConvention:'planetographic'}, {...coordinate(0,0),longitudeDirection:'west-positive'},
  {...coordinate(0,0),lat:NaN},
]
for (const rejected of rejectionCases) assert.equal(marsSurfaceDistance(rejected, coordinate(0,0)).status, 'unavailable')
const values = [...coords, ...lengths]
const captured = Buffer.alloc(values.length * 8)
values.forEach((value,index) => captured.writeDoubleLE(value,index*8))
await writeFile(new URL('app-horizontal.bin', here), captured)
const sources = {}
for (const file of ['src/features/terrain/terrainMath.ts','src/features/terrain/terrainMetrics.ts','src/features/terrain/terrainGrid.ts','src/features/terrain/sampling.ts','src/features/mission/coordinates.ts']) sources[file] = hash(await readFile(new URL(file,root)))
const metadata = {node:process.version, model:'actual app cell coordinates and reference-sphere distances; no height inputs', manifestHash:hash(manifestBytes), gridHash:hash(binary), sourceModuleHashes:sources, cellCount:points.length, edgeCount:lengths.length, directionSteps:steps, directionCounts:counts, captureEncoding:'little-endian float64; row-major lon,lat pairs then unique-edge distances in row/column/direction order', captureBytes:captured.length, captureSha256:hash(captured), fixtures, invalidCoordinateCases:rejectionCases.length, notes:'Capture is generated diagnostic output, excluded from Git and production. Run compare-proj.py to independently validate it.'}
await writeFile(new URL('app-capture.json', here), `${JSON.stringify(metadata,null,2)}\n`)
console.log(`PASS capture: ${points.length} native centers, ${lengths.length} unique edges, ${fixtures.length} analytic/native fixtures, ${rejectionCases.length} invalid inputs. Independent comparison still required.`)
