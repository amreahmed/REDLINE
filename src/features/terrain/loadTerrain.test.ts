import { describe, expect, it, vi } from 'vitest'
import sourceWindows from '../../../public/data/jezero-terrain-windows.json'
import sourceText from '../../../public/data/jezero-terrain-windows.json?raw'
import { loadTerrainWindows, TERRAIN_WINDOWS_SHA256, TERRAIN_WINDOWS_URL } from './loadTerrain'
import { parseTerrainWindows, TERRAIN_SOURCE_ID } from './sampling'

const responseFetch = (response: Response) => vi.fn<typeof fetch>().mockResolvedValue(response)
const validResponse = () => new Response(sourceText, { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
const hangingFetch: typeof fetch = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
  init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
}))

describe('bounded terrain asset loading', () => {
  it('verifies exact real asset bytes, loads only the small local asset, and validates its numeric contract', async () => {
    const fetcher = responseFetch(validResponse())
    const data = await loadTerrainWindows(undefined, { fetcher })
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceText))
    expect(Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')).toBe(TERRAIN_WINDOWS_SHA256)
    expect(new TextEncoder().encode(sourceText)).toHaveLength(52_868)
    expect(sourceText.includes('\r')).toBe(false)
    expect(data.source.productId).toBe(TERRAIN_SOURCE_ID)
    expect(fetcher).toHaveBeenCalledWith(TERRAIN_WINDOWS_URL, { signal: expect.any(AbortSignal), credentials: 'omit' })
    expect(data.windows).toHaveLength(3)
  })

  it.each([404, 503])('rejects HTTP %s with an availability explanation', async (status) => {
    await expect(loadTerrainWindows(undefined, { fetcher: responseFetch(new Response('', { status })) })).rejects.toThrow(`HTTP ${status}`)
  })

  it('rejects network failure without supplying synthetic terrain', async () => {
    await expect(loadTerrainWindows(undefined, { fetcher: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')) })).rejects.toThrow(/network failure/)
  })

  it('rejects HTTP-200 HTML or corrupted JSON before parsing', async () => {
    await expect(loadTerrainWindows(undefined, { fetcher: responseFetch(new Response('<html/>', { headers: { 'Content-Type': 'text/html' } })) })).rejects.toThrow(/unexpected format/)
    await expect(loadTerrainWindows(undefined, { fetcher: responseFetch(new Response('{broken', { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/integrity check failed/)
  })

  it('rejects altered metadata and oversized asset content', async () => {
    await expect(loadTerrainWindows(undefined, { fetcher: responseFetch(new Response('{"schemaVersion":2}', { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/integrity check failed/)
    await expect(loadTerrainWindows(undefined, { fetcher: responseFetch(new Response(' '.repeat(200_001), { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/bounded-window size/)
  })

  it('rejects changed finite native values even when all self-declared source metadata remains valid', async () => {
    const modified = structuredClone(sourceWindows)
    modified.windows[0].values[0] = Math.fround(modified.windows[0].values[0] + 1)
    expect(() => parseTerrainWindows(modified)).not.toThrow()
    await expect(loadTerrainWindows(undefined, { fetcher: responseFetch(new Response(JSON.stringify(modified) + '\n', { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/integrity check failed/)
  })

  it('rejects corrupt UTF-8 bytes without decoding replacement characters', async () => {
    const corrupt = new TextEncoder().encode(sourceText)
    corrupt[10] = 0xff
    await expect(loadTerrainWindows(undefined, { fetcher: responseFetch(new Response(corrupt, { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/integrity check failed/)
  })

  it('fails closed when Web Crypto verification is unavailable or fails', async () => {
    vi.stubGlobal('crypto', undefined)
    try {
      await expect(loadTerrainWindows(undefined, { fetcher: responseFetch(validResponse()) })).rejects.toThrow(/verification is unavailable/)
    } finally { vi.unstubAllGlobals() }
    const digest = vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('Digest failed'))
    try {
      await expect(loadTerrainWindows(undefined, { fetcher: responseFetch(validResponse()) })).rejects.toThrow(/verification could not be completed/)
    } finally { digest.mockRestore() }
  })

  it('times out a stalled fetch', async () => {
    await expect(loadTerrainWindows(undefined, { fetcher: hangingFetch, timeoutMs: 5 })).rejects.toThrow(/timed out/)
  })

  it('preserves deliberate cancellation and avoids pre-aborted requests', async () => {
    const controller = new AbortController()
    const pending = loadTerrainWindows(controller.signal, { fetcher: hangingFetch })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    const fetcher = responseFetch(validResponse())
    await expect(loadTerrainWindows(controller.signal, { fetcher })).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('keeps timeout active while the response body is being read', async () => {
    const fetcher: typeof fetch = vi.fn(async (_url, init) => {
      const response = validResponse()
      response.arrayBuffer = () => new Promise<ArrayBuffer>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true }) })
      return response
    })
    await expect(loadTerrainWindows(undefined, { fetcher, timeoutMs: 5 })).rejects.toThrow(/timed out/)
  })

  it('preserves cancellation during body reading and explains a body network failure', async () => {
    const controller = new AbortController()
    const fetcher: typeof fetch = vi.fn(async (_url, init) => {
      const response = validResponse()
      response.arrayBuffer = () => new Promise<ArrayBuffer>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true }) })
      return response
    })
    const pending = loadTerrainWindows(controller.signal, { fetcher })
    await Promise.resolve()
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    const response = validResponse()
    response.arrayBuffer = async () => { throw new TypeError('Connection terminated during body') }
    await expect(loadTerrainWindows(undefined, { fetcher: responseFetch(response) })).rejects.toThrow(/network failure/)
  })
})
