import { useCallback, useEffect, useRef, useState } from 'react'
import 'ol/ol.css'
import { MARS_LAYERS } from '../../data/marsLayers'
import { createMarsMap } from '../../features/map/createMarsMap'
import type { MarsMapController } from '../../features/map/createMarsMap'
import type { GlobeController, GlobeStatus } from '../../features/globe/createMarsGlobe'
import type { LayerId, LayerStatus, LayerStatuses, LayerVisibility, ViewStatus } from '../../features/map/types'
import { explorerLayerVisibility, explorerViewportMessage } from '../../features/explorer/layers'
import { HANDOFF_MS, MAP_ENTRY_ZOOM, initialExplorerState, isTransitioning, mapIsShown, transitionExplorer } from '../../features/explorer/transition'
import type { ExplorerEvent } from '../../features/explorer/transition'
import { initialExplorerSummary } from '../../features/explorer/types'
import type { ExplorerSummary } from '../../features/explorer/types'
import { Icon } from '../shared/Icon'

type Props = {
  visibility: LayerVisibility
  statuses: LayerStatuses
  retryRequest: { id: LayerId; sequence: number } | null
  jezeroRequest: number
  onStatus: (id: LayerId, status: LayerStatus) => void
  onSummary: (summary: ExplorerSummary) => void
}

