import { useEffect, useRef, useState } from 'react'
import 'ol/ol.css'
import { MARS_LAYERS } from '../../data/marsLayers'
import { createMarsMap } from '../../features/map/createMarsMap'
import { viewportMessage } from '../../features/map/types'
import type { MarsMapController } from '../../features/map/createMarsMap'
import type { LayerId, LayerStatus, LayerStatuses, LayerVisibility, ViewStatus } from '../../features/map/types'
import { Icon } from '../shared/Icon'

type MarsMapProps = {
  active: boolean
  resetRequest: number
  visibility: LayerVisibility
  statuses: LayerStatuses
  retryRequest: { id: LayerId; sequence: number } | null
  onStatus: (id: LayerId, status: LayerStatus) => void
}

export function MarsMap({ active, resetRequest, visibility, statuses, retryRequest, onStatus }: MarsMapProps) {
  const targetRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<MarsMapController | null>(null)
  const [view, setView] = useState<ViewStatus | null>(null)
  const [startupError, setStartupError] = useState<string | null>(null)

  useEffect(() => {
    if (!targetRef.current) return
    try {
      controllerRef.current = createMarsMap(targetRef.current, onStatus, setView)
    } catch {
      // Renderer construction can fail independently of the remote services.
      queueMicrotask(() => setStartupError('The map renderer could not start. Reload the page to retry.'))
    }
    return () => { controllerRef.current?.dispose(); controllerRef.current = null }
  }, [onStatus])

  useEffect(() => { controllerRef.current?.setVisibility(visibility) }, [visibility])
  useEffect(() => { if (retryRequest) controllerRef.current?.retry(retryRequest.id) }, [retryRequest])
  useEffect(() => { if (active) controllerRef.current?.refresh() }, [active])
  useEffect(() => {
    if (resetRequest) { controllerRef.current?.reset(); targetRef.current?.focus() }
  }, [resetRequest])

  const visible = MARS_LAYERS.filter((layer) => visibility[layer.id])
  const busy = visible.some((layer) => statuses[layer.id].phase === 'checking' || statuses[layer.id].pending > 0)
  const emptyMessage = startupError ?? viewportMessage(visibility, statuses)

  return (
    <section className="map-viewport real-map" aria-labelledby="map-heading" data-grid="false" hidden={!active}>
      <div className="viewport-top map-toolbar flex items-center justify-between gap-3">
        <div className="viewport-label flex items-center gap-2"><Icon name="map" size={16} /><h1 id="map-heading">Jezero regional map</h1></div>
        <button className="grid-button" type="button" onClick={() => controllerRef.current?.reset()} disabled={!view} aria-label="Reset map to Jezero coverage">Reset view</button>
      </div>
      <div className="map-surface">
        <div id="map-workspace" ref={targetRef} className="ol-host" tabIndex={0} role="region" aria-label="Mars regional imagery map" aria-describedby="map-keyboard-help" />
        <div className="map-zoom-controls" role="group" aria-label="Map zoom">
          <button type="button" aria-label="Zoom in" disabled={!view?.canZoomIn} onClick={() => controllerRef.current?.zoomBy(1)}>+</button>
          <button type="button" aria-label="Zoom out" disabled={!view?.canZoomOut} onClick={() => controllerRef.current?.zoomBy(-1)}>−</button>
        </div>
        {emptyMessage && <div className="map-message" role="status"><Icon name="map" size={28} /><p>{emptyMessage}</p></div>}
        {busy && !emptyMessage && <div className="map-loading" role="status">Loading Mars Trek imagery…</div>}
        <div className="map-credit">NASA/JPL-Caltech Mars Trek · MGS/MOLA · MRO/CTX</div>
      </div>
      <div className="map-position">
        <span>Service grid center</span>
        <span>{view ? `${view.center[0].toFixed(3)}° lon, ${view.center[1].toFixed(3)}° lat` : 'Waiting for map'}</span>
      </div>
      <div className="viewport-bottom map-help">
        <p id="map-keyboard-help">Drag to pan. Focus the map, then use arrow keys to pan and + / − to zoom.</p>
        <p>Rendered imagery only. No elevation measurements.</p>
      </div>
    </section>
  )
}
