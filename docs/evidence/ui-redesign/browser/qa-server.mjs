// Loopback-only UI acceptance harness; injected failures/preferences are test fixtures.
// Run after build. Modes in ignored node_modules/.redline-ui-qa-mode.txt:
// normal, globe-fail, windows-fail, reduced-motion. Production code is untouched.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const dist = path.resolve('dist')
const modeFile = path.resolve('node_modules/.redline-ui-qa-mode.txt')
const mode = async () => (await readFile(modeFile, 'utf8').catch(() => 'normal')).trim()
const formats = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.f32': 'application/octet-stream', '.svg': 'image/svg+xml' }
const injection = (current) => `<script>
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
  const url = typeof input === 'string' ? input : input.url || String(input);
  const state = await originalFetch('/__qa/state').then(r => r.text());
  if ((state === 'globe-fail' && url.includes('24881_Mars_1_6792.glb')) || (state === 'windows-fail' && url.includes('jezero-terrain-windows.json'))) return new Response('Injected UI QA failure', {status:503});
  return originalFetch(input, options);
};
${current === 'reduced-motion' ? `
const originalMedia = window.matchMedia.bind(window);
window.matchMedia = query => query === '(prefers-reduced-motion: reduce)' ? {matches:true, media:query, addEventListener(){}, removeEventListener(){}} : originalMedia(query);
` : ''}
</script>${current === 'reduced-motion' ? '<style>*,*::before,*::after{transition:none!important;animation:none!important}</style>' : ''}<div style="position:fixed;bottom:0;left:0;z-index:9999;background:#502d05;color:white;padding:3px;font:10px sans-serif;pointer-events:none">LOCAL UI QA · injected ${current} fixture</div>`

http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1:4177').pathname
    if (pathname === '/__qa/state') { response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); response.end(await mode()); return }
    const filename = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
    if (!filename.startsWith(`${dist}${path.sep}`)) { response.writeHead(403); response.end(); return }
    let bytes = await readFile(filename)
    if (pathname === '/') bytes = Buffer.from(bytes.toString().replace('<head>', `<head><meta charset="utf-8">${injection(await mode())}`))
    response.writeHead(200, { 'Content-Type': formats[path.extname(filename)] ?? 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' })
    response.end(bytes)
  } catch { response.writeHead(404); response.end('UI QA file unavailable') }
}).listen(4177, '127.0.0.1', () => process.stdout.write('Local UI QA harness: http://127.0.0.1:4177\n'))
