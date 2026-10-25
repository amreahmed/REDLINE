import { describe, expect, it, vi } from 'vitest'
import { fetchGlobeAsset, validateGlobeContainer } from './asset'
import { MARS_GLOBE } from '../../data/marsGlobe'

// Synthetic container fixtures exercise validation only; they are never displayed as Mars data.
function container(overrides: Record<string, unknown> = {}) {
  const json = JSON.stringify({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }], images: [{ bufferView: 0, mimeType: 'image/png' }], ...overrides })
  const payload = new TextEncoder().encode(json.padEnd(Math.ceil(json.length / 4) * 4, ' '))
  const buffer = new ArrayBuffer(20 + payload.length + 12)
  const view = new DataView(buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, buffer.byteLength, true)
  view.setUint32(12, payload.length, true)
  view.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(buffer, 20, payload.length).set(payload)
  view.setUint32(20 + payload.length, 4, true)
  view.setUint32(24 + payload.length, 0x004e4942, true)
  return buffer
}

const signal = () => new AbortController().signal
const successful = (bytes: ArrayBuffer) => new Response(bytes, { headers: { 'content-type': 'model/gltf-binary' } })

describe('visual globe container boundary', () => {
  it('accepts a self-contained glTF 2 container', () => expect(() => validateGlobeContainer(container())).not.toThrow())
  it('rejects truncation and invalid container versions', () => {
    expect(() => validateGlobeContainer(container().slice(0, 30))).toThrow(/unsupported or incomplete/)
    const bytes = container()
    new DataView(bytes).setUint32(4, 1, true)
    expect(() => validateGlobeContainer(bytes)).toThrow(/unsupported or incomplete/)
  })
  it.each([
    { buffers: [{ uri: 'https://external.test/buffer.bin' }] },
    { images: [{ uri: 'https://external.test/texture.png' }] },
    { images: [] },
    { extensionsRequired: ['KHR_draco_mesh_compression'] },
  ])('rejects changed source dependencies: %j', (changed) => expect(() => validateGlobeContainer(container(changed))).toThrow())
})

describe('visual globe download failures', () => {
  it('requests the official source without credentials and reports actual received bytes', async () => {
    const bytes = container()
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(successful(bytes))
    const progress = vi.fn()
    const result = await fetchGlobeAsset(signal(), progress, { fetcher })
    expect(new Uint8Array(result)).toEqual(new Uint8Array(bytes))
    expect(fetcher).toHaveBeenCalledWith(MARS_GLOBE.assetUrl, expect.objectContaining({ mode: 'cors', credentials: 'omit', signal: expect.any(AbortSignal) }))
    expect(progress).toHaveBeenLastCalledWith(bytes.byteLength)
  })
  it.each([404, 503])('reports HTTP %i without presenting substitute imagery', async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }))
    await expect(fetchGlobeAsset(signal(), vi.fn(), { fetcher })).rejects.toThrow(`HTTP ${status}`)
  })
  it('rejects an HTTP 200 HTML error page', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>Error</html>', { headers: { 'content-type': 'text/html' } }))
    await expect(fetchGlobeAsset(signal(), vi.fn(), { fetcher })).rejects.toThrow(/unexpected file type/)
  })
  it('does not infer HTTP status from an opaque network/CORS failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(fetchGlobeAsset(signal(), vi.fn(), { fetcher })).rejects.toThrow(/network or CORS/)
  })
  it('aborts a hanging request at the deadline', async () => {
    const fetcher: typeof fetch = vi.fn((_, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    }))
    await expect(fetchGlobeAsset(signal(), vi.fn(), { fetcher, timeoutMs: 5 })).rejects.toThrow(/timed out/)
  })
  it('keeps the timeout active while consuming the response body', async () => {
    const fetcher: typeof fetch = vi.fn(async (_, init) => new Response(new ReadableStream({
      start(controller) { init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true }) },
    }), { headers: { 'content-type': 'model/gltf-binary' } }))
    await expect(fetchGlobeAsset(signal(), vi.fn(), { fetcher, timeoutMs: 5 })).rejects.toThrow(/timed out/)
  })
  it('cancels stale downloads when leaving the globe', async () => {
    const controller = new AbortController()
    const fetcher: typeof fetch = vi.fn((_, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    }))
    const result = fetchGlobeAsset(controller.signal, vi.fn(), { fetcher })
    controller.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  })
})
