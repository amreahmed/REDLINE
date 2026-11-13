/**
 * Loopback-only terrain failure QA. No application/source assets are written.
 * node docs/evidence/terrain-validation/browser-qa-server.mjs
 * POST /__qa/mode with {"mode":"normal"|"fail"|"tamper"|"slow"}.
 * Normal serves the actual public asset; other modes are visibly disclosed.
 */
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const asset = resolve(root, 'public/data/jezero-terrain-windows.json')
const modes = new Set(['normal', 'fail', 'tamper', 'slow'])
let mode = 'normal'
function reply(response, status, value) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(value))
}
const plugin = {
  name: 'redline-terrain-qa',
  transformIndexHtml() {
    return [{ tag: 'script', attrs: { type: 'module' }, children: `
      const banner = document.createElement('div');
      banner.id = 'terrain-qa-disclosure';
      banner.setAttribute('role', 'status');
      banner.style.cssText = 'position:fixed;bottom:6px;left:6px;z-index:10000;background:#161b22;color:#ffe4b5;padding:5px 8px;font:12px monospace;pointer-events:none;max-width:calc(100vw - 24px)';
      document.body.append(banner);
      async function disclose() {
        const value = await (await fetch('/__qa/mode', {cache:'no-store'})).json();
        banner.textContent = 'QA numerical terrain: ' + value.mode + (value.mode === 'normal' ? ' · actual local asset' : ' · injected test response');
      }
      void disclose(); setInterval(() => void disclose(), 250);
    `, injectTo: 'body' }]
  },
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const path = request.url?.split('?')[0]
      if (path === '/__qa/mode') {
        if (request.method === 'GET') { reply(response, 200, { mode }); return }
        if (request.method !== 'POST') { reply(response, 405, { error: 'Use GET or POST.' }); return }
        try {
          let body = ''
          for await (const chunk of request) {
            body += chunk.toString('utf8')
            if (body.length > 1024) { reply(response, 413, { error: 'Body too large.' }); return }
          }
          const value = JSON.parse(body)
          if (!modes.has(value?.mode)) { reply(response, 400, { error: 'Invalid mode.' }); return }
          mode = value.mode
          reply(response, 200, { mode })
        } catch { reply(response, 400, { error: 'Invalid JSON.' }) }
        return
      }
      if (path !== '/data/jezero-terrain-windows.json' || mode === 'normal') { next(); return }
      const requestMode = mode
      if (requestMode === 'fail') { reply(response, 503, { error: 'QA injected unavailability.' }); return }
      if (requestMode === 'slow') await new Promise(resolveDelay => setTimeout(resolveDelay, 2500))
      if (response.destroyed) return
      const bytes = await readFile(asset)
      if (requestMode === 'tamper') {
        const changed = JSON.parse(bytes.toString('utf8'))
        changed.windows[0].values[0] = Math.fround(changed.windows[0].values[0] + 1)
        reply(response, 200, changed)
        return
      }
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      response.end(bytes)
    })
  },
}
const server = await createServer({ root, configFile: resolve(root, 'vite.config.ts'), plugins: [plugin], server: { host: '127.0.0.1', port: 5174, strictPort: true, open: false } })
await server.listen()
console.log('Terrain QA: http://127.0.0.1:5174/; GET/POST /__qa/mode')
let closing = false
async function close() { if (closing) return; closing = true; await server.close(); process.exit(0) }
process.on('SIGINT', () => { void close() })
process.on('SIGTERM', () => { void close() })
