import { MARS_GLOBE } from '../../data/marsGlobe'

export class GlobeAssetError extends Error {
  constructor(message: string) { super(message); this.name = 'GlobeAssetError' }
}

const MAX_BYTES = 16 * 1024 * 1024
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** Accept the inspected self-contained glTF 2 container, never HTML or remote dependencies. */
export function validateGlobeContainer(buffer: ArrayBuffer): void {
  const invalid = () => new GlobeAssetError('NASA returned an unsupported or incomplete model. No substitute globe is shown.')
  if (buffer.byteLength < 20 || buffer.byteLength > MAX_BYTES) throw invalid()
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw invalid()
  const jsonLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4e4f534a || jsonLength % 4 !== 0 || jsonLength > buffer.byteLength - 28) throw invalid()
  const binaryHeader = 20 + jsonLength
  const binaryLength = view.getUint32(binaryHeader, true)
  if (view.getUint32(binaryHeader + 4, true) !== 0x004e4942 || binaryLength !== buffer.byteLength - binaryHeader - 8) throw invalid()
  let json: unknown
  try { json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) } catch { throw invalid() }
  if (!record(json) || !record(json.asset) || json.asset.version !== '2.0') throw invalid()
  if (!Array.isArray(json.buffers) || json.buffers.length !== 1 || !json.buffers.every((item) => record(item) && item.uri === undefined && typeof item.byteLength === 'number' && item.byteLength > 0 && item.byteLength <= binaryLength && binaryLength - item.byteLength <= 3)) throw invalid()
  if (!Array.isArray(json.images) || json.images.length === 0 || !json.images.every((item) => record(item) && Number.isInteger(item.bufferView) && item.uri === undefined)) throw invalid()
  if (Array.isArray(json.extensionsRequired) && json.extensionsRequired.length > 0) throw invalid()
}

export async function fetchGlobeAsset(signal: AbortSignal, onBytes: (bytes: number) => void, { fetcher = fetch, timeoutMs = 30_000 }: { fetcher?: typeof fetch; timeoutMs?: number } = {}): Promise<ArrayBuffer> {
  signal.throwIfAborted()
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = AbortSignal.any([signal, timeout])
  try {
    const response = await fetcher(MARS_GLOBE.assetUrl, { signal: combined, mode: 'cors', credentials: 'omit' })
    if (!response.ok) throw new GlobeAssetError(`NASA's model service returned HTTP ${response.status}. Retry or continue with the regional map.`)
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (type !== 'model/gltf-binary' && type !== 'application/octet-stream') throw new GlobeAssetError('The model service returned an unexpected file type. No substitute globe is shown.')
    if (!response.body) throw new GlobeAssetError('The model response was empty.')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
      while (true) {
        combined.throwIfAborted()
        const { value, done } = await reader.read()
        combined.throwIfAborted()
        if (done) break
        total += value.byteLength
        if (total > MAX_BYTES) throw new GlobeAssetError('The model exceeds the supported download size. Continue with the regional map.')
        chunks.push(value)
        onBytes(total)
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    validateGlobeContainer(bytes.buffer)
    return bytes.buffer
  } catch (error) {
    if (signal.aborted) throw signal.reason
    if (timeout.aborted) throw new GlobeAssetError('The model download timed out. Retry when the connection is available.')
    if (error instanceof GlobeAssetError) throw error
    throw new GlobeAssetError('The NASA model could not be downloaded (network or CORS failure). Retry or use the regional map.')
  }
}
