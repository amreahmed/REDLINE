import { parseTerrainWindows } from './sampling'
import type { TerrainWindows } from './types'

export const TERRAIN_WINDOWS_URL = '/data/jezero-terrain-windows.json'
export const TERRAIN_WINDOWS_SHA256 = '7b655f1593091fede555394f2c685386b6a677ed4ca1a8ac0eb910130ea5928a'
type LoadOptions = { fetcher?: typeof fetch; timeoutMs?: number }

/** A bounded local source-derived asset; never fetches the full source raster. */
export async function loadTerrainWindows(signal: AbortSignal = new AbortController().signal, { fetcher = fetch, timeoutMs = 15_000 }: LoadOptions = {}): Promise<TerrainWindows> {
  signal.throwIfAborted()
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  try {
    const response = await fetcher(TERRAIN_WINDOWS_URL, { signal: controller.signal, credentials: 'omit' })
    if (!response.ok) throw new Error(`Numerical terrain asset returned HTTP ${response.status}. Retry when it is available.`)
    const format = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
    if (format !== 'application/json') throw new Error('Numerical terrain asset returned an unexpected format.')
    const bytes = await response.arrayBuffer()
    controller.signal.throwIfAborted()
    if (bytes.byteLength > 200_000) throw new Error('Numerical terrain asset exceeds the validated bounded-window size.')
    if (!globalThis.crypto?.subtle) throw new Error('Numerical terrain integrity verification is unavailable in this browser.')
    let digest: ArrayBuffer
    try { digest = await crypto.subtle.digest('SHA-256', bytes) } catch { throw new Error('Numerical terrain integrity verification could not be completed.') }
    controller.signal.throwIfAborted()
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    if (hash !== TERRAIN_WINDOWS_SHA256) throw new Error('Numerical terrain integrity check failed: source-window bytes do not match the verified asset.')
    let text: string
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new Error('Numerical terrain asset contains invalid UTF-8.') }
    let input: unknown
    try { input = JSON.parse(text) } catch { throw new Error('Numerical terrain asset contains malformed JSON.') }
    return parseTerrainWindows(input)
  } catch (error) {
    if (signal.aborted) throw signal.reason
    if (timedOut) throw new Error('Numerical terrain loading timed out. Retry to load the source windows.')
    if (error instanceof TypeError) throw new Error('Numerical terrain could not be loaded because of a network failure.')
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}
