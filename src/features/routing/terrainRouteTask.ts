import type { TerrainAnalysis, TerrainModelGrid, TerrainProfile } from '../terrain/modelTypes'
import { analyzeTerrainModel, modelPoint, terrainMovement } from '../terrain/terrainModel'
import type { TerrainComparison, TerrainComparisonResult, TerrainModelRoute } from './terrainRoutes'
import type { RouteWorkerPort } from './routeTask'

export type TerrainTaskRequest = { readonly grid: TerrainModelGrid; readonly profile: TerrainProfile; readonly origin: number; readonly destination: number; readonly waypoint: number | null }
export type TerrainTaskResult = { readonly status: 'available'; readonly analysis: TerrainAnalysis; readonly comparison: TerrainComparison } | { readonly status: 'unavailable'; readonly reason: string }
export type TerrainWorkerResult = { readonly analysis: TerrainAnalysis; readonly routes: TerrainComparisonResult }

const close = (actual: unknown, expected: number) => typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(1e-6, Math.abs(expected) * 1e-9)
const sameObject = (actual: unknown, expected: object) => !!actual && typeof actual === 'object' && Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) => (actual as Record<string, unknown>)[key] === value)

/** Validate numerical arrays and every returned edge before displaying worker output. */
export function acceptTerrainWorkerResult(input: unknown, request: TerrainTaskRequest): TerrainTaskResult | null {
  if (!input || typeof input !== 'object' || !('analysis' in input) || !('routes' in input)) return null
  const output = input as TerrainWorkerResult
  if (output.routes?.status === 'unavailable') return typeof output.routes.reason === 'string' && output.routes.reason.length > 0 ? output.routes : null
  if (output.routes?.status !== 'available' || !output.analysis || !output.routes.value) return null
  try {
    // Recompute native derivatives independently of the supplied arrays. The
    // search stays in the worker; accepted render data uses this local source.
    const analysis = analyzeTerrainModel(request.grid, request.profile)
    if (!sameObject(output.analysis.profile, request.profile) || !sameObject(output.analysis.grid.source, request.grid.source)) return null
    for (const key of ['slopeDeg', 'roughnessM', 'reliefM', 'shapeM', 'states'] as const) {
      const supplied = output.analysis[key], expected = analysis[key]
      if (!(supplied instanceof expected.constructor) || supplied.length !== expected.length) return null
      for (let node = 0; node < expected.length; node++) if (!Object.is(supplied[node], expected[node])) return null
    }
    const comparison = output.routes.value
    if (Object.keys(comparison).length !== 3 || comparison.waypoint !== request.waypoint) return null
    const blocked = analysis.states.reduce((sum, value) => sum + Number(value === 3), 0)
    const unknown = analysis.states.reduce((sum, value) => sum + Number(value === 0), 0)
    const validRoute = (route: TerrainModelRoute, role: 'distance' | 'terrain') => {
      if (!route || Object.keys(route).length !== 21 || route.id !== role || route.model !== `hypothetical-dem-${role}` || route.costUnit !== 'cost-equivalent-m' || route.scientificStatus !== 'physical-terrain-unverified' || route.qualification !== `Hypothetical DEM-based model. Physical traversability and human safety are not validated. ${request.grid.source.qualification}` || !sameObject(route.source, request.grid.source) || !sameObject(route.profile, request.profile) || !Array.isArray(route.nodes) || !Array.isArray(route.points) || route.nodes.length < 2 || route.nodes.length > request.grid.values.length * 2 || route.points.length !== route.nodes.length || route.nodes[0] !== request.origin || route.nodes.at(-1) !== request.destination || (request.waypoint !== null && !route.nodes.includes(request.waypoint)) || route.blockedSearchCells !== blocked || route.unknownSearchCells !== unknown) return false
      if (!Array.isArray(route.exploredNodes)) return false
      const explored = new Set(route.exploredNodes)
      if (explored.size !== route.exploredNodes.length || !route.exploredNodes.every(node => Number.isSafeInteger(node) && node >= 0 && node < request.grid.values.length) || !route.nodes.every(node => explored.has(node))) return false
      let distance = 0, cost = 0, unknownSegments = 0, gradeSum = 0, maxGrade = 0, roughSum = 0, maxRough = 0
      let roughKnown = true, slopeKnown = true, slopeSum = 0, maxSlope = 0
      for (let index = 0; index < route.nodes.length; index++) {
        const node = route.nodes[index], expected = modelPoint(request.grid, node)
        if (!sameObject(route.points[index], expected)) return false
        const rough = analysis.roughnessM[node]
        const slope = analysis.slopeDeg[node]
        if (!Number.isFinite(slope)) slopeKnown = false
        else { slopeSum += slope; maxSlope = Math.max(maxSlope, slope) }
        if (!Number.isFinite(rough)) roughKnown = false
        else { roughSum += rough; maxRough = Math.max(maxRough, rough) }
        if (index === 0) continue
        const edge = terrainMovement(analysis, route.nodes[index - 1], node)
        if (edge.costM === null) return false
        distance += edge.distanceM; cost += edge.costM
        if (edge.classification === 'UNKNOWN' || edge.gradeDeg === null) unknownSegments++
        else { gradeSum += Math.abs(edge.gradeDeg); maxGrade = Math.max(maxGrade, Math.abs(edge.gradeDeg)) }
      }
      const stat = (actual: unknown, expected: number | null) => expected === null ? actual === null : close(actual, expected)
      return close(route.horizontalDistanceM, distance) && close(route.accumulatedCostM, cost) && route.unknownSegments === unknownSegments && stat(route.maxGradeDeg, unknownSegments ? null : maxGrade) && stat(route.meanAbsGradeDeg, unknownSegments ? null : gradeSum / (route.nodes.length - 1)) && stat(route.maxSlopeDeg, slopeKnown ? maxSlope : null) && stat(route.meanSlopeDeg, slopeKnown ? slopeSum / route.nodes.length : null) && stat(route.maxRoughnessM, roughKnown ? maxRough : null) && stat(route.meanRoughnessM, roughKnown ? roughSum / route.nodes.length : null)
    }
    if (!validRoute(comparison.distance, 'distance') || !validRoute(comparison.terrain, 'terrain') || comparison.terrain.accumulatedCostM > comparison.distance.accumulatedCostM + 1e-6 || comparison.distance.horizontalDistanceM > comparison.terrain.horizontalDistanceM + 1e-6) return null
    return { status: 'available', analysis, comparison }
  } catch { return null }
}

