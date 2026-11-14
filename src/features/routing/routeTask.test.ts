/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from '../../../public/data/jezero-terrain-grid.json'
import { decodeTerrainGrid, parseTerrainGridManifest } from '../terrain/terrainGrid'
import { calculateDistanceRoutes } from './distanceRoutes'
import { createRouteTask } from './routeTask'
import type { RouteWorkerPort } from './routeTask'
import type { RouteRequest } from './types'

const grid = decodeTerrainGrid(parseTerrainGridManifest(manifest), Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))).buffer)
const request: RouteRequest = { grid, origin: { row: 714, column: 650 }, destination: { row: 714, column: 651 }, waypoint: null }
class WorkerDouble extends EventTarget {
  postMessage = vi.fn()
  terminate = vi.fn()
  respond(result: unknown, requestId = 1) { this.dispatchEvent(new MessageEvent('message', { data: { requestId, result } })) }
}
const taskFor = (worker: WorkerDouble, timeoutMs?: number) => createRouteTask(request, () => worker as RouteWorkerPort, timeoutMs)
afterEach(() => vi.useRealTimers())

describe('owned route worker lifecycle', () => {
  it('returns a validated result and never transfers/detaches the native terrain buffer', async () => {
    const worker = new WorkerDouble()
    const task = taskFor(worker)
    const computed = calculateDistanceRoutes(request)
    worker.respond(computed)
    expect(await task.result).toEqual(computed)
    expect(worker.postMessage).toHaveBeenCalledWith({ requestId: 1, request })
    expect(worker.postMessage.mock.calls[0]).toHaveLength(1)
    expect(grid.values.byteLength).toBe(262144)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('cancellation settles once and late results cannot revive an old task', async () => {
    const worker = new WorkerDouble()
    const task = taskFor(worker)
    task.cancel()
    worker.respond(calculateDistanceRoutes(request))
    expect(await task.result).toEqual({ status: 'unavailable', reason: 'Route calculation cancelled.' })
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('ignores responses for another request and terminates on timeout', async () => {
    vi.useFakeTimers()
    const worker = new WorkerDouble()
    const task = taskFor(worker, 100)
    worker.respond({ status: 'unavailable', reason: 'Other request fixture' }, 2)
    vi.advanceTimersByTime(100)
    expect(await task.result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/timed out/) })
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it.each(['error', 'messageerror'])('settles a %s event with retry guidance', async event => {
    const worker = new WorkerDouble()
    const task = taskFor(worker)
    worker.dispatchEvent(new Event(event))
    expect(await task.result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/failed.*Retry/) })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('handles worker construction and postMessage failures', async () => {
    expect(await createRouteTask(request, () => { throw new Error('Test-only construction failure') }).result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/could not start/) })
    const worker = new WorkerDouble()
    worker.postMessage.mockImplementation(() => { throw new Error('Test-only serialization failure') })
    expect(await taskFor(worker).result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/failed/) })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('rejects malformed available results instead of letting the UI consume them', async () => {
    const worker = new WorkerDouble()
    const task = taskFor(worker)
    worker.respond({ status: 'available', value: { shortest: null, via: null } })
    expect(await task.result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/invalid result/) })
  })
  it('rejects mismatched provenance and route coordinates', async () => {
    const computed = calculateDistanceRoutes(request)
    if (computed.status !== 'available') throw new Error(computed.reason)
    for (const route of [
      { ...computed.value.shortest, sourceHash: 'wrong-source-test-fixture' },
      { ...computed.value.shortest, distanceM: NaN },
      { ...computed.value.shortest, points: computed.value.shortest.points.map(point => ({ ...point, lon: 0 })) },
    ]) {
      const worker = new WorkerDouble()
      const task = taskFor(worker)
      worker.respond({ status: 'available', value: { shortest: route, via: null } })
      expect(await task.result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/invalid result/) })
    }
  })
  it('rejects disconnected geometry, repeated centers and a metric inconsistent with its path', async () => {
    const distantRequest: RouteRequest = { ...request, destination: { row: 714, column: 653 } }
    const computed = calculateDistanceRoutes(distantRequest)
    if (computed.status !== 'available') throw new Error(computed.reason)
    const original = computed.value.shortest
    for (const route of [
      { ...original, points: [original.points[0], original.points.at(-1)!] },
      { ...original, points: [original.points[0], ...original.points] },
      { ...original, distanceM: original.distanceM + 1 },
    ]) {
      const worker = new WorkerDouble()
      const task = createRouteTask(distantRequest, () => worker as RouteWorkerPort)
      worker.respond({ status: 'available', value: { shortest: route, via: null } })
      expect(await task.result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/invalid result/) })
    }
  })
  it('rejects a diagonal whose current grid has a missing flank', async () => {
    const diagonalRequest: RouteRequest = { ...request, destination: { row: 715, column: 651 } }
    const computed = calculateDistanceRoutes(diagonalRequest)
    const values = grid.values.slice()
    values[(714 - 586) * 256 + 651 - 522] = NaN
    const worker = new WorkerDouble()
    const task = createRouteTask({ ...diagonalRequest, grid: { manifest: grid.manifest, values } }, () => worker as RouteWorkerPort)
    worker.respond(computed)
    expect(await task.result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/invalid result/) })
  })
  it('accepts the independently reproduced distance of both waypoint legs', async () => {
    const waypointRequest: RouteRequest = { ...request, waypoint: { row: 740, column: 700 } }
    const computed = calculateDistanceRoutes(waypointRequest)
    expect(computed.status).toBe('available')
    const worker = new WorkerDouble()
    const task = createRouteTask(waypointRequest, () => worker as RouteWorkerPort)
    worker.respond(computed)
    expect(await task.result).toEqual(computed)
  })
})
