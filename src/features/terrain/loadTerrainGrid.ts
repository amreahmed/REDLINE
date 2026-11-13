import { decodeTerrainGrid, parseTerrainGridManifest, TERRAIN_GRID_BINARY_BYTES, TERRAIN_GRID_BINARY_SHA256, TERRAIN_GRID_BINARY_URL } from './terrainGrid'
import type { TerrainGrid } from './gridTypes'

export const TERRAIN_GRID_MANIFEST_URL = '/data/jezero-terrain-grid.json'
export const TERRAIN_GRID_MANIFEST_SHA256 = 'fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9'
export const TERRAIN_GRID_MANIFEST_BYTES = 3147

export type TerrainGridLoadOptions = { fetcher?: typeof fetch; timeoutMs?: number }

/** Exact bounded reads also reject oversized streaming bodies before allocation. */
async function boundedBytes(response: Response, expectedBytes: number, signal: AbortSignal): Promise<ArrayBuffer> {
  const length = response.headers.get('Content-Length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > expectedBytes)) throw new Error('Terrain grid response exceeds its exact validated byte size.')
  if (!response.body) throw new Error('Terrain grid response has no readable data body.')
  const result = new Uint8Array(expectedBytes)
  const reader = response.body.getReader()
  let position = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { value, done } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      if (value.byteLength > expectedBytes - position) throw new Error('Terrain grid response exceeds its exact validated byte size.')
      result.set(value, position)
      position += value.byteLength
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  if (position !== expectedBytes) throw new Error('Terrain grid response is truncated or has a changed byte size.')
  return result.buffer
}

async function verifyHash(bytes: ArrayBuffer, expectedHash: string): Promise<void> {
  if (!globalThis.crypto?.subtle) throw new Error('Terrain grid integrity verification is unavailable in this browser.')
  let digest: ArrayBuffer
  try { digest = await globalThis.crypto.subtle.digest('SHA-256', bytes) } catch { throw new Error('Terrain grid integrity verification could not be completed.') }
  const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
  if (hash !== expectedHash) throw new Error('Terrain grid integrity check failed; the asset differs from the audited native data.')
}

async function fetchBytes(fetcher: typeof fetch, url: string, expectedBytes: number, expectedFormat: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetcher(url, { signal, credentials: 'omit' })
  signal.throwIfAborted()
  if (!response.ok) throw new Error(`Terrain grid asset returned HTTP ${response.status}. Retry when it is available.`)
  const format = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
  // Vite may omit MIME or send an empty header for .f32 files. Exact byte-size
  // and SHA-256 pins still establish the binary; JSON and nonempty MIME stay strict.
  if (format !== expectedFormat && !(expectedFormat === 'application/octet-stream' && (format === undefined || format === ''))) throw new Error('Terrain grid asset returned an unexpected format.')
  return boundedBytes(response, expectedBytes, signal)
}

/** Cached source-derived native crop; never downloads the full GeoTIFF in the browser. */
export async function loadTerrainGrid(signal: AbortSignal = new AbortController().signal, { fetcher = fetch, timeoutMs = 15_000 }: TerrainGridLoadOptions = {}): Promise<TerrainGrid> {
  signal.throwIfAborted()
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Terrain grid request timeout must be a positive finite duration.')
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  try {
    const manifestBytes = await fetchBytes(fetcher, TERRAIN_GRID_MANIFEST_URL, TERRAIN_GRID_MANIFEST_BYTES, 'application/json', controller.signal)
    await verifyHash(manifestBytes, TERRAIN_GRID_MANIFEST_SHA256)
    controller.signal.throwIfAborted()
    let manifestDocument: unknown
    try { manifestDocument = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)) } catch { throw new Error('Terrain grid manifest is not valid UTF-8 JSON.') }
    const manifest = parseTerrainGridManifest(manifestDocument)
    const binaryBytes = await fetchBytes(fetcher, TERRAIN_GRID_BINARY_URL, TERRAIN_GRID_BINARY_BYTES, 'application/octet-stream', controller.signal)
    await verifyHash(binaryBytes, TERRAIN_GRID_BINARY_SHA256)
    controller.signal.throwIfAborted()
    return decodeTerrainGrid(manifest, binaryBytes)
  } catch (error) {
    if (timedOut) throw new Error('Terrain grid request timed out. Retry when it is available.')
    signal.throwIfAborted()
    if (error instanceof TypeError) throw new Error('Terrain grid network failure. Retry when the asset is available.', { cause: error })
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
    controller.abort()
  }
}
