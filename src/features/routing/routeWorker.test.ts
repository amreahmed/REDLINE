/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import sourceManifest from '../../../public/data/jezero-terrain-grid.json'
import { decodeTerrainGrid, parseTerrainGridManifest } from '../terrain/terrainGrid'
import type { RouteWorkerRequest, RouteWorkerResponse } from './types'

const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))).buffer
const grid = decodeTerrainGrid(parseTerrainGridManifest(sourceManifest), binary)
const request = { grid, origin: { row: 714, column: 650 }, destination: { row: 714, column: 651 }, waypoint: null }

async function bindWorker() {
  const worker = {
    onmessage: null as ((event: MessageEvent<RouteWorkerRequest>) => void) | null,
    postMessage: vi.fn<(message: RouteWorkerResponse) => void>(),
  }
  vi.stubGlobal('self', worker)
  vi.resetModules()
  await import('./routeWorker')
  if (!worker.onmessage) throw new Error('Worker did not register its message handler')
  return { worker, send: (data: unknown) => worker.onmessage!({ data } as MessageEvent<RouteWorkerRequest>) }
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe('distance-only route worker protocol', () => {
  it('returns a computed route with its original request identifier', async () => {
    const { worker, send } = await bindWorker()
    send({ requestId: 7, request })
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    expect(worker.postMessage.mock.calls[0][0]).toMatchObject({ requestId: 7, result: { status: 'available', value: { shortest: { model: 'hypothetical-distance-only', distanceM: expect.any(Number) }, via: null } } })
  })

  it('returns an unavailable result for malformed source input without throwing', async () => {
    const { worker, send } = await bindWorker()
    expect(() => send({ requestId: 9, request: null })).not.toThrow()
    expect(worker.postMessage.mock.calls[0][0]).toMatchObject({ requestId: 9, result: { status: 'unavailable', reason: expect.any(String) } })
  })

  it.each([null, { requestId: NaN, request }, { requestId: -2, request }])('reports invalid request envelopes %o explicitly', async data => {
    const { worker, send } = await bindWorker()
    expect(() => send(data)).not.toThrow()
    expect(worker.postMessage.mock.calls[0][0]).toMatchObject({ requestId: -1, result: { status: 'unavailable', reason: expect.stringMatching(/identifier/) } })
  })
})
