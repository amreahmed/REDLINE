/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import manifestText from '../../../public/data/hrsc-terrain-model.json?raw'
import {
  HRSC_MODEL_BINARY_BYTES, HRSC_MODEL_BINARY_SHA256, HRSC_MODEL_BINARY_URL,
  HRSC_MODEL_MANIFEST_BYTES, HRSC_MODEL_MANIFEST_SHA256, HRSC_MODEL_MANIFEST_URL,
  HRSC_MODEL_VALIDITY_SHA256, HRSC_MODEL_VALIDITY_URL,
} from './hrscModel'
import { loadHrscModel } from './loadHrscModel'

const samples = Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.i16', import.meta.url)))
const validity = Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.u8', import.meta.url)))
const json = () => new Response(manifestText, { headers: { 'Content-Type': 'application/json' } })
const binary = (bytes: Uint8Array<ArrayBuffer> = samples) => new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })
const responses = (...items: Response[]) => {
  const fetcher = vi.fn<typeof fetch>()
  for (const item of items) fetcher.mockResolvedValueOnce(item)
  return fetcher
}
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('')

describe('integrity-checked HRSC model loading', () => {
  it('pins metadata, source samples and masks before exposing a provider DEM model', async () => {
    const manifestBytes = new TextEncoder().encode(manifestText)
    expect(manifestBytes).toHaveLength(HRSC_MODEL_MANIFEST_BYTES)
    expect(samples).toHaveLength(HRSC_MODEL_BINARY_BYTES)
    expect(hex(await crypto.subtle.digest('SHA-256', manifestBytes))).toBe(HRSC_MODEL_MANIFEST_SHA256)
    expect(hex(await crypto.subtle.digest('SHA-256', samples))).toBe(HRSC_MODEL_BINARY_SHA256)
    expect(hex(await crypto.subtle.digest('SHA-256', validity))).toBe(HRSC_MODEL_VALIDITY_SHA256)
    const fetcher = responses(json(), binary(), binary(validity))
    const grid = await loadHrscModel({ fetcher })
    expect(fetcher).toHaveBeenNthCalledWith(1, HRSC_MODEL_MANIFEST_URL, { signal: expect.any(AbortSignal), credentials: 'omit' })
    expect(fetcher).toHaveBeenNthCalledWith(2, HRSC_MODEL_BINARY_URL, { signal: expect.any(AbortSignal), credentials: 'omit' })
    expect(fetcher).toHaveBeenNthCalledWith(3, HRSC_MODEL_VALIDITY_URL, { signal: expect.any(AbortSignal), credentials: 'omit' })
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(grid.values).toHaveLength(10609)
    expect(grid.values[51 * 103 + 51]).toBe(-3921)
    expect(grid.source.authorization).toBe('provider-dem-model')
  })

  it.each([404, 503])('rejects HTTP %s without substitute terrain', async status => {
    const fetcher = responses(new Response('', { status }))
    await expect(loadHrscModel({ fetcher })).rejects.toThrow(`HTTP ${status}`)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects binary or mask failure after manifest validation', async () => {
    await expect(loadHrscModel({ fetcher: responses(json(), new Response('', { status: 503 }), binary(validity)) })).rejects.toThrow('HTTP 503')
    await expect(loadHrscModel({ fetcher: responses(json(), binary(), new Response('', { status: 404 })) })).rejects.toThrow('HTTP 404')
  })

  it('keeps JSON format strict and rejects HTML disguised as native assets', async () => {
    await expect(loadHrscModel({ fetcher: responses(new Response(manifestText)) })).rejects.toThrow(/unexpected format/)
    await expect(loadHrscModel({ fetcher: responses(json(), new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }), binary(validity)) })).rejects.toThrow(/unexpected format/)
    const grid = await loadHrscModel({ fetcher: responses(json(), new Response(samples), new Response(validity)) })
    expect(grid.values).toHaveLength(10609)
  })

  it('rejects same-size altered manifest bytes before binary requests', async () => {
    const changed = manifestText.replace('Physical slope accuracy', 'Verified slope accuracy')
    expect(changed.length).toBe(manifestText.length)
    const fetcher = responses(new Response(changed, { headers: { 'Content-Type': 'application/json' } }))
    await expect(loadHrscModel({ fetcher })).rejects.toThrow(/integrity check failed/)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects same-size altered native samples and masks', async () => {
    const changedSamples = samples.slice()
    changedSamples[1234] ^= 1
    await expect(loadHrscModel({ fetcher: responses(json(), binary(changedSamples), binary(validity)) })).rejects.toThrow(/integrity check failed/)
    const changedValidity = validity.slice()
    changedValidity[111] = 0
    await expect(loadHrscModel({ fetcher: responses(json(), binary(), binary(changedValidity)) })).rejects.toThrow(/integrity check failed/)
  })

  it('rejects truncated and oversized data streams before exposing partial cells', async () => {
    await expect(loadHrscModel({ fetcher: responses(json(), binary(samples.slice(0, -2)), binary(validity)) })).rejects.toThrow(/truncated/)
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(samples); controller.enqueue(new Uint8Array(1)); controller.close() } })
    await expect(loadHrscModel({ fetcher: responses(json(), new Response(stream), binary(validity)) })).rejects.toThrow(/exceeds/)
    await expect(loadHrscModel({ fetcher: responses(json(), binary(), binary(validity.slice(0, -1))) })).rejects.toThrow(/truncated/)
  })

  it('rejects oversized advertised responses before body consumption', async () => {
    const pull = vi.fn()
    const stream = new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 })
    await expect(loadHrscModel({ fetcher: responses(new Response(stream, { headers: { 'Content-Type': 'application/json', 'Content-Length': String(HRSC_MODEL_MANIFEST_BYTES + 1) } })) })).rejects.toThrow(/exceeds/)
    expect(pull).not.toHaveBeenCalled()
    await stream.cancel()
  })

  it('fails closed without Web Crypto or after digest failure', async () => {
    vi.stubGlobal('crypto', undefined)
    try { await expect(loadHrscModel({ fetcher: responses(json()) })).rejects.toThrow(/verification is unavailable/) } finally { vi.unstubAllGlobals() }
    const digest = vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('Unavailable'))
    try { await expect(loadHrscModel({ fetcher: responses(json()) })).rejects.toThrow(/could not be completed/) } finally { digest.mockRestore() }
  })

  it('rejects malformed JSON when the checksum is explicitly mocked for this test', async () => {
    const digest = vi.spyOn(crypto.subtle, 'digest').mockResolvedValueOnce(Uint8Array.from(HRSC_MODEL_MANIFEST_SHA256.match(/../g) ?? [], value => parseInt(value, 16)).buffer)
    try { await expect(loadHrscModel({ fetcher: responses(new Response('['.repeat(HRSC_MODEL_MANIFEST_BYTES), { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/valid UTF-8 JSON/) } finally { digest.mockRestore() }
  })

  it('reports missing bodies and network failures with no fallback', async () => {
    await expect(loadHrscModel({ fetcher: responses(new Response(null, { headers: { 'Content-Type': 'application/json' } })) })).rejects.toThrow(/no readable/)
    await expect(loadHrscModel({ fetcher: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')) })).rejects.toThrow(/network failure/)
  })

  it('keeps timeout active during fetch and an otherwise hanging body read', async () => {
    const hangingFetch: typeof fetch = (_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true }))
    await expect(loadHrscModel({ fetcher: hangingFetch, timeoutMs: 5 })).rejects.toThrow(/timed out/)
    const stream = new ReadableStream<Uint8Array>({ start() { /* no chunks: loader must cancel its own reader */ } })
    await expect(loadHrscModel({ fetcher: responses(new Response(stream, { headers: { 'Content-Type': 'application/json' } })), timeoutMs: 5 })).rejects.toThrow(/timed out/)
  })

  it('preserves caller cancellation and releases its listener', async () => {
    const pre = new AbortController()
    pre.abort(new DOMException('Stopped', 'AbortError'))
    const fetcher = responses(json(), binary(), binary(validity))
    await expect(loadHrscModel({ signal: pre.signal, fetcher })).rejects.toMatchObject({ name: 'AbortError', message: 'Stopped' })
    expect(fetcher).not.toHaveBeenCalled()
    const controller = new AbortController()
    const stream = new ReadableStream<Uint8Array>({ start() { /* pending body */ } })
    const pending = loadHrscModel({ signal: controller.signal, fetcher: responses(new Response(stream, { headers: { 'Content-Type': 'application/json' } })) })
    await Promise.resolve()
    controller.abort(new DOMException('Cancelled', 'AbortError'))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError', message: 'Cancelled' })
    const completed = new AbortController()
    const remove = vi.spyOn(completed.signal, 'removeEventListener')
    await loadHrscModel({ signal: completed.signal, fetcher: responses(json(), binary(), binary(validity)) })
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it.each([0, -1, NaN, Infinity])('rejects invalid timeout %s', async timeoutMs => {
    await expect(loadHrscModel({ timeoutMs })).rejects.toThrow(/positive finite/)
  })
})