export function createTerrainRouteTask(request: TerrainTaskRequest, createWorker: () => RouteWorkerPort, timeoutMs = 30_000): { result: Promise<TerrainTaskResult>; cancel: () => void } {
  let finish: (result: TerrainTaskResult) => void = () => {}
  const result = new Promise<TerrainTaskResult>(resolve => {
    let worker: RouteWorkerPort
    try { worker = createWorker() } catch { resolve({ status: 'unavailable', reason: 'The DEM model worker could not start. Retry in a browser with worker support.' }); return }
    let completed = false
    const message = (event: Event) => {
      const data: unknown = (event as MessageEvent).data
      if (!data || typeof data !== 'object' || !('requestId' in data) || data.requestId !== 1 || !('result' in data)) return
      const accepted = acceptTerrainWorkerResult(data.result, request)
      finish(accepted ?? { status: 'unavailable', reason: 'The DEM model worker returned an invalid result. Retry the calculation.' })
    }
    const error = () => finish({ status: 'unavailable', reason: 'DEM model analysis failed. Retry with covered endpoints and supported profile values.' })
    finish = value => {
      if (completed) return
      completed = true
      clearTimeout(timer)
      worker.removeEventListener('message', message); worker.removeEventListener('error', error); worker.removeEventListener('messageerror', error)
      worker.terminate(); resolve(value)
    }
    worker.addEventListener('message', message); worker.addEventListener('error', error); worker.addEventListener('messageerror', error)
    const timer = setTimeout(() => finish({ status: 'unavailable', reason: 'DEM model analysis timed out. Retry or reduce the neighborhood radius.' }), timeoutMs)
    try { worker.postMessage({ requestId: 1, request }) } catch { error() }
  })
  return { result, cancel: () => finish({ status: 'unavailable', reason: 'DEM model calculation cancelled.' }) }
}
