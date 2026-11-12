export const GLOBE_ENTER_DISTANCE = 2.45
export const GLOBE_REARM_DISTANCE = 3.2
export const MAP_RETURN_ZOOM = 1.5
export const MAP_REARM_ZOOM = 2.5
export const MAP_ENTRY_ZOOM = 4
export const CTX_ENTER_ZOOM = 7
export const CTX_LEAVE_ZOOM = 6.25
export const HANDOFF_MS = 360

export type ExplorerPhase = 'overview' | 'entering-map' | 'map' | 'entering-overview' | 'flying-to-jezero'
export type ExplorerState = { phase: ExplorerPhase; overviewArmed: boolean; mapArmed: boolean; localDetail: boolean }
export type ExplorerEvent =
  | { type: 'globe-distance'; value: number }
  | { type: 'map-zoom'; value: number; overviewAvailable: boolean }
  | { type: 'enter-map' }
  | { type: 'enter-overview' }
  | { type: 'fly-jezero' }
  | { type: 'interrupt'; destination: 'overview' | 'map' }
  | { type: 'settled'; phase: ExplorerPhase }

export const initialExplorerState: ExplorerState = { phase: 'overview', overviewArmed: false, mapArmed: false, localDetail: false }
export const isTransitioning = (state: ExplorerState) => state.phase === 'entering-map' || state.phase === 'entering-overview' || state.phase === 'flying-to-jezero'
export const mapIsShown = (state: ExplorerState) => state.phase === 'map' || state.phase === 'entering-map'

/** One animation blend drives both panes, including the frame before settlement. */
export function explorerPaneOpacities(state: ExplorerState, composition: number | null) {
  const map = composition ?? (mapIsShown(state) ? 1 : 0)
  return { map, globe: 1 - map }
}

/** View thresholds only. Globe distances are arbitrary display units, never Mars distances. */
export function transitionExplorer(state: ExplorerState, event: ExplorerEvent): ExplorerState {
  if (event.type === 'interrupt' && isTransitioning(state)) return { ...state, phase: event.destination, overviewArmed: false, mapArmed: false, localDetail: event.destination === 'map' && state.localDetail }
  if (event.type === 'settled') {
    if (event.phase !== state.phase) return state
    if (state.phase === 'entering-map') return { ...state, phase: 'map', mapArmed: false }
    if (state.phase === 'entering-overview') return { ...state, phase: 'overview', overviewArmed: false, localDetail: false }
    if (state.phase === 'flying-to-jezero') return { ...state, phase: 'map', mapArmed: false }
    return state
  }
  if ((state.phase === 'flying-to-jezero' || state.phase === 'entering-map') && event.type === 'map-zoom' && Number.isFinite(event.value)) {
    const localDetail = state.localDetail ? event.value > CTX_LEAVE_ZOOM : event.value >= CTX_ENTER_ZOOM
    return localDetail === state.localDetail ? state : { ...state, localDetail }
  }
  if (isTransitioning(state)) return state
  if (event.type === 'fly-jezero') return { ...state, phase: 'flying-to-jezero', mapArmed: false }
  if (event.type === 'enter-map' && state.phase === 'overview') return { ...state, phase: 'entering-map', mapArmed: false }
  if (event.type === 'enter-overview' && state.phase === 'map') return { ...state, phase: 'entering-overview', overviewArmed: false }
  if (event.type === 'globe-distance' && state.phase === 'overview' && Number.isFinite(event.value) && event.value > 0) {
    if (state.overviewArmed && event.value <= GLOBE_ENTER_DISTANCE) return { ...state, phase: 'entering-map', mapArmed: false }
    if (!state.overviewArmed && event.value >= GLOBE_REARM_DISTANCE) return { ...state, overviewArmed: true }
  }
  if (event.type === 'map-zoom' && state.phase === 'map' && Number.isFinite(event.value)) {
    if (state.mapArmed && event.value <= MAP_RETURN_ZOOM && event.overviewAvailable) return { ...state, phase: 'entering-overview', overviewArmed: false }
    const localDetail = state.localDetail ? event.value > CTX_LEAVE_ZOOM : event.value >= CTX_ENTER_ZOOM
    const mapArmed = state.mapArmed || event.value >= MAP_REARM_ZOOM
    if (localDetail !== state.localDetail || mapArmed !== state.mapArmed) return { ...state, localDetail, mapArmed }
  }
  return state
}
