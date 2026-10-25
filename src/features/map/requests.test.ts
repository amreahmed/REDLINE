import { describe, expect, it, vi } from 'vitest'
import { requestTile, requestXml } from './requests'

const signal = () => new AbortController().signal
const responseFetch = (response: Response) => vi.fn<typeof fetch>().mockResolvedValue(response)

describe('data request classification', () => {
  it('reads successful metadata and image responses', async () => {
    await expect(requestXml('https://example.test/capabilities', signal(), { fetcher: responseFetch(new Response('<Capabilities/>', { headers: { 'Content-Type': 'text/xml' } })) })).resolves.toBe('<Capabilities/>')
    const blob = await requestTile('https://example.test/tile', 'image/png', signal(), { fetcher: responseFetch(new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/png' } })) })
    expect(blob.size).toBe(2)
  })
  it('classifies an observable 404 as missing, not a valid image', async () => {
    await expect(requestTile('https://example.test/tile', 'image/png', signal(), { fetcher: responseFetch(new Response('', { status: 404 })) })).rejects.toMatchObject({ kind: 'missing' })
  })
  it('keeps server failure distinct from missing coverage', async () => {
    await expect(requestTile('https://example.test/tile', 'image/png', signal(), { fetcher: responseFetch(new Response('', { status: 503 })) })).rejects.toMatchObject({ kind: 'http' })
  })
  it('does not guess a 404 when CORS or networking hides the response', async () => {
    await expect(requestTile('https://example.test/tile', 'image/png', signal(), { fetcher: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')) })).rejects.toMatchObject({ kind: 'network' })
  })
  it('rejects HTML returned with HTTP 200 in place of imagery', async () => {
    await expect(requestTile('https://example.test/tile', 'image/png', signal(), { fetcher: responseFetch(new Response('<html/>', { headers: { 'Content-Type': 'text/html' } })) })).rejects.toMatchObject({ kind: 'content' })
  })
  const hangingFetch: typeof fetch = vi.fn((_, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
  }))
  it('times out a hanging request', async () => {
    await expect(requestXml('https://example.test/slow', signal(), { fetcher: hangingFetch, timeoutMs: 5 })).rejects.toMatchObject({ kind: 'timeout' })
  })
  it('preserves deliberate cancellation', async () => {
    const controller = new AbortController()
    const request = requestXml('https://example.test/slow', controller.signal, { fetcher: hangingFetch })
    controller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })
})