export function MarsExplorer({ visibility, statuses, retryRequest, jezeroRequest, onStatus, onSummary }: Props) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const globeHostRef = useRef<HTMLDivElement>(null)
  const mapHostRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeController | null>(null)
  const mapRef = useRef<MarsMapController | null>(null)
  const stateRef = useRef(initialExplorerState)
  const [state, setState] = useState(initialExplorerState)
  const [globe, setGlobe] = useState<GlobeStatus>(initialExplorerSummary.globe)
  const globeStatusRef = useRef(globe)
  const [globeAttempt, setGlobeAttempt] = useState(0)
  const [view, setView] = useState<ViewStatus | null>(null)
  const viewRef = useRef<ViewStatus | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const visitedMap = useRef(false)

  const send = useCallback(function dispatch(event: ExplorerEvent) {
    const previous = stateRef.current
    const next = transitionExplorer(previous, event)
    if (next === previous) return
    // Prepare the destination before opacity changes. No globe coordinate is transferred.
    if (next.phase === 'entering-map' && previous.phase === 'overview') {
      mapRef.current?.enterContext(!visitedMap.current, MAP_ENTRY_ZOOM)
      visitedMap.current = true
    }
    if (next.phase === 'entering-overview' && previous.phase === 'map') globeRef.current?.retreat()
    stateRef.current = next
    setState(next)
    if (event.type === 'settled' && next.phase === 'map' && viewRef.current) {
      dispatch({ type: 'map-zoom', value: viewRef.current.zoom, overviewAvailable: globeStatusRef.current.phase === 'ready' })
    }
  }, [])

  useEffect(() => {
    if (!mapHostRef.current) return
    let mounted = true
    try {
      mapRef.current = createMarsMap(mapHostRef.current, onStatus, (next) => {
        if (!mounted) return
        viewRef.current = next
        setView(next)
        send({ type: 'map-zoom', value: next.zoom, overviewAvailable: globeStatusRef.current.phase === 'ready' })
      }, { keyboard: false })
      mapRef.current.setActive(false)
      mapRef.current.setVisibility({ mola: false, ctx: false })
    } catch {
      queueMicrotask(() => { if (mounted) setMapError('The map renderer could not start. The NASA overview remains available; reload to retry the map.') })
    }
    return () => { mounted = false; mapRef.current?.dispose(); mapRef.current = null }
  }, [onStatus, send])

  useEffect(() => {
    let mounted = true
    const report = (next: GlobeStatus) => { if (mounted) { globeStatusRef.current = next; setGlobe(next) } }
    void import('../../features/globe/createMarsGlobe').then(({ createMarsGlobe }) => {
      if (!mounted || !globeHostRef.current) return
      globeRef.current = createMarsGlobe(globeHostRef.current, report, (distance) => send({ type: 'globe-distance', value: distance }))
      globeRef.current.setActive(stateRef.current.phase === 'overview')
    }).catch(() => report({ phase: 'error', message: 'The 3D overview could not start. WebGL 2 and a connection are required. Retry or continue to the real map.' }))
    return () => { mounted = false; globeRef.current?.dispose(); globeRef.current = null }
  }, [globeAttempt, send])

  const mapShown = mapIsShown(state)
  const transitioning = isTransitioning(state)
  // Keep the outgoing map image through its fade; stop tile rendering once overview settles.
  const effective = explorerLayerVisibility(visibility, state.phase !== 'overview', state.localDetail, statuses.ctx.coverage)
  useEffect(() => { mapRef.current?.setVisibility({ mola: effective.mola, ctx: effective.ctx }) }, [effective.mola, effective.ctx])
  useEffect(() => { if (retryRequest) mapRef.current?.retry(retryRequest.id) }, [retryRequest])
  useEffect(() => {
    globeRef.current?.setActive(state.phase === 'overview')
    mapRef.current?.setActive(state.phase === 'map')
    if (state.phase !== 'entering-map' && state.phase !== 'entering-overview') return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => send({ type: 'settled', phase: state.phase }), reducedMotion ? 0 : HANDOFF_MS)
    return () => clearTimeout(timer)
  }, [state.phase, send])
  useEffect(() => { onSummary({ phase: state.phase, mapShown, localDetail: state.localDetail, globe }) }, [state.phase, mapShown, state.localDetail, globe, onSummary])
  useEffect(() => {
    if (!jezeroRequest || isTransitioning(stateRef.current)) return
    if (stateRef.current.phase === 'overview') {
      // Explicit navigation chooses Jezero, independent of the globe's visible hemisphere.
      visitedMap.current = false
      send({ type: 'enter-map' })
    } else mapRef.current?.focusJezero()
    workspaceRef.current?.focus({ preventScroll: true })
  }, [jezeroRequest, send])

  const busy = MARS_LAYERS.some((layer) => effective[layer.id] && (statuses[layer.id].phase === 'checking' || statuses[layer.id].pending > 0))
  const mapMessage = mapError ?? explorerViewportMessage(visibility, effective, statuses, state.localDetail)
  const canNavigate = !transitioning && (mapShown ? !!view && !mapError : globe.phase === 'ready')
  const move = (horizontal: number, vertical: number) => { if (canNavigate) { if (mapShown) mapRef.current?.panBy(horizontal, vertical); else globeRef.current?.rotate(horizontal * 0.2, vertical * 0.2) } }
  const zoom = (delta: number) => { if (canNavigate) { if (mapShown) mapRef.current?.zoomBy(delta); else globeRef.current?.zoom(delta > 0 ? 1 / 1.2 : 1.2) } }
  const retryGlobe = () => { setGlobe(initialExplorerSummary.globe); globeStatusRef.current = initialExplorerSummary.globe; setGlobeAttempt((value) => value + 1) }

  return (
    <section className="map-viewport explorer-viewport" data-grid="false" aria-labelledby="explorer-heading">
      <div className="viewport-top map-toolbar explorer-toolbar">
        <div className="viewport-label flex items-center gap-2"><Icon name="orbit" size={17} /><h1 id="explorer-heading">Mars explorer</h1></div>
        <span className="exploration-stage">{mapShown ? (state.localDetail ? 'Local detail' : 'Regional context') : 'Planet overview'}</span>
        <button className="grid-button" type="button" disabled={!canNavigate} onClick={() => mapShown ? mapRef.current?.focusJezero() : globeRef.current?.reset()}>{mapShown ? 'Jezero detail' : 'Reset overview'}</button>
      </div>
      <div id="explorer-workspace" ref={workspaceRef} className="explorer-surface" tabIndex={0} role="region" aria-label="Interactive Mars explorer" aria-describedby="explorer-help handoff-limit" onPointerDown={(event) => { if (!(event.target as HTMLElement).closest('button,a')) event.currentTarget.focus({ preventScroll: true }) }} onKeyDown={(event) => {
        if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || !canNavigate) return
        const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
        if (directions[event.key]) { event.preventDefault(); move(...directions[event.key]) }
        if (['+', '=', '-', 'Home'].includes(event.key)) { event.preventDefault(); if (event.key === 'Home') { if (mapShown) mapRef.current?.focusJezero(); else globeRef.current?.reset() } else zoom(event.key === '-' ? -1 : 1) }
      }}>
        <div className="explorer-pane globe-pane" data-visible={!mapShown} aria-hidden={mapShown} inert={state.phase !== 'overview'}><div className="globe-host" ref={globeHostRef} /></div>
        <div className="explorer-pane map-pane" data-visible={mapShown} aria-hidden={!mapShown} inert={state.phase !== 'map'}><div className="ol-host" ref={mapHostRef} /></div>
        {!mapShown && globe.phase !== 'ready' && <div className="globe-message" role="status">
          <Icon name="orbit" size={30} /><p>{globe.message}</p>
          {globe.phase === 'error' && <button type="button" className="grid-button" onClick={retryGlobe}>Retry overview</button>}
          <button type="button" className="grid-button" disabled={transitioning} onClick={() => send({ type: 'enter-map' })}>Continue to map context</button>
        </div>}
        {mapShown && mapMessage && <div className="map-message" role="status"><p>{mapMessage}</p></div>}
        {mapShown && busy && !mapMessage && <div className="map-loading" role="status">Loading NASA Mars Trek imagery…</div>}
        {transitioning && <div className="handoff-status" role="status">{mapShown ? 'Entering the map context. No globe location is transferred.' : 'Returning to the visual overview.'}</div>}
        <div className="map-credit">{mapShown ? 'NASA/JPL-Caltech Mars Trek · MGS/MOLA · MRO/CTX' : 'Visual model: NASA/JPL-Caltech'}</div>
      </div>
      <div className="explorer-navigation">
        <div className="globe-actions" role="group" aria-label={mapShown ? 'Map navigation' : 'Overview navigation'}>
          {([[-1, 0, '←', 'left'], [1, 0, '→', 'right'], [0, -1, '↑', 'up'], [0, 1, '↓', 'down']] as const).map(([x, y, label, direction]) => <button key={direction} type="button" disabled={!canNavigate} aria-label={`${mapShown ? 'Pan map' : 'Rotate globe'} ${direction}`} onClick={() => move(x, y)}>{label}</button>)}
          <button type="button" disabled={!canNavigate || (mapShown && !view?.canZoomIn)} aria-label="Zoom in" onClick={() => zoom(1)}>+</button>
          <button type="button" disabled={!canNavigate || (mapShown && !view?.canZoomOut)} aria-label="Zoom out" onClick={() => zoom(-1)}>−</button>
        </div>
        <button className="grid-button" type="button" disabled={transitioning} onClick={() => send({ type: mapShown ? 'enter-overview' : 'enter-map' })}>{mapShown ? 'Return to overview' : 'Explore map context'}</button>
      </div>
      <div className="map-position"><span>{mapShown ? 'Service grid center' : 'Visual overview · no geographic picking'}</span><span>{mapShown && view ? `${view.center[0].toFixed(3)}° lon, ${view.center[1].toFixed(3)}° lat` : 'Zoom enters Jezero initially, then resumes the map area'}</span></div>
      <div className="viewport-bottom map-help">
        <p id="explorer-help">Drag to {mapShown ? 'pan' : 'rotate'}; scroll or pinch to zoom. Arrow keys and + / − work with focus here. Zoom {mapShown ? 'out for the overview; in near Jezero for CTX detail' : 'in to continue to the real map'}.</p>
        <p id="handoff-limit">The globe is not georeferenced. This is a guided map handoff, not a precise surface-location transfer. Images and geometry are not numerical elevation.</p>
        {mapShown && globe.phase === 'error' && <p className="source-warning">Overview unavailable. Zoom stays on the map; use Return to overview to retry.</p>}
      </div>
    </section>
  )
}
