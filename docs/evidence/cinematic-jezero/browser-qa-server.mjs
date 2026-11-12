/**
 * Local source-failure QA harness. Application files are never written.
 * Start: node docs/evidence/cinematic-jezero/browser-qa-server.mjs
 * Control: POST http://127.0.0.1:5174/__qa/mode with {"mode":"normal"|"fail"|"slow"}.
 * Motion: ?qaMotion=reduce for initial reduction; POST /__qa/motion with
 * {"reduced":true|false|null} to force reduction on/off or restore browser preference.
 * The browser disclosure is intentionally visible. No NASA responses are replaced.
 */
import { createServer, normalizePath } from 'vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const mainFile = normalizePath(resolve(repository, 'src/main.tsx'))
const virtualModule = 'virtual:redline-qa-runtime'
const resolvedModule = '\0redline-qa-runtime'
const supportedModes = new Set(['normal', 'fail', 'slow'])
let sourceMode = 'normal'
let motionOverride = null
let motionRevision = 0

const runtime = String.raw`
if (!window.__redlineQaInstalled) {
  window.__redlineQaInstalled = true;
  const nativeFetch = window.fetch.bind(window);
  const nativeMatchMedia = window.matchMedia.bind(window);
  const motionMedia = nativeMatchMedia('(prefers-reduced-motion: reduce)');
  const initialQueryReduced = new URLSearchParams(window.location.search).get('qaMotion') === 'reduce';
  let reducedMotionOverride = initialQueryReduced ? true : null;
  let motionControlRevision;
  const changeEvents = new EventTarget();
  let onchange = null;
  const matches = () => reducedMotionOverride === null ? motionMedia.matches : reducedMotionOverride;
  let previousMatches = matches();
  const motionProxy = new Proxy(motionMedia, {
    get(target, property) {
      if (property === 'matches') return matches();
      if (property === 'onchange') return onchange;
      if (property === 'addListener') return listener => changeEvents.addEventListener('change', listener);
      if (property === 'removeListener') return listener => changeEvents.removeEventListener('change', listener);
      if (property === 'addEventListener' || property === 'removeEventListener' || property === 'dispatchEvent') return changeEvents[property].bind(changeEvents);
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, property, value) {
      if (property === 'onchange') {
        if (onchange) changeEvents.removeEventListener('change', onchange);
        onchange = typeof value === 'function' ? value : null;
        if (onchange) changeEvents.addEventListener('change', onchange);
        return true;
      }
      return Reflect.set(target, property, value, target);
    },
  });
  function notifyMotionChange() {
    const nextMatches = matches();
    if (nextMatches === previousMatches) return;
    previousMatches = nextMatches;
    const event = typeof MediaQueryListEvent === 'function'
      ? new MediaQueryListEvent('change', { matches: nextMatches, media: motionMedia.media })
      : Object.assign(new Event('change'), { matches: nextMatches, media: motionMedia.media });
    changeEvents.dispatchEvent(event);
  }
  motionMedia.addEventListener('change', notifyMotionChange);
  window.matchMedia = query => String(query).trim() === '(prefers-reduced-motion: reduce)' ? motionProxy : nativeMatchMedia(query);
  const modelUrl = 'https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24881_Mars_1_6792.glb';
  const disclosure = document.createElement('div');
  disclosure.id = 'redline-qa-source-disclosure';
  disclosure.setAttribute('role', 'status');
  disclosure.setAttribute('aria-live', 'polite');
  disclosure.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:10000;padding:5px 8px;border:1px solid #f3b866;border-radius:4px;background:#161b22;color:#ffe4b5;font:12px/1.4 monospace;pointer-events:none;max-width:calc(100vw - 32px)';
  disclosure.textContent = 'QA source mode: checking | QA reduced motion: ' + (matches() ? 'on' : 'off');
  document.body.append(disclosure);
  let shownMode;
  function showDisclosure() {
    const description = shownMode === 'slow' ? ' · real requests delayed 2.5 s' : shownMode === 'fail' ? ' · injected network failure' : ' · real NASA requests';
    const motionDescription = reducedMotionOverride === null ? 'browser preference (' + (matches() ? 'on' : 'off') + ')' : reducedMotionOverride ? 'forced on' : 'forced off';
    disclosure.textContent = 'QA source mode: ' + (shownMode ?? 'checking') + description + ' | QA reduced motion: ' + motionDescription;
  }
  async function readMotion() {
    const response = await nativeFetch('/__qa/motion', { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('QA motion control unavailable');
    const result = await response.json();
    const firstControlRead = motionControlRevision === undefined;
    if ((!firstControlRead || !initialQueryReduced) && result.revision > 0 && result.revision !== motionControlRevision) {
      if (result.reduced !== null && typeof result.reduced !== 'boolean') throw new Error('Invalid QA motion');
      reducedMotionOverride = result.reduced;
      notifyMotionChange();
    }
    motionControlRevision = result.revision;
    showDisclosure();
  }
  async function readMode() {
    const response = await nativeFetch('/__qa/mode', { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('QA mode control unavailable');
    const result = await response.json();
    if (!['normal', 'fail', 'slow'].includes(result.mode)) throw new Error('Invalid QA mode');
    if (shownMode !== result.mode) {
      shownMode = result.mode;
      showDisclosure();
    }
    return result.mode;
  }
  function delay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(signal.reason); return; }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
      function abort() { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(signal.reason); }
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  window.fetch = async function(input, init) {
    const requestUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(requestUrl, window.location.href);
    const sourceRequest = url.href === modelUrl || (url.origin === 'https://trek.nasa.gov' && url.pathname.startsWith('/tiles/Mars/'));
    if (!sourceRequest) return nativeFetch(input, init);
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (signal?.aborted) throw signal.reason;
    const mode = await readMode();
    if (signal?.aborted) throw signal.reason;
    if (mode === 'fail') throw new TypeError('QA injected network failure');
    if (mode === 'slow') await delay(2500, signal);
    return nativeFetch(input, init);
  };
  void readMode().catch(() => { disclosure.textContent = 'QA source mode: control unavailable'; });
  void readMotion().catch(() => { disclosure.textContent = 'QA reduced motion: control unavailable'; });
  setInterval(() => {
    void readMode().catch(() => { disclosure.textContent = 'QA source mode: control unavailable'; shownMode = undefined; });
    void readMotion().catch(() => { disclosure.textContent = 'QA reduced motion: control unavailable'; });
  }, 250);
}
`

