/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import nativeManifest from '../../../public/data/hrsc-terrain-model.json'
import { decodeHrscModel, parseHrscModelManifest } from '../terrain/hrscModel'
import type { TerrainModelGrid, TerrainProfile } from '../terrain/modelTypes'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE } from '../terrain/terrainModel'
import { calculateTerrainComparison } from './terrainRoutes'
import type { TerrainComparison } from './terrainRoutes'
import { acceptTerrainWorkerResult, createTerrainRouteTask } from './terrainRouteTask'
import type { TerrainTaskRequest, TerrainWorkerResult } from './terrainRouteTask'
import type { RouteWorkerPort } from './routeTask'

function syntheticGrid(): TerrainModelGrid {
  return { rows: 7, columns: 7, startRow: 100, startColumn: 200,
    originXM: -35, originYM: 35, pixelWidthM: 10, pixelHeightM: -10, referenceRadiusM: 3396000,
    values: Float32Array.from({ length: 49 }, (_, node) => Math.floor(node / 7) * 0.2 + node % 7 * 0.3),
    valid: new Uint8Array(49).fill(1),
    source: { productId: 'synthetic-terrain-worker-test', gridHash: 'test', sourceHash: 'test',
      verticalReference: 'Synthetic sphere-relative metres', attribution: 'Synthetic fixture', qualification: 'Synthetic, not Mars data', authorization: 'synthetic-test' } }
}
const profile: TerrainProfile = { ...DEFAULT_TERRAIN_PROFILE, maxUphillDeg: 45, maxDownhillDeg: 45, maxRoughnessM: 100, roughnessRadiusM: 11 }
const request: TerrainTaskRequest = { grid: syntheticGrid(), profile, origin: 22, destination: 26, waypoint: null }
const actualRequest: TerrainTaskRequest = {
  grid: decodeHrscModel(parseHrscModelManifest(nativeManifest),
    Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.i16', import.meta.url))).buffer,
    Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.u8', import.meta.url))).buffer),
  profile: DEFAULT_TERRAIN_PROFILE, origin: 30 * 103 + 30, destination: 70 * 103 + 70, waypoint: null,
}
function computed(input = request): TerrainWorkerResult {
  const analysis = analyzeTerrainModel(input.grid, input.profile)
  const routes = calculateTerrainComparison(analysis, input.origin, input.destination, input.waypoint)
  if (routes.status !== 'available') throw new Error(`Test scenario unavailable: ${routes.reason}`)
  return { analysis, routes }
}
const original = computed()
function value(output: TerrainWorkerResult): TerrainComparison {
  if (output.routes.status !== 'available') throw new Error(output.routes.reason)
  return output.routes.value
}
function changedRoute(output: TerrainWorkerResult, patch: Record<string, unknown>, role: 'distance' | 'terrain' = 'terrain'): unknown {
  const comparison = value(output)
  return { ...output, routes: { status: 'available', value: { ...comparison, [role]: { ...comparison[role], ...patch } } } }
}
class WorkerDouble extends EventTarget {
  postMessage = vi.fn()
  terminate = vi.fn()
  respond(result: unknown, requestId: unknown = 1) { this.dispatchEvent(new MessageEvent('message', { data: { requestId, result } })) }
}
const taskFor = (worker: WorkerDouble, timeoutMs?: number) => createTerrainRouteTask(request, () => worker as RouteWorkerPort, timeoutMs)
afterEach(() => vi.useRealTimers())

describe('DEM worker result authorization boundary', () => {
  it('accepts actual HRSC analysis and both native-grid paths, retaining unverified physical status', () => {
    const output = computed(actualRequest)
    const accepted = acceptTerrainWorkerResult(output, actualRequest)
    expect(accepted?.status).toBe('available')
    if (accepted?.status !== 'available') throw new Error('Real HRSC result rejected')
    expect(accepted.analysis).not.toBe(output.analysis)
    expect(accepted.analysis.grid).toBe(actualRequest.grid)
    expect(accepted.analysis.slopeDeg).not.toBe(output.analysis.slopeDeg)
    expect(accepted.comparison).toEqual(value(output))
    expect(accepted.comparison.terrain.source.authorization).toBe('provider-dem-model')
    expect(accepted.comparison.terrain.scientificStatus).toBe('physical-terrain-unverified')
    expect(actualRequest.grid.values).toHaveLength(10609)
    expect(actualRequest.grid.valid.every(cell => cell === 1)).toBe(true)
  })

  it.each(['slopeDeg', 'roughnessM', 'reliefM', 'shapeM', 'states'] as const)('rejects corrupted %s rather than displaying supplied derivatives', key => {
    const output = structuredClone(original)
    output.analysis[key][24] += 1
    expect(acceptTerrainWorkerResult(output, request)).toBeNull()
  })

  it('rejects truncated and incorrectly typed derivative rasters', () => {
    for (const changed of [new Float32Array(1), new Float64Array(49), new Uint8Array(49)]) {
      expect(acceptTerrainWorkerResult({ ...original, analysis: { ...original.analysis, slopeDeg: changed } }, request)).toBeNull()
    }
    expect(acceptTerrainWorkerResult({ ...original, analysis: { ...original.analysis, states: new Float32Array(original.analysis.states) } }, request)).toBeNull()
  })

  it('rejects worker derivatives computed for different profile or source assumptions', () => {
    expect(acceptTerrainWorkerResult({ ...original, analysis: { ...original.analysis, profile: { ...profile, roughnessRadiusM: 21 } } }, request)).toBeNull()
    expect(acceptTerrainWorkerResult({ ...original, analysis: { ...original.analysis, grid: { ...request.grid, source: { ...request.grid.source, sourceHash: 'other-source' } } } }, request)).toBeNull()
    const unsupported = { ...actualRequest, grid: { ...actualRequest.grid, source: { ...actualRequest.grid.source, productId: 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0' } } }
    expect(acceptTerrainWorkerResult(computed(actualRequest), unsupported)).toBeNull()
  })

  it.each([
    ['id', 'distance'], ['model', 'hypothetical-distance-only'], ['costUnit', 'joules'],
    ['scientificStatus', 'verified'], ['horizontalDistanceM', NaN], ['accumulatedCostM', Infinity],
    ['accumulatedCostM', -1], ['unknownSegments', 1], ['maxGradeDeg', null], ['meanAbsGradeDeg', null],
    ['maxRoughnessM', null], ['meanRoughnessM', null], ['maxSlopeDeg', null], ['meanSlopeDeg', null],
  ])('rejects corrupt route %s=%s', (key, replacement) => {
    expect(acceptTerrainWorkerResult(changedRoute(original, { [key]: replacement }), request)).toBeNull()
  })

  it.each(['horizontalDistanceM', 'accumulatedCostM', 'maxGradeDeg', 'meanAbsGradeDeg', 'maxSlopeDeg', 'meanSlopeDeg', 'maxRoughnessM', 'meanRoughnessM', 'blockedSearchCells', 'unknownSearchCells'] as const)('reproduces %s from local source and path rather than trusting totals', key => {
    const route = value(original).terrain
    expect(acceptTerrainWorkerResult(changedRoute(original, { [key]: route[key]! + 1 }), request)).toBeNull()
  })

  it('rejects incorrect route provenance and misleading qualification text', () => {
    const route = value(original).terrain
    expect(acceptTerrainWorkerResult(changedRoute(original, { source: { ...route.source, gridHash: 'other-grid' } }), request)).toBeNull()
    expect(acceptTerrainWorkerResult(changedRoute(original, { qualification: 'Scientifically validated terrain; safe for humans.' }), request)).toBeNull()
    expect(acceptTerrainWorkerResult(changedRoute(original, { source: { ...route.source, physicalSlopeVerified: true } }), request)).toBeNull()
    expect(acceptTerrainWorkerResult(changedRoute(original, { profile: { ...route.profile, certifiedRoverSafety: true } }), request)).toBeNull()
  })

  it('rejects injected scientific claims at the comparison level before report export', () => {
    expect(acceptTerrainWorkerResult({ ...original, routes: { status: 'available', value: { ...value(original), verifiedSurvivalProbability: 1 } } }, request)).toBeNull()
  })

  it('rejects incorrect centers, skipped cells, duplicate cells and wrong endpoints', () => {
    const route = value(original).terrain
    const modifiedPoints = route.points.map((point, index) => index === 1 ? { ...point, lon: point.lon + 0.0001 } : point)
    for (const patch of [
      { points: modifiedPoints },
      { nodes: [route.nodes[0], route.nodes.at(-1)], points: [route.points[0], route.points.at(-1)] },
      { nodes: [route.nodes[0], ...route.nodes], points: [route.points[0], ...route.points] },
      { nodes: route.nodes.slice(1), points: route.points.slice(1) },
      { nodes: [...route.nodes, 49], points: [...route.points, route.points.at(-1)] },
    ]) expect(acceptTerrainWorkerResult(changedRoute(original, patch), request)).toBeNull()
  })

  it('rejects invalid expanded-cell lists rather than fabricating search overlays', () => {
    const route = value(original).terrain
    for (const exploredNodes of [
      [...route.exploredNodes, route.exploredNodes[0]],
      [...route.exploredNodes, 49],
      [...route.exploredNodes, 1.5],
      route.exploredNodes.filter(node => node !== request.origin),
    ]) expect(acceptTerrainWorkerResult(changedRoute(original, { exploredNodes }), request)).toBeNull()
  })

  it('rechecks current source support and refuses a previously valid route through changed missing terrain', () => {
    const changedGrid = { ...request.grid, values: request.grid.values.slice(), valid: request.grid.valid.slice() }
    changedGrid.valid[24] = 0
    changedGrid.values[24] = NaN
    expect(acceptTerrainWorkerResult(original, { ...request, grid: changedGrid })).toBeNull()
  })

  it('preserves the required waypoint and rejects its omission or substitution', () => {
    const viaRequest = { ...request, waypoint: 17 }
    const viaOutput = computed(viaRequest)
    expect(acceptTerrainWorkerResult(viaOutput, viaRequest)?.status).toBe('available')
    expect(acceptTerrainWorkerResult(original, viaRequest)).toBeNull()
    const routes = value(viaOutput)
    expect(acceptTerrainWorkerResult({ ...viaOutput, routes: { status: 'available', value: { ...routes, waypoint: 18 } } }, viaRequest)).toBeNull()
  })

  it('retains unknown-support null statistics and rejects fabricated known grades or roughness', () => {
    const unknownRequest = { ...request, profile: { ...profile, unknownPolicy: 'penalize' as const, unknownCostMultiplier: 3 }, origin: 0, destination: 2 }
    const output = computed(unknownRequest)
    const accepted = acceptTerrainWorkerResult(output, unknownRequest)
    expect(accepted?.status).toBe('available')
    const route = value(output).terrain
    expect(route.unknownSegments).toBeGreaterThan(0)
    expect(route.maxGradeDeg).toBeNull()
    expect(route.meanAbsGradeDeg).toBeNull()
    expect(route.maxSlopeDeg).toBeNull()
    expect(route.meanSlopeDeg).toBeNull()
    expect(route.maxRoughnessM).toBeNull()
    expect(route.meanRoughnessM).toBeNull()
    for (const key of ['maxGradeDeg', 'meanAbsGradeDeg', 'maxSlopeDeg', 'meanSlopeDeg', 'maxRoughnessM', 'meanRoughnessM'] as const) expect(acceptTerrainWorkerResult(changedRoute(output, { [key]: 0 }), unknownRequest)).toBeNull()
    expect(acceptTerrainWorkerResult(changedRoute(output, { unknownSegments: 0 }), unknownRequest)).toBeNull()
    expect(acceptTerrainWorkerResult(changedRoute(output, { accumulatedCostM: route.horizontalDistanceM }), unknownRequest)).toBeNull()
  })

  it('accepts a clear unavailable reason but rejects malformed result envelopes', () => {
    expect(acceptTerrainWorkerResult({ analysis: null, routes: { status: 'unavailable', reason: 'Selected native endpoint is blocked.' } }, request)).toEqual({ status: 'unavailable', reason: 'Selected native endpoint is blocked.' })
    for (const payload of [null, [], {}, { analysis: null }, { analysis: null, routes: { status: 'unavailable', reason: '' } }, { analysis: null, routes: { status: 'unavailable', reason: 0 } }, { analysis: null, routes: { status: 'available', value: null } }]) expect(acceptTerrainWorkerResult(payload, request)).toBeNull()
  })
})

describe('owned DEM worker lifecycle', () => {
  it('settles a validated result, keeps source buffers attached and removes all listeners', async () => {
    const worker = new WorkerDouble()
    const remove = vi.spyOn(worker, 'removeEventListener')
    const task = taskFor(worker)
    worker.respond(original)
    expect((await task.result).status).toBe('available')
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ requestId: 1, request })
    expect(worker.postMessage.mock.calls[0]).toHaveLength(1)
    expect(request.grid.values.byteLength).toBe(49 * 4)
    expect(request.grid.valid.byteLength).toBe(49)
    expect(worker.terminate).toHaveBeenCalledOnce()
    for (const event of ['message', 'error', 'messageerror']) expect(remove).toHaveBeenCalledWith(event, expect.any(Function))
  })

  it('settles worker construction and serialization failures with retry guidance', async () => {
    expect(await createTerrainRouteTask(request, () => { throw new Error('Test startup failure') }).result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/could not start.*Retry/) })
    const worker = new WorkerDouble()
    worker.postMessage.mockImplementation(() => { throw new Error('Test clone failure') })
    expect(await taskFor(worker).result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/failed.*Retry/) })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it.each(['error', 'messageerror'])('settles %s exactly once and ignores late output', async event => {
    const worker = new WorkerDouble()
    const task = taskFor(worker)
    worker.dispatchEvent(new Event(event))
    worker.respond(original)
    task.cancel()
    expect(await task.result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/failed.*Retry/) })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('ignores stale/malformed IDs and accepts only its own complete response', async () => {
    const worker = new WorkerDouble()
    const task = taskFor(worker)
    for (const id of [2, -1, NaN, '1', null]) worker.respond({ analysis: null, routes: { status: 'unavailable', reason: 'Stale response' } }, id)
    worker.dispatchEvent(new MessageEvent('message', { data: { requestId: 1 } }))
    worker.dispatchEvent(new MessageEvent('message', { data: null }))
    expect(worker.terminate).not.toHaveBeenCalled()
    worker.respond(original)
    expect((await task.result).status).toBe('available')
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('rejects invalid worker data rather than displaying an available route', async () => {
    const worker = new WorkerDouble()
    const task = taskFor(worker)
    worker.respond(changedRoute(original, { accumulatedCostM: -1 }))
    expect(await task.result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/invalid result/) })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('terminates at timeout, clears timers and ignores late results', async () => {
    vi.useFakeTimers()
    const worker = new WorkerDouble()
    const task = taskFor(worker, 100)
    worker.respond(original, 2)
    vi.advanceTimersByTime(99)
    expect(worker.terminate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    worker.respond(original)
    expect(await task.result).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/timed out/) })
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels immediately, settles once and cannot revive a cancelled calculation', async () => {
    vi.useFakeTimers()
    const worker = new WorkerDouble()
    const task = taskFor(worker)
    task.cancel()
    task.cancel()
    worker.respond(original)
    expect(await task.result).toEqual({ status: 'unavailable', reason: 'DEM model calculation cancelled.' })
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('isolates a cancelled worker from the next task even when both envelope IDs are one', async () => {
    const firstWorker = new WorkerDouble()
    const first = taskFor(firstWorker)
    first.cancel()
    const nextWorker = new WorkerDouble()
    const next = taskFor(nextWorker)
    firstWorker.respond(original)
    expect(nextWorker.terminate).not.toHaveBeenCalled()
    nextWorker.respond(original)
    expect((await first.result).status).toBe('unavailable')
    expect((await next.result).status).toBe('available')
    expect(firstWorker.terminate).toHaveBeenCalledOnce()
    expect(nextWorker.terminate).toHaveBeenCalledOnce()
  })
})
