import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const here = new URL('./', import.meta.url)
const receipts = JSON.parse(await readFile(new URL('source-http.json', here), 'utf8'))
let checked = 0
for (const receipt of receipts) {
  if (!receipt.sha256) continue // No body was received for a failed transport.
  const extension = receipt.name === 'mer-catalog' ? '.cat' : '.html'
  const filename = receipt.name.endsWith('.bsp') ? receipt.name : receipt.name + extension
  const bytes = await readFile(new URL(filename, here))
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== receipt.sha256) throw new Error(`Saved bytes differ from receipt: ${filename}`)
  if (bytes.length !== (receipt.bytes ?? receipt.savedBytes)) throw new Error(`Byte count differs: ${filename}`)
  checked++
}
console.log(`${checked} saved HTTP response bodies/captures match their SHA-256 and byte receipts.`)
