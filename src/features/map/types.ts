export type Bounds = [west: number, south: number, east: number, north: number]
export const LAYER_IDS = ['mola', 'ctx', 'controlledCtx'] as const
export const DETAIL_LAYER_IDS = ['controlledCtx', 'ctx'] as const
export type LayerId = typeof LAYER_IDS[number]
export type DetailLayerId = typeof DETAIL_LAYER_IDS[number]
export type Coverage = 'inside' | 'partial' | 'outside'
export type DetailLayerCoverage = Record<DetailLayerId, Coverage>
export type GridOverlayEndpoint = { role: 'origin' | 'destination'; coordinate: readonly [number, number] }

export type LayerDefinition = {
  id: LayerId
  name: string
  productId: string
  mission: string
  description: string
  capabilitiesUrl: string
  sourceUrl: string
  format: 'image/png' | 'image/jpeg'
  extent: Bounds
  maxLevel: number
  resolution: string
  attribution: string
  limitation: string
}

export type TileContract = {
  extent: Bounds
  origin: [number, number]
  matrixSet: string
  matrixIds: string[]
  resolutions: number[]
  sizes: [number, number][]
  tileSize: number
  style: string
  format: string
  template: string
}

export type LayerStatus = {
  phase: 'checking' | 'available' | 'unavailable'
  pending: number
  loaded: number
  missing: number
  failed: number
  coverage: Coverage
  enlarged: boolean
  detail?: string
}

export type LayerStatuses = Record<LayerId, LayerStatus>
export type LayerVisibility = Record<LayerId, boolean>
export type ViewStatus = { center: [number, number]; zoom: number; canZoomIn: boolean; canZoomOut: boolean }

export const initialLayerStatus = (): LayerStatus => ({ phase: 'checking', pending: 0, loaded: 0, missing: 0, failed: 0, coverage: 'inside', enlarged: false })

export function layerStatusLabel(status: LayerStatus, visible: boolean) {
  if (!visible) return 'Hidden'
  if (status.phase === 'checking') return 'Checking service'
  if (status.phase === 'unavailable') return 'Service unavailable'
  if (status.coverage === 'outside') return 'Outside coverage'
  if (status.pending > 0) return 'Loading imagery'
  if (status.failed > 0) return 'Tile requests failed'
  if (status.missing > 0) return 'Some tiles missing'
  if (status.loaded > 0) return status.coverage === 'partial' ? 'Partial coverage' : 'Tiles received'
  return 'Waiting for imagery'
}

export function viewportMessage(visibility: LayerVisibility, statuses: LayerStatuses): string | null {
  const visible = LAYER_IDS.filter((id) => visibility[id]).map((id) => statuses[id])
  if (!visible.length) return 'Choose a layer in Mission control to display imagery.'
  const inCoverage = visible.filter((status) => status.coverage !== 'outside')
  if (!inCoverage.length) return 'This view is outside the selected layers’ coverage. Reset to Jezero to return.'
  const available = inCoverage.filter((status) => status.phase !== 'unavailable')
  if (!available.length) return 'No imagery is available in this view. Retry an unavailable layer or reset to Jezero.'
  if (available.every((status) => status.phase === 'available' && status.pending === 0 && status.loaded === 0 && status.missing + status.failed > 0)) return 'No imagery was received. Tile requests failed or returned missing data. See Sources & status, then retry a layer.'
  return null
}
