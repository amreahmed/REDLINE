import { calculateDistanceRoutes } from './distanceRoutes'
import type { RouteWorkerRequest, RouteWorkerResponse } from './types'

// Dedicated module worker: no DOM, imagery access or scientific height processing.
// Typing the minimal worker surface avoids adding WebWorker globals to the app
// tsconfig's DOM libraries.
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<RouteWorkerRequest>) => void) | null
  postMessage: (message: RouteWorkerResponse) => void
}

worker.onmessage = event => {
  const suppliedId = event.data?.requestId
  const requestId = Number.isSafeInteger(suppliedId) && suppliedId >= 0 ? suppliedId : -1
  try {
    if (requestId < 0) throw new Error('Route worker request identifier is invalid.')
    worker.postMessage({ requestId, result: calculateDistanceRoutes(event.data.request) })
  } catch (error) {
    worker.postMessage({ requestId, result: { status: 'unavailable', reason: error instanceof Error ? error.message : 'Route worker could not compute a path.' } })
  }
}
