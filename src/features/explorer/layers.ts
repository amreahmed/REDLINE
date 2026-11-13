import { DETAIL_LAYER_IDS, viewportMessage } from '../map/types'
import type { DetailLayerCoverage, DetailLayerId, LayerStatuses, LayerVisibility } from '../map/types'

/** A deliberate empty context remains usable; it cannot satisfy an imagery gate. */
export function contextCanOpenWithoutImagery(preferences: LayerVisibility, localDetail: boolean, coverage: DetailLayerCoverage) {
  return !preferences.mola && (!localDetail || DETAIL_LAYER_IDS.every((id) => !preferences[id] || coverage[id] === 'outside'))
}

/** Presentation only; the map still clips imagery and handles each service's failures. */
export function explorerLayerVisibility(preferences: LayerVisibility, mapActive: boolean, localDetail: boolean, coverage: DetailLayerCoverage): LayerVisibility {
  return {
    mola: mapActive && preferences.mola,
    ctx: mapActive && preferences.ctx && localDetail && coverage.ctx !== 'outside',
    controlledCtx: mapActive && preferences.controlledCtx && localDetail && coverage.controlledCtx !== 'outside',
  }
}

/** Prefer controlled imagery; only an explicitly selected alternative can satisfy a failed detail gate. */
export function detailReadinessLayers(preferences: LayerVisibility, statuses: LayerStatuses): readonly DetailLayerId[] {
  const selected = DETAIL_LAYER_IDS.filter((id) => preferences[id])
  if (selected.length < 2) return selected
  const controlled = statuses.controlledCtx
  const blocked = controlled.phase === 'unavailable' || controlled.coverage === 'outside' || (controlled.pending === 0 && controlled.failed + controlled.missing > 0)
  return blocked ? selected : ['controlledCtx']
}

export function explorerViewportMessage(preferences: LayerVisibility, effective: LayerVisibility, statuses: LayerStatuses, localDetail: boolean): string | null {
  const selected = DETAIL_LAYER_IDS.filter((id) => preferences[id])
  if (!preferences.mola && selected.length) {
    if (selected.every((id) => statuses[id].phase === 'unavailable')) return 'The selected CTX service is unavailable. Retry the selected imagery in Mission control, or enable MOLA to request broader context.'
    if (!localDetail) return 'CTX appears at local zoom. Zoom in near Jezero, or enable MOLA for broader context.'
    if (selected.every((id) => statuses[id].coverage === 'outside')) return 'Outside selected Jezero CTX coverage. Enable MOLA to request broader context, or return to Jezero detail.'
  }
  return viewportMessage(effective, statuses)
}
