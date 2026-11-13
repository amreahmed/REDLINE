/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import sourceText from '../../../public/data/jezero-terrain-grid.json?raw'
import { loadTerrainGrid, TERRAIN_GRID_MANIFEST_BYTES, TERRAIN_GRID_MANIFEST_SHA256, TERRAIN_GRID_MANIFEST_URL } from './loadTerrainGrid'
import { getGridCell, TERRAIN_GRID_BINARY_BYTES, TERRAIN_GRID_BINARY_SHA256, TERRAIN_GRID_BINARY_URL } from './terrainGrid'

const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url)))
const manifestResponse = () => new Response(sourceText, { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
const binaryResponse = () => new Response(binary, { headers: { 'Content-Type': 'application/octet-stream' } })
const responses = (...values: Response[]) => {
  const fetcher = vi.fn<typeof fetch>()
  for (const value of values) fetcher.mockResolvedValueOnce(value)
  return fetcher
}
const hangingFetch: typeof fetch = (_url, init) => new Promise<Response>((_resolve, reject) => {
  init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
})
const streamingFetch: typeof fetch = async (_url, init) => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) { init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true }) },
  })
  return new Response(body, { headers: { 'Content-Type': 'application/json' } })
}
const hex = (digest: ArrayBuffer) => Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')

