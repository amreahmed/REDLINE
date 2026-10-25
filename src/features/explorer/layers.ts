import { viewportMessage } from '../map/types'
import type { Coverage, LayerStatuses, LayerVisibility } from '../map/types'

/** Presentation only; the map still clips imagery and handles each service's failures. */
export function explorerLayerVisibility(preferences: LayerVisibility, mapActive: boolean, localDetail: boolean, ctxCoverage: Coverage): LayerVisibility {
  return {
    mola: mapActive && preferences.mola,
    ctx: mapActive && preferences.ctx && localDetail && ctxCoverage !== 'outside',
  }
}

export function explorerViewportMessage(preferences: LayerVisibility, effective: LayerVisibility, statuses: LayerStatuses, localDetail: boolean): string | null {
  if (!preferences.mola && preferences.ctx && statuses.ctx.phase === 'unavailable') return 'The CTX service is unavailable. Retry CTX in Mission control, or enable MOLA to request broader context.'
  if (!preferences.mola && preferences.ctx && !localDetail) return 'CTX appears at local zoom. Zoom in near Jezero, or enable MOLA for broader context.'
  if (!preferences.mola && preferences.ctx && localDetail && statuses.ctx.coverage === 'outside') return 'Outside Jezero CTX coverage. Enable MOLA to request broader context, or return to Jezero detail.'
  return viewportMessage(effective, statuses)
}
