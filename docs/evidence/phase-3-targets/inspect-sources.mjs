import { readFile, writeFile } from 'node:fs/promises'

const clean = value => value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|deg);/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&#x2019;/g, '’').replace(/\s+/g, ' ').trim()
const all = []
for (const id of ['jezero', 'belva', 'neretva', 'sava']) {
  const html = await readFile(new URL(`${id}-gazetteer.html`, import.meta.url), 'utf8')
  const hiddenNetwork = html.match(/<input id="selected_control_net"[^>]*value="(\d+)"[^>]*>\s*([^<]+)/)
  const selectedNetwork = html.match(/<option label="([^\"]+)" value="(\d+)"\s+selected\s*>/)
  const network = hiddenNetwork ? {id:hiddenNetwork[1], name:clean(hiddenNetwork[2])} : selectedNetwork ? {id:selectedNetwork[2],name:selectedNetwork[1]} : null
  const cs = html.match(/<span id="coordinate_system_name"[^>]*>([^<]+)<\/span>/)
  const rowPattern = new RegExp(`<tr class="geometry geom-${network?.id} cs-6">([\\s\\S]*?)<\\/tr>`, 'g')
  const rows = [...html.matchAll(rowPattern)].map(match=>clean(match[1]))
  const name = html.match(/<th>Feature Name<\/th>\s*<td>([\s\S]*?)<\/td>/)
  const fid = html.match(/<th>Feature ID<\/th>\s*<td>([\s\S]*?)<\/td>/)
  const wkt = html.match(/<td class="wkt_string hidden">([\s\S]*?)<\/td>/)
  all.push({id, name:clean(name?.[1]??''), featureId:clean(fid?.[1]??''), network, coordinateConvention:cs?.[1], selectedGeometryRows:rows, firstWkt:wkt?clean(wkt[1]):null})
}
await writeFile(new URL('gazetteer-inspection.json',import.meta.url),JSON.stringify(all,null,2)+'\n')
console.log(JSON.stringify(all.map(({firstWkt,...other})=>other),null,2))
for(const file of ['belva-nasa-science.html','mars-coordinate-guidance.html','usgs-copyright.html','nasa-use-guidance.html','neretva-nasa-science-valid.html','jezero-nasa-science.html','gazetteer-accuracy.html']) {
  const content=clean(await readFile(new URL(file,import.meta.url),'utf8'))
  await writeFile(new URL(file.replace('.html','-text.txt'),import.meta.url),content+'\n')
  const excerpts=[...content.matchAll(/.{0,160}(?:dipping beds|vertical cross-section|MDIM 2.1|control network|Public Domain|proper credit|NASA content|copyright protected|river channel|fresh water|confluence|accuracy|accurate|precision).{0,400}/gi)].map(m=>m[0])
  console.log(JSON.stringify({file,excerpts:excerpts.slice(0,8)},null,2))
}
