import { analyzeTerrainModel } from '../terrain/terrainModel'
import { calculateTerrainComparison } from './terrainRoutes'
import type { TerrainTaskRequest } from './terrainRouteTask'

self.addEventListener('message', (event: MessageEvent<{ requestId: number; request: TerrainTaskRequest }>) => {
  const { requestId, request } = event.data
  try {
    const analysis = analyzeTerrainModel(request.grid, request.profile)
    const routes = calculateTerrainComparison(analysis, request.origin, request.destination, request.waypoint)
    self.postMessage({ requestId, result: { analysis, routes } })
  } catch (error) {
    self.postMessage({ requestId, result: { analysis: null, routes: { status: 'unavailable', reason: error instanceof Error ? error.message : 'DEM model unavailable.' } } })
  }
})
