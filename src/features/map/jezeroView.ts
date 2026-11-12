import { JEZERO_CONTEXT_ZOOM, JEZERO_DETAIL_ZOOM, JEZERO_NAVIGATION } from '../../data/jezero'

export const jezeroCenter = (): [number, number] => [...JEZERO_NAVIGATION.center]
export const clampApproachZoom = (zoom: number) => Number.isFinite(zoom) ? Math.max(JEZERO_CONTEXT_ZOOM, Math.min(JEZERO_DETAIL_ZOOM, zoom)) : JEZERO_CONTEXT_ZOOM
export const clampDetailOpacity = (opacity: number) => Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 0
