import type { GlobeController } from '../globe/createMarsGlobe'
import type { MarsMapController } from '../map/createMarsMap'
import type { LayerStatuses, LayerVisibility } from '../map/types'
import { JEZERO_DETAIL_ZOOM } from '../../data/jezero'
import { easeInOut } from './animation'
import type { AnimationStage } from './animation'
import { detailReadinessLayers } from './layers'
import { DETAIL_LAYER_IDS, LAYER_IDS } from '../map/types'

type GlobeFlight = Pick<GlobeController, 'reset' | 'beginApproach' | 'setOverviewProgress' | 'setApproachProgress' | 'endApproach'>
type Presentation = { globe: GlobeFlight; blend: (mapOpacity: number) => void; onStage: (message: string) => void }
type JezeroFlightOptions = Presentation & {
  map: Pick<MarsMapController, 'prepareJezeroApproach' | 'setApproachZoom' | 'setDetailOpacity' | 'hasRenderedImagery'>
  fromMap: boolean
  preferences: () => LayerVisibility
  statuses: () => LayerStatuses
  onContextTimeout: () => void
  onDetailTimeout: () => void
}

/** Scripted graphics choreography only. No globe position becomes a map coordinate. */
export function createJezeroStages(options: JezeroFlightOptions): AnimationStage[] {
  const { map, globe, blend, onStage, preferences, statuses } = options
  let contextZoom = 4
  const noLayers = () => LAYER_IDS.every((id) => !preferences()[id])
  function prepareSelectedContext() {
    const selected = preferences()
    const mola = statuses().mola
    if (contextZoom < 7 && DETAIL_LAYER_IDS.some((id) => selected[id]) && (!selected.mola || mola.phase === 'unavailable' || (mola.failed > 0 && mola.pending === 0))) {
      contextZoom = 7
      map.setApproachZoom(contextZoom)
      map.setDetailOpacity(1)
    }
  }
  const stages: AnimationStage[] = []
  if (options.fromMap) stages.push({
    durationMs: 420,
    onStart: () => { globe.endApproach(); globe.reset(); blend(1); onStage('Returning to a full Mars overview') },
    onFrame: (p) => blend(1 - easeInOut(p)),
  })
  stages.push({
    durationMs: 2000,
    onStart: () => {
      blend(0)
      globe.beginApproach()
      map.prepareJezeroApproach()
      map.setApproachZoom(contextZoom)
      map.setDetailOpacity(0)
      prepareSelectedContext()
      onStage('Approaching Jezero')
    },
    onFrame: (p) => { if (p < 0.2) globe.setOverviewProgress(p / 0.2); else globe.setApproachProgress((p - 0.2) / 0.8) },
    ready: () => { prepareSelectedContext(); return noLayers() || map.hasRenderedImagery() },
    timeoutMs: 12_000,
    onWaiting: () => onStage('Waiting for real Mars Trek imagery'),
    onTimeout: options.onContextTimeout,
  }, {
    durationMs: 700,
    onStart: () => onStage(contextZoom < 7 ? 'Revealing regional map context' : 'Revealing selected Jezero imagery'),
    onFrame: (p) => blend(easeInOut(p)),
  }, {
    durationMs: 2200,
    onStart: () => onStage('Arriving at Jezero crater'),
    onFrame: (p) => {
      const zoom = contextZoom + (JEZERO_DETAIL_ZOOM - contextZoom) * easeInOut(p)
      map.setApproachZoom(zoom)
      map.setDetailOpacity(contextZoom >= 7 ? 1 : easeInOut((zoom - 7) / 1.25))
    },
    ready: () => {
      const selected = detailReadinessLayers(preferences(), statuses())
      return selected.length === 0 || selected.some((id) => map.hasRenderedImagery(id))
    },
    timeoutMs: 10_000,
    onWaiting: () => onStage('Jezero centered · waiting for CTX detail'),
    onTimeout: options.onDetailTimeout,
  })
  return stages
}

export function createReturnStages({ globe, blend, onStage, reducedMotion = false }: Presentation & { reducedMotion?: boolean }): AnimationStage[] {
  return [{
    durationMs: reducedMotion ? 0 : 1200,
    onStart: () => { globe.endApproach(); globe.beginApproach(); globe.setApproachProgress(reducedMotion ? 0 : 1); blend(1); onStage('Returning to the Mars overview') },
    onFrame: (p) => { globe.setApproachProgress(reducedMotion ? 0 : 1 - p); blend(1 - easeInOut(Math.min(1, p / 0.75))) },
  }]
}
