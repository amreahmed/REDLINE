import type { TerrainModelGrid } from './modelTypes'
import {
  decodeHrscModel, parseHrscModelManifest,
  HRSC_MODEL_BINARY_BYTES, HRSC_MODEL_BINARY_SHA256, HRSC_MODEL_BINARY_URL,
  HRSC_MODEL_MANIFEST_BYTES, HRSC_MODEL_MANIFEST_SHA256, HRSC_MODEL_MANIFEST_URL,
  HRSC_MODEL_VALIDITY_BYTES, HRSC_MODEL_VALIDITY_SHA256, HRSC_MODEL_VALIDITY_URL,
} from './hrscModel'

export type HrscModelLoadOptions = { signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number }

async function boundedBytes(response: Response, expectedBytes: number, signal: AbortSignal): Promise<ArrayBuffer> {
  const length = response.headers.get('Content-Length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > expectedBytes)) throw new Error('HRSC model response exceeds its exact validated byte size.')
  if (!response.body) throw new Error('HRSC model response has no readable data body.')
  const bytes = new Uint8Array(expectedBytes)
  const reader = response.body.getReader()
  const abortRead = () => { void reader.cancel(signal.reason).catch(() => undefined) }
  signal.addEventListener('abort', abortRead, { once: true })
  let position = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      if (value.byteLength > expectedBytes - position) throw new Error('HRSC model response exceeds its exact validated byte size.')
      bytes.set(value, position)
      position += value.byteLength
    }
  } finally {
    signal.removeEventListener('abort', abortRead)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  if (position !== expectedBytes) throw new Error('HRSC model response is truncated or has a changed byte size.')
  return bytes.buffer
}

async function verifyHash(bytes: ArrayBuffer, expected: string): Promise<void> {
  if (!globalThis.crypto?.subtle) throw new Error('HRSC model integrity verification is unavailable in this browser.')
  let digest: ArrayBuffer
  try { digest = await crypto.subtle.digest('SHA-256', bytes) } catch { throw new Error('HRSC model integrity verification could not be completed.') }
  const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
  if (hash !== expected) throw new Error('HRSC model integrity check failed; the asset differs from the preserved native source.')
}

async function fetchBytes(fetcher: typeof fetch, url: string, size: number, format: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetcher(url, { signal, credentials: 'omit' })
  signal.throwIfAborted()
  if (!response.ok) throw new Error(`HRSC model asset returned HTTP ${response.status}. Retry when it is available.`)
  const actual = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
  // Some static servers omit MIME for native binary extensions. Size and
  // SHA-256 remain mandatory, while JSON and any nonempty binary MIME are strict.
  if (actual !== format && !(format === 'application/octet-stream' && (actual === undefined || actual === ''))) throw new Error('HRSC model asset returned an unexpected format.')
  return boundedBytes(response, size, signal)
}

/** Loads only the separately pinned native subset, never the full remote TIFF. */
export async function loadHrscModel({ signal = new AbortController().signal, fetcher = fetch, timeoutMs = 15_000 }: HrscModelLoadOptions = {}): Promise<TerrainModelGrid> {
  signal.throwIfAborted()
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('HRSC model request timeout must be a positive finite duration.')
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  try {
    const manifestBytes = await fetchBytes(fetcher, HRSC_MODEL_MANIFEST_URL, HRSC_MODEL_MANIFEST_BYTES, 'application/json', controller.signal)
    await verifyHash(manifestBytes, HRSC_MODEL_MANIFEST_SHA256)
    controller.signal.throwIfAborted()
    let document: unknown
    try { document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)) } catch { throw new Error('HRSC model manifest is not valid UTF-8 JSON.') }
    const manifest = parseHrscModelManifest(document)
    const [samples, validity] = await Promise.all([
      fetchBytes(fetcher, HRSC_MODEL_BINARY_URL, HRSC_MODEL_BINARY_BYTES, 'application/octet-stream', controller.signal),
      fetchBytes(fetcher, HRSC_MODEL_VALIDITY_URL, HRSC_MODEL_VALIDITY_BYTES, 'application/octet-stream', controller.signal),
    ])
    await Promise.all([verifyHash(samples, HRSC_MODEL_BINARY_SHA256), verifyHash(validity, HRSC_MODEL_VALIDITY_SHA256)])
    controller.signal.throwIfAborted()
    return decodeHrscModel(manifest, samples, validity)
  } catch (error) {
    if (timedOut) throw new Error('HRSC model request timed out. Retry when it is available.')
    signal.throwIfAborted()
    if (error instanceof TypeError) throw new Error('HRSC model network failure. Retry when the asset is available.', { cause: error })
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
    controller.abort()
  }
}