function reply(response, status, value) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(value))
}

const qaPlugin = {
  name: 'redline-local-source-qa',
  enforce: 'pre',
  resolveId(id) { if (id === virtualModule) return resolvedModule },
  load(id) { if (id === resolvedModule) return runtime },
  transform(code, id) {
    if (normalizePath(id.split('?')[0]) === mainFile) return { code: `import '${virtualModule}';\n${code}`, map: null }
  },
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const path = request.url?.split('?')[0]
      if (path !== '/__qa/mode' && path !== '/__qa/motion') { next(); return }
      if (request.method === 'GET') { reply(response, 200, path === '/__qa/mode' ? { mode: sourceMode } : { reduced: motionOverride, revision: motionRevision }); return }
      if (request.method !== 'POST') { reply(response, 405, { error: 'Use GET or POST.' }); return }
      try {
        let body = ''
        for await (const chunk of request) {
          body += chunk.toString('utf8')
          if (body.length > 1024) { reply(response, 413, { error: 'QA mode body is too large.' }); return }
        }
        const value = JSON.parse(body)
        if (path === '/__qa/motion') {
          if (value?.reduced !== null && typeof value?.reduced !== 'boolean') { reply(response, 400, { error: 'Reduced must be true, false, or null to restore browser preference.' }); return }
          motionOverride = value.reduced
          motionRevision++
          reply(response, 200, { reduced: motionOverride, revision: motionRevision })
          return
        }
        if (!supportedModes.has(value?.mode)) { reply(response, 400, { error: 'Mode must be normal, fail, or slow.' }); return }
        sourceMode = value.mode
        reply(response, 200, { mode: sourceMode })
      } catch { reply(response, 400, { error: 'Provide JSON containing a valid mode.' }) }
    })
  },
}

const server = await createServer({
  root: repository,
  configFile: resolve(repository, 'vite.config.ts'),
  plugins: [qaPlugin],
  server: { host: '127.0.0.1', port: 5174, strictPort: true, open: false },
})
await server.listen()
console.log('REDLINE QA server: http://127.0.0.1:5174/ (source mode: normal)')
console.log('GET/POST /__qa/mode controls disclosed normal/fail/slow source injection.')
console.log('GET/POST /__qa/motion controls disclosed reduced-motion overrides (true/false/null).')
let closing = false
async function close() {
  if (closing) return
  closing = true
  await server.close()
  process.exit(0)
}
process.on('SIGINT', () => { void close() })
process.on('SIGTERM', () => { void close() })