describe('bounded native-grid loading', () => {
  it('verifies canonical manifest and binary hashes before exposing real numeric samples', async () => {
    expect(new TextEncoder().encode(sourceText)).toHaveLength(TERRAIN_GRID_MANIFEST_BYTES)
    expect(sourceText.includes('\r')).toBe(false)
    expect(binary).toHaveLength(TERRAIN_GRID_BINARY_BYTES)
    expect(hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceText)))).toBe(TERRAIN_GRID_MANIFEST_SHA256)
    expect(hex(await crypto.subtle.digest('SHA-256', binary))).toBe(TERRAIN_GRID_BINARY_SHA256)
    const fetcher = responses(manifestResponse(), binaryResponse())
    const grid = await loadTerrainGrid(undefined, { fetcher })
    expect(fetcher).toHaveBeenNthCalledWith(1, TERRAIN_GRID_MANIFEST_URL, { signal: expect.any(AbortSignal), credentials: 'omit' })
    expect(fetcher).toHaveBeenNthCalledWith(2, TERRAIN_GRID_BINARY_URL, { signal: expect.any(AbortSignal), credentials: 'omit' })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(getGridCell(grid, 714, 650)).toMatchObject({ status: 'valid', cell: { elevationM: -2489.27978515625 } })
  })

  it.each([404, 503])('rejects manifest HTTP%s before fetching binary', async (status) => {
    const fetcher = responses(new Response('', { status }))
    await expect(loadTerrainGrid(undefined, { fetcher })).rejects.toThrow(`HTTP ${status}`)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects binary HTTP failure after verifying metadata', async () => {
    await expect(loadTerrainGrid(undefined, { fetcher: responses(manifestResponse(), new Response('', { status: 503 })) })).rejects.toThrow(/HTTP 503/)
  })

  it('rejects unexpected manifest or binary content types', async () => {
    await expect(loadTerrainGrid(undefined, { fetcher: responses(new Response('<html/>', { headers: { 'Content-Type': 'text/html' } })) })).rejects.toThrow(/unexpected format/)
    await expect(loadTerrainGrid(undefined, { fetcher: responses(manifestResponse(), new Response(binary, { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/unexpected format/)
  })

  it.each([undefined, ''])('accepts absent/empty binary MIME %s only after exact size and hash verification', async (contentType) => {
    const untypedBinary = new Response(binary, contentType === undefined ? undefined : { headers: { 'Content-Type': contentType } })
    expect(untypedBinary.headers.get('Content-Type')).toBe(contentType ?? null)
    const loaded = await loadTerrainGrid(undefined, { fetcher: responses(manifestResponse(), untypedBinary) })
    expect(loaded.values).toHaveLength(65536)
    expect(getGridCell(loaded, 714, 650)).toMatchObject({ status: 'valid', cell: { elevationM: -2489.27978515625 } })
  })

  it.each([undefined, ''])('rejects same-size altered bytes with absent/empty binary MIME %s', async (contentType) => {
    const altered = binary.slice()
    new DataView(altered.buffer).setFloat32(((700 - 586) * 256 + 700 - 522) * 4, -2500, true)
    const untypedBinary = new Response(altered, contentType === undefined ? undefined : { headers: { 'Content-Type': contentType } })
    expect(untypedBinary.headers.get('Content-Type')).toBe(contentType ?? null)
    await expect(loadTerrainGrid(undefined, { fetcher: responses(manifestResponse(), untypedBinary) })).rejects.toThrow(/integrity check failed/)
  })

  it.each([undefined, ''])('keeps manifest MIME strict for absent/empty header %s', async (contentType) => {
    const untypedManifest = new Response(new TextEncoder().encode(sourceText), contentType === undefined ? undefined : { headers: { 'Content-Type': contentType } })
    expect(untypedManifest.headers.get('Content-Type')).toBe(contentType ?? null)
    await expect(loadTerrainGrid(undefined, { fetcher: responses(untypedManifest) })).rejects.toThrow(/unexpected format/)
  })

  it('rejects altered metadata bytes before trusting the self-declared contract', async () => {
    const altered = sourceText.replace('"schemaVersion":1', '"schemaVersion":2')
    const fetcher = responses(new Response(altered, { headers: { 'Content-Type': 'application/json' } }))
    await expect(loadTerrainGrid(undefined, { fetcher })).rejects.toThrow(/integrity check failed/)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects same-size altered finite native samples even away from the independent fixtures', async () => {
    const altered = binary.slice()
    new DataView(altered.buffer).setFloat32(((700 - 586) * 256 + 700 - 522) * 4, -2500, true)
    await expect(loadTerrainGrid(undefined, { fetcher: responses(manifestResponse(), new Response(altered, { headers: { 'Content-Type': 'application/octet-stream' } })) })).rejects.toThrow(/integrity check failed/)
  })

  it('rejects corrupt UTF-8 before replacement-character decoding', async () => {
    const corrupt = new TextEncoder().encode(sourceText)
    corrupt[20] = 0xff
    await expect(loadTerrainGrid(undefined, { fetcher: responses(new Response(corrupt, { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/integrity check failed/)
  })

  it('fails closed when Web Crypto is unavailable or digesting fails', async () => {
    vi.stubGlobal('crypto', undefined)
    try { await expect(loadTerrainGrid(undefined, { fetcher: responses(manifestResponse()) })).rejects.toThrow(/verification is unavailable/) } finally { vi.unstubAllGlobals() }
    const digest = vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('Digest failed'))
    try { await expect(loadTerrainGrid(undefined, { fetcher: responses(manifestResponse()) })).rejects.toThrow(/could not be completed/) } finally { digest.mockRestore() }
  })

  it('rejects malformed JSON if the integrity layer is explicitly mocked in this test', async () => {
    const malformed = '['.repeat(TERRAIN_GRID_MANIFEST_BYTES)
    const expectedDigest = Uint8Array.from(TERRAIN_GRID_MANIFEST_SHA256.match(/../g) ?? [], (value) => parseInt(value, 16)).buffer
    const digest = vi.spyOn(crypto.subtle, 'digest').mockResolvedValueOnce(expectedDigest)
    try { await expect(loadTerrainGrid(undefined, { fetcher: responses(new Response(malformed, { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/not valid UTF-8 JSON/) } finally { digest.mockRestore() }
  })

  it.each([TERRAIN_GRID_MANIFEST_BYTES - 1, TERRAIN_GRID_MANIFEST_BYTES + 1])('rejects changed manifest byte length%s', async (length) => {
    await expect(loadTerrainGrid(undefined, { fetcher: responses(new Response(' '.repeat(length), { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/byte size/)
  })

  it('rejects truncated or oversized binary streams without using partial cells', async () => {
    await expect(loadTerrainGrid(undefined, { fetcher: responses(manifestResponse(), new Response(binary.slice(0, -4), { headers: { 'Content-Type': 'application/octet-stream' } })) })).rejects.toThrow(/truncated/)
    const oversize = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(binary); controller.enqueue(new Uint8Array(4)); controller.close() } })
    await expect(loadTerrainGrid(undefined, { fetcher: responses(manifestResponse(), new Response(oversize, { headers: { 'Content-Type': 'application/octet-stream' } })) })).rejects.toThrow(/exceeds/)
  })

  it('checks Content-Length before consuming an oversized response', async () => {
    const pull = vi.fn()
    const stream = new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 })
    const fetcher = responses(new Response(stream, { headers: { 'Content-Type': 'application/json', 'Content-Length': String(TERRAIN_GRID_MANIFEST_BYTES + 1) } }))
    await expect(loadTerrainGrid(undefined, { fetcher })).rejects.toThrow(/exceeds/)
    expect(pull).not.toHaveBeenCalled()
    await stream.cancel()
  })

  it('rejects an absent response body and reports network failures without substitute terrain', async () => {
    await expect(loadTerrainGrid(undefined, { fetcher: responses(new Response(null, { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/no readable/)
    await expect(loadTerrainGrid(undefined, { fetcher: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')) })).rejects.toThrow(/network failure/)
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new TypeError('Connection dropped')) } })
    await expect(loadTerrainGrid(undefined, { fetcher: responses(new Response(body, { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/network failure/)
  })

  it('keeps timeout active during fetching and streaming body reads', async () => {
    await expect(loadTerrainGrid(undefined, { fetcher: hangingFetch, timeoutMs: 5 })).rejects.toThrow(/timed out/)
    await expect(loadTerrainGrid(undefined, { fetcher: streamingFetch, timeoutMs: 5 })).rejects.toThrow(/timed out/)
  })

  it('preserves deliberate cancellation before requests and during fetch/body reads', async () => {
    const pre = new AbortController()
    pre.abort(new DOMException('Cancelled by user', 'AbortError'))
    const fetcher = responses(manifestResponse(), binaryResponse())
    await expect(loadTerrainGrid(pre.signal, { fetcher })).rejects.toMatchObject({ name: 'AbortError', message: 'Cancelled by user' })
    expect(fetcher).not.toHaveBeenCalled()
    for (const fetcher of [hangingFetch, streamingFetch]) {
      const controller = new AbortController()
      const pending = loadTerrainGrid(controller.signal, { fetcher })
      await Promise.resolve()
      controller.abort(new DOMException('Stopped', 'AbortError'))
      await expect(pending).rejects.toMatchObject({ name: 'AbortError', message: 'Stopped' })
    }
  })

  it('removes caller abort listeners and rejects invalid timeout configurations', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    await loadTerrainGrid(controller.signal, { fetcher: responses(manifestResponse(), binaryResponse()) })
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    for (const timeoutMs of [0, -1, NaN, Infinity]) await expect(loadTerrainGrid(undefined, { timeoutMs })).rejects.toThrow(/positive finite/)
  })
})
