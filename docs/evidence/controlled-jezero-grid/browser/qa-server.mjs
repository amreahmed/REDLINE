// Local-only production QA harness. Faults are injected test responses, never NASA data.
// Run after npm run build: node docs/evidence/controlled-jezero-grid/browser/qa-server.mjs
// Change node_modules/.redline-grid-qa-mode.txt to normal, asset-fail, asset-altered,
// delayed, controlled-fail, or controlled-tiles-fail. Only loopback is bound.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')
const modeFile = path.join(root, 'node_modules/.redline-grid-qa-mode.txt')
const mode = async () => (await readFile(modeFile, 'utf8').catch(() => 'normal')).trim()
const formats = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.f32': 'application/octet-stream', '.png': 'image/png', '.svg': 'image/svg+xml' }
const injection = `<script>
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
  const url = String(input);
  if (url.includes('JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0')) {
    const state = await originalFetch('/__qa/state').then(r => r.text());
    if ((state === 'controlled-fail' && url.includes('WMTSCapabilities.xml')) || (state === 'controlled-tiles-fail' && !url.includes('WMTSCapabilities.xml'))) return new Response('Injected QA failure', {status:503});
  }
  return originalFetch(input, options);
};
</script><div style="position:fixed;bottom:0;left:0;z-index:9999;background:#502d05;color:white;padding:3px;font:10px sans-serif;pointer-events:none">LOCAL QA HARNESS · injected test failures are not source data</div>`

http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1:4174').pathname
    if (pathname === '/__qa/state') { response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); response.end(await mode()); return }
    const filename = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
    if (!filename.startsWith(`${dist}${path.sep}`)) { response.writeHead(403); response.end(); return }
    let bytes = await readFile(filename)
    const current = await mode()
    if (pathname === '/data/jezero-terrain-grid.json') {
      if (current === 'asset-fail') { response.writeHead(503); response.end('Injected QA failure'); return }
      if (current === 'delayed') await new Promise(resolve => setTimeout(resolve, 5000))
    }
    if (pathname === '/data/jezero-terrain-grid.f32' && current === 'asset-altered') { bytes = Buffer.from(bytes); bytes[0] ^= 1 }
    if (pathname === '/') bytes = Buffer.from(bytes.toString().replace('<head>', `<head>${injection}`))
    response.writeHead(200, { 'Content-Type': formats[path.extname(filename)] ?? 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' })
    response.end(bytes)
  } catch { response.writeHead(404); response.end('QA file unavailable') }
}).listen(4174, '127.0.0.1', () => process.stdout.write('Local production QA harness: http://127.0.0.1:4174\n'))
