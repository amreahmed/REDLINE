import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const directory = new URL('./', import.meta.url)
const base = 'https://naif.jpl.nasa.gov/pub/naif/pds/pds4/mars2020/mars2020_spice/'
const sources = [
  ['mars2020-spice-archive.html', `${base}document/spiceds_v003.html`],
  ['spk-index.html', `${base}spice_kernels/spk/`],
  ['fk-index.html', `${base}spice_kernels/fk/`],
  ['pck-index.html', `${base}spice_kernels/pck/`],
  ['m2020_ls_ops210303_iau2000_v1.bsp', `${base}spice_kernels/spk/m2020_ls_ops210303_iau2000_v1.bsp`],
  ['m2020_ls_ops210303_iau2000_v1.xml', `${base}spice_kernels/spk/m2020_ls_ops210303_iau2000_v1.xml`],
  ['m2020_v04.tf', `${base}spice_kernels/fk/m2020_v04.tf`],
  ['pck00010.tpc', `${base}spice_kernels/pck/pck00010.tpc`],
  ['naif0012.tls', `${base}spice_kernels/lsk/naif0012.tls`],
  ['m2020_surf_rover_loc_0659_0779_v1.bsp', `${base}spice_kernels/spk/m2020_surf_rover_loc_0659_0779_v1.bsp`],
  ['m2020_surf_rover_loc_0659_0779_v1.xml', `${base}spice_kernels/spk/m2020_surf_rover_loc_0659_0779_v1.xml`],
  ['ntrs-actual-landing.html', 'https://ntrs.nasa.gov/citations/20210024644'],
  ['cheng2021-publisher-response.html', 'https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2020EA001560'],
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
let receipts
if (process.argv.includes('--verify-saved')) {
  receipts = JSON.parse(await readFile(new URL('http-receipts.json', directory), 'utf8'))
} else {
  receipts = await Promise.all(sources.map(async ([file, url]) => {
    const retrievedUtc = new Date().toISOString()
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
      const bytes = Buffer.from(await response.arrayBuffer())
      await writeFile(new URL(file, directory), bytes)
      return { file, requestedUrl: url, finalUrl: response.url, retrievedUtc, status: response.status, bytes: bytes.length, sha256: hash(bytes), contentType: response.headers.get('content-type'), cors: response.headers.get('access-control-allow-origin') }
    } catch (error) {
      return { file, requestedUrl: url, retrievedUtc, error: String(error) }
    }
  }))
  await writeFile(new URL('http-receipts.json', directory), JSON.stringify(receipts, null, 2) + '\n')
}
assert.equal(receipts.length, sources.length)
for (const [file, url] of sources) {
  const receipt = receipts.find(value => value.file === file && value.requestedUrl === url)
  assert(receipt, file)
  if (receipt.error) continue
  const bytes = await readFile(new URL(file, directory))
  assert.equal(bytes.length, receipt.bytes, file)
  assert.equal(hash(bytes), receipt.sha256, file)
}
for (const file of ['mars2020-spice-archive.html', 'm2020_ls_ops210303_iau2000_v1.bsp', 'm2020_ls_ops210303_iau2000_v1.xml', 'm2020_v04.tf', 'pck00010.tpc', 'naif0012.tls', 'm2020_surf_rover_loc_0659_0779_v1.bsp', 'm2020_surf_rover_loc_0659_0779_v1.xml']) assert.equal(receipts.find(value => value.file === file).status, 200, file)
// NAIF/DAF is the older valid SPK file identifier; the Toolkit handles both forms.
for (const file of ['m2020_ls_ops210303_iau2000_v1.bsp', 'm2020_surf_rover_loc_0659_0779_v1.bsp']) assert(['DAF/SPK', 'NAIF/DAF'].includes((await readFile(new URL(file, directory))).subarray(0, 8).toString('ascii').trim()), file)
console.log(JSON.stringify(receipts.map(({ file, status, bytes, error }) => ({ file, status, bytes, error })), null, 2))
