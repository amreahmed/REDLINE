import { readFile, writeFile } from 'node:fs/promises'

const clean = value => value.replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|deg);/g, ' ').replace(/\s+/g, ' ').trim()
const inspection = []
for (const id of ['olympus', 'valles-marineris', 'elysium-mons', 'gale', 'jezero', 'hellas']) {
  const html = await readFile(new URL(`${id}.html`, import.meta.url), 'utf8')
  const hidden = html.match(/<input id="selected_control_net"[^>]*value="(\d+)"[^>]*>\s*([^<]+)/)
  const selected = html.match(/<option label="([^"]+)" value="(\d+)"\s+selected\s*>/)
  const network = hidden ? { id: hidden[1], name: clean(hidden[2]) }
    : selected ? { id: selected[2], name: selected[1] } : null
  if (!network) throw new Error(`No selected network for ${id}`)
  const coordinateReference = html.match(/<span id="coordinate_system_name"[^>]*>([^<]+)<\/span>/)?.[1]
  if (coordinateReference !== 'Planetocentric, +East, 0 - 360') throw new Error(`Unexpected convention for ${id}`)
  const rowPattern = new RegExp(`<tr class="geometry geom-${network.id} cs-6">([\\s\\S]*?)<\\/tr>`, 'g')
  const rows = [...html.matchAll(rowPattern)].map(match => clean(match[1]))
  const centerLatitude = rows.find(row => row.startsWith('Center Latitude '))
  const centerLongitude = rows.find(row => row.startsWith('Center Longitude '))
  if (!centerLatitude || !centerLongitude) throw new Error(`Missing active center for ${id}`)
  const latitudeMatch = centerLatitude.match(/Center Latitude\s+(-?[\d.]+)/)
  const longitudeMatch = centerLongitude.match(/Center Longitude\s+(-?[\d.]+)/)
  if (!latitudeMatch || !longitudeMatch) throw new Error(`Unexpected coordinate row for ${id}`)
  const name = clean(html.match(/<th>Feature Name<\/th>\s*<td>([\s\S]*?)<\/td>/)?.[1] ?? '')
  const featureId = clean(html.match(/<th>Feature ID<\/th>\s*<td>([\s\S]*?)<\/td>/)?.[1] ?? '')
  inspection.push({ id, name, featureId, network, coordinateReference,
    latitude: Number(latitudeMatch[1]),
    longitude: Number(longitudeMatch[1]), selectedGeometryRows: rows })
}
await writeFile(new URL('gazetteer-inspection.json', import.meta.url), JSON.stringify(inspection, null, 2) + '\n')
console.log(JSON.stringify(inspection, null, 2))
