import type { TerrainGrid } from '../terrain/gridTypes'
import type { GridIndices } from '../terrain/terrainMetrics'

export type RoutePoint = {
  readonly row: number
  readonly column: number
  readonly lon: number
  readonly lat: number
}

export type HypotheticalRoute = {
  readonly id: 'shortest' | 'via'
  readonly name: string
  readonly points: readonly RoutePoint[]
  readonly distanceM: number
  readonly visitedCells: number
  readonly sourceId: string
  readonly sourceHash: string
  readonly gridHash: string
  readonly model: 'hypothetical-distance-only'
  readonly referenceRadiusM: 3396190
}

export type RouteComparison = {
  readonly shortest: HypotheticalRoute
  readonly via: HypotheticalRoute | null
}

export type RouteRequest = {
  readonly grid: TerrainGrid
  readonly origin: GridIndices
  readonly destination: GridIndices
  readonly waypoint: GridIndices | null
}

export type RouteResult = { readonly status: 'available'; readonly value: RouteComparison } | { readonly status: 'unavailable'; readonly reason: string }
export type RouteWorkerRequest = { readonly requestId: number; readonly request: RouteRequest }
export type RouteWorkerResponse = { readonly requestId: number; readonly result: RouteResult }
