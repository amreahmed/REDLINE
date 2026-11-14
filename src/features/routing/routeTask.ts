import type { HypotheticalRoute, RouteRequest, RouteResult } from './types'
import { getGridCell } from '../terrain/terrainGrid'
import { measureGridSeparation } from '../terrain/terrainMetrics'

export type RouteWorkerPort = Pick<Worker, 'postMessage' | 'addEventListener' | 'removeEventListener' | 'terminate'>

function validResponse(value: unknown, request: RouteRequest): value is RouteResult {
  if (!value || typeof value !== 'object' || !('status' in value)) return false
  if (value.status === 'unavailable') return 'reason' in value && typeof value.reason === 'string' && value.reason.length > 0
  if (value.status !== 'available' || !('value' in value) || !value.value || typeof value.value !== 'object') return false
  const comparison = value.value
  const validRoute = (input: unknown, id: 'shortest' | 'via'): input is HypotheticalRoute => {
    if (!input || typeof input !== 'object') return false
    const route = input as Partial<HypotheticalRoute>
    if (route.id !== id || typeof route.name !== 'string' || route.model !== 'hypothetical-distance-only' || route.referenceRadiusM !== 3396190 || route.sourceId !== request.grid.manifest.source.productId || route.sourceHash !== request.grid.manifest.source.sha256 || route.gridHash !== request.grid.manifest.encoding.sha256 || !Number.isFinite(route.distanceM) || route.distanceM! <= 0 || !Number.isSafeInteger(route.visitedCells) || route.visitedCells! < 1 || !Array.isArray(route.points) || route.points.length < 2 || route.points.length > request.grid.values.length * 2) return false
    let measuredDistanceM = 0
    for (let index = 0; index < route.points.length; index++) {
      const point = route.points[index]
      if (!point || typeof point !== 'object') return false
      const cell = getGridCell(request.grid, point.row, point.column)
      if (cell.status !== 'valid' || cell.cell.lon !== point.lon || cell.cell.lat !== point.lat) return false
      if (index === 0) continue
      const previous = route.points[index - 1]
      const rowStep = Math.abs(point.row - previous.row)
      const columnStep = Math.abs(point.column - previous.column)
      if (rowStep > 1 || columnStep > 1 || (!rowStep && !columnStep)) return false
      if (rowStep && columnStep && (getGridCell(request.grid, previous.row, point.column).status !== 'valid' || getGridCell(request.grid, point.row, previous.column).status !== 'valid')) return false
      const separation = measureGridSeparation(request.grid, previous, point)
      if (separation.status !== 'available') return false
      measuredDistanceM += separation.value.distanceM
    }
    // Reproduce the metric from accepted adjacent centers. Allow only ordinary
    // floating-point accumulation differences between the two waypoint legs.
    if (!Number.isFinite(measuredDistanceM) || Math.abs(route.distanceM! - measuredDistanceM) > Math.max(1e-6, measuredDistanceM * 1e-10)) return false
    const first = route.points[0]
    const last = route.points.at(-1)!
    return first.row === request.origin.row && first.column === request.origin.column && last.row === request.destination.row && last.column === request.destination.column && (id !== 'via' || !!request.waypoint && route.points.some(point => point.row === request.waypoint!.row && point.column === request.waypoint!.column))
  }
  return 'shortest' in comparison && validRoute(comparison.shortest, 'shortest') && 'via' in comparison && (request.waypoint ? validRoute(comparison.via, 'via') && comparison.via.distanceM + 1e-6 >= comparison.shortest.distanceM : comparison.via === null)
}

/** One owned worker per calculation; cancellation terminates substantial search. */
export function createRouteTask(request: RouteRequest, createWorker: () => RouteWorkerPort, timeoutMs = 20000): { result: Promise<RouteResult>; cancel: () => void } {
  let finish: (result: RouteResult) => void = () => {}
  const result = new Promise<RouteResult>(resolve => {
    let worker: RouteWorkerPort
    try { worker = createWorker() } catch {
      resolve({ status: 'unavailable', reason: 'The route worker could not start. Retry in a browser with worker support.' })
      return
    }
    let completed = false
    const message = (event: Event) => {
      const data: unknown = (event as MessageEvent).data
      if (!data || typeof data !== 'object' || !('requestId' in data) || data.requestId !== 1 || !('result' in data)) return
      const response = data.result
      if (!validResponse(response, request)) {
        finish({ status: 'unavailable', reason: 'The route worker returned an invalid result. Retry the calculation.' })
        return
      }
      finish(response)
    }
    const error = () => finish({ status: 'unavailable', reason: 'The route calculation failed. Retry with supported grid endpoints.' })
    finish = value => {
      if (completed) return
      completed = true
      clearTimeout(timer)
      worker.removeEventListener('message', message)
      worker.removeEventListener('error', error)
      worker.removeEventListener('messageerror', error)
      worker.terminate()
      resolve(value)
    }
    worker.addEventListener('message', message)
    worker.addEventListener('error', error)
    worker.addEventListener('messageerror', error)
    const timer = setTimeout(() => finish({ status: 'unavailable', reason: 'The route calculation timed out. Retry or choose closer endpoints.' }), timeoutMs)
    try { worker.postMessage({ requestId: 1, request }) } catch { error() }
  })
  return { result, cancel: () => finish({ status: 'unavailable', reason: 'Route calculation cancelled.' }) }
}
