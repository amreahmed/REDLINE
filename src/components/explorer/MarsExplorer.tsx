import { useCallback, useEffect, useRef, useState } from 'react'
import 'ol/ol.css'
import { MARS_LAYERS } from '../../data/marsLayers'
import { JEZERO_NAVIGATION } from '../../data/jezero'
import { createMarsMap } from '../../features/map/createMarsMap'
import type { MarsMapController } from '../../features/map/createMarsMap'
import type { GlobeController, GlobeStatus } from '../../features/globe/createMarsGlobe'
import type { LayerId, LayerStatus, LayerStatuses, LayerVisibility, ViewStatus } from '../../features/map/types'
import { contextCanOpenWithoutImagery, explorerLayerVisibility, explorerViewportMessage } from '../../features/explorer/layers'
import { HANDOFF_MS, MAP_ENTRY_ZOOM, explorerPaneOpacities, initialExplorerState, isTransitioning, mapIsShown, transitionExplorer } from '../../features/explorer/transition'
import type { ExplorerEvent } from '../../features/explorer/transition'
import { initialExplorerSummary } from '../../features/explorer/types'
import type { ExplorerSummary } from '../../features/explorer/types'
import { createAnimationPlayer, easeInOut } from '../../features/explorer/animation'
import { createJezeroStages, createReturnStages } from '../../features/explorer/jezeroFlight'
import { Icon } from '../shared/Icon'
import { SCIENCE_TARGETS, targetById } from '../../data/scienceTargets'
import type { EndpointRole, MissionSelection, TargetId } from '../../features/mission/types'
import type { GridSelection } from '../../features/mission/gridSelection'
import type { TerrainGrid } from '../../features/terrain/gridTypes'
import { terrainGridBounds } from '../../features/terrain/terrainGrid'
import type { GridOverlayEndpoint } from '../../features/map/types'

function gridEndpoints(selection: GridSelection): GridOverlayEndpoint[] {
  return (['origin', 'destination'] as const).flatMap((role) => {
    const cell = selection[role]
    return cell ? [{ role, coordinate: [cell.lon, cell.lat] as const }] : []
  })
}

type Props = {
  visibility: LayerVisibility
  statuses: LayerStatuses
  retryRequest: { id: LayerId; sequence: number } | null
  jezeroRequest: number
  onJezero: () => void
  onStatus: (id: LayerId, status: LayerStatus) => void
  onSummary: (summary: ExplorerSummary) => void
  missionSelection: MissionSelection
  selectedTargetId: TargetId | null
  focusRequest: { id: TargetId; sequence: number; focusWorkspace: boolean } | null
  onInspectTarget: (id: TargetId) => void
  planningGrid: TerrainGrid | null
  gridSelection: GridSelection
  gridFocusRequest: number
  centerPickRequest: number
  gridPickRole: EndpointRole | null
  gridPickNotice: string | null
  onPickCoordinate: (coordinate: [number, number]) => void
  onNavigate: () => void
}

export function MarsExplorer({ visibility, statuses, retryRequest, jezeroRequest, onJezero, onStatus, onSummary, missionSelection, selectedTargetId, focusRequest, onInspectTarget, planningGrid, gridSelection, gridFocusRequest, centerPickRequest, gridPickRole, gridPickNotice, onPickCoordinate, onNavigate }: Props) {
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
  const [controlledImageryReady, setControlledImageryReady] = useState(false)
  const visitedMap = useRef(false)
  const playerRef = useRef<ReturnType<typeof createAnimationPlayer> | null>(null)
  const preferencesRef = useRef(visibility)
  const statusesRef = useRef(statuses)
  const missionRef = useRef(missionSelection)
  const selectedTargetRef = useRef(selectedTargetId)
  const inspectTargetRef = useRef(onInspectTarget)
  const gridRef = useRef(planningGrid)
  const gridSelectionRef = useRef(gridSelection)
  const gridPickRoleRef = useRef(gridPickRole)
  const pickCoordinateRef = useRef(onPickCoordinate)
  const [composition, setComposition] = useState<number | null>(null)
  const [stageMessage, setStageMessage] = useState('Approaching Jezero')
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    preferencesRef.current = visibility
    statusesRef.current = statuses
    missionRef.current = missionSelection
    selectedTargetRef.current = selectedTargetId
    inspectTargetRef.current = onInspectTarget
    gridRef.current = planningGrid
    gridSelectionRef.current = gridSelection
    gridPickRoleRef.current = gridPickRole
    pickCoordinateRef.current = onPickCoordinate
  }, [visibility, statuses, missionSelection, selectedTargetId, onInspectTarget, planningGrid, gridSelection, gridPickRole, onPickCoordinate])
  useEffect(() => {
    const player = createAnimationPlayer()
    playerRef.current = player
    return () => { player.dispose(); playerRef.current = null }
  }, [])

  const send = useCallback(function dispatch(event: ExplorerEvent) {
    const previous = stateRef.current
    const next = transitionExplorer(previous, event)
    if (next === previous) return
    // Prepare the destination before opacity changes. No globe coordinate is transferred.
    if (next.phase === 'entering-map' && previous.phase === 'overview') {
      setComposition(0)
      mapRef.current?.enterContext(!visitedMap.current, MAP_ENTRY_ZOOM)
      visitedMap.current = true
    }
    if (next.phase === 'entering-overview' && previous.phase === 'map') setComposition(1)
    stateRef.current = next
    setState(next)
    if (next.phase === 'entering-map' && previous.phase === 'overview' && viewRef.current) {
      dispatch({ type: 'map-zoom', value: viewRef.current.zoom, overviewAvailable: globeStatusRef.current.phase === 'ready' })
    }
    if ((event.type === 'settled' || event.type === 'interrupt') && next.phase === 'map' && viewRef.current) {
      dispatch({ type: 'map-zoom', value: viewRef.current.zoom, overviewAvailable: globeStatusRef.current.phase === 'ready' })
    }
  }, [])

  const finishTransition = useCallback(() => {
    playerRef.current?.cancel()
    globeRef.current?.endApproach()
    mapRef.current?.setDetailOpacity(1)
    setComposition(null)
    send({ type: 'settled', phase: stateRef.current.phase })
  }, [send])

  const arriveDirect = useCallback((message: string | null = null, focusWorkspace = true) => {
    if (!mapRef.current) { setNotice('The map could not start. Reload to retry; the overview remains available.'); return }
    playerRef.current?.cancel()
    globeRef.current?.endApproach()
    if (!isTransitioning(stateRef.current)) send({ type: 'fly-jezero' })
    mapRef.current.focusJezero()
    mapRef.current.setDetailOpacity(1)
    visitedMap.current = true
    setComposition(null)
    setNotice(message)
    send({ type: 'interrupt', destination: 'map' })
    if (focusWorkspace) workspaceRef.current?.focus({ preventScroll: true })
  }, [send])

  const cancelTransition = useCallback((message: string | null = null) => {
    playerRef.current?.cancel()
    globeRef.current?.endApproach()
    const destination = stateRef.current.phase === 'entering-overview' || globeStatusRef.current.phase !== 'ready' ? 'map' : 'overview'
    if (destination === 'overview') globeRef.current?.retreat()
    mapRef.current?.setDetailOpacity(1)
    setComposition(null)
    setNotice(message)
    send({ type: 'interrupt', destination })
    workspaceRef.current?.focus({ preventScroll: true })
  }, [send])

  const skipTransition = useCallback(() => {
    if (stateRef.current.phase === 'flying-to-jezero') arriveDirect()
    else {
      if (stateRef.current.phase === 'entering-overview') globeRef.current?.retreat()
      finishTransition()
      workspaceRef.current?.focus({ preventScroll: true })
    }
  }, [arriveDirect, finishTransition])

  const exploreJezero = useCallback(() => {
    if (isTransitioning(stateRef.current) || playerRef.current?.isRunning()) return
    const map = mapRef.current
    const globeController = globeRef.current
    if (!map) { setNotice('The map could not start. Reload to retry.'); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { arriveDirect(); return }
    if (globeStatusRef.current.phase === 'loading') { setNotice('The NASA overview is still preparing. Open the map directly while it loads.'); return }
    if (!globeController || globeStatusRef.current.phase !== 'ready') { arriveDirect('The 3D overview is unavailable. Jezero is open directly in the real map.'); return }
    const fromMap = stateRef.current.phase === 'map'
    setNotice(null)
    setComposition(fromMap ? 1 : 0)
    setStageMessage('Approaching Jezero')
    map.setActive(false)
    globeController.setActive(false)
    send({ type: 'fly-jezero' })
    visitedMap.current = true
    playerRef.current?.start(createJezeroStages({
      map, globe: globeController, fromMap, blend: setComposition, onStage: setStageMessage,
      preferences: () => preferencesRef.current, statuses: () => statusesRef.current,
      onContextTimeout: () => cancelTransition('Map imagery could not be confirmed in time. Retry the layers in Mission control, or open Jezero directly.'),
      onDetailTimeout: () => { finishTransition(); setNotice('Jezero is centered, but CTX detail could not be confirmed in time. Check Sources & status and retry CTX.'); },
    }), { onComplete: finishTransition, onError: () => arriveDirect('The animated approach was interrupted. Jezero is open in the real map.') })
    workspaceRef.current?.focus({ preventScroll: true })
  }, [arriveDirect, cancelTransition, finishTransition, send])

  useEffect(() => {
    if (!mapHostRef.current) return
    let mounted = true
    try {
      mapRef.current = createMarsMap(mapHostRef.current, onStatus, (next) => {
        if (!mounted) return
        viewRef.current = next
        setView(next)
        send({ type: 'map-zoom', value: next.zoom, overviewAvailable: globeStatusRef.current.phase === 'ready' })
      }, { keyboard: false, onInspectTarget: (id) => inspectTargetRef.current(id), onPickCoordinate: (coordinate) => { if (gridPickRoleRef.current && mapRef.current?.hasRenderedImagery('controlledCtx')) pickCoordinateRef.current(coordinate) }, onControlledImageryReady: (ready) => { if (mounted) setControlledImageryReady(ready) } })
      // A retained map state must also initialize a replacement controller.
      const current = stateRef.current
      mapRef.current.setActive(current.phase === 'map')
      const initialVisibility = explorerLayerVisibility(preferencesRef.current, current.phase !== 'overview', current.localDetail, { ctx: statusesRef.current.ctx.coverage, controlledCtx: statusesRef.current.controlledCtx.coverage })
      mapRef.current.setVisibility(initialVisibility)
      mapRef.current.setMissionFeatures(SCIENCE_TARGETS, missionRef.current, selectedTargetRef.current)
      mapRef.current.setGridOverlay(gridRef.current ? terrainGridBounds(gridRef.current) : null, gridEndpoints(gridSelectionRef.current))
    } catch {
      queueMicrotask(() => { if (mounted) setMapError('The map renderer could not start. The NASA overview remains available; reload to retry the map.') })
    }
    return () => { mounted = false; mapRef.current?.dispose(); mapRef.current = null }
  }, [onStatus, send])

  useEffect(() => {
    mapRef.current?.setMissionFeatures(SCIENCE_TARGETS, missionSelection, selectedTargetId)
  }, [missionSelection, selectedTargetId])
  useEffect(() => {
    mapRef.current?.setGridOverlay(planningGrid ? terrainGridBounds(planningGrid) : null, gridEndpoints(gridSelection))
  }, [planningGrid, gridSelection])
  useEffect(() => {
    if (!gridFocusRequest || !gridRef.current || !mapRef.current) return
    arriveDirect('Planning crop opened. Grid endpoints are hypothetical native-cell choices.')
    mapRef.current.focusGrid(terrainGridBounds(gridRef.current))
  }, [gridFocusRequest, arriveDirect])
  useEffect(() => {
    if (centerPickRequest && gridPickRoleRef.current) mapRef.current?.pickViewCenter()
  }, [centerPickRequest])

  useEffect(() => {
    if (!focusRequest) return
    const target = targetById(focusRequest.id)
    if (!target || !mapRef.current) return
    // Feature inspection uses its documented display reference, never a globe pick.
    arriveDirect(null, focusRequest.focusWorkspace)
    mapRef.current.focusReference(target)
  }, [focusRequest, arriveDirect])

  useEffect(() => {
    let mounted = true
    const report = (next: GlobeStatus) => {
      if (!mounted) return
      globeStatusRef.current = next
      setGlobe(next)
      if (next.phase === 'error' && stateRef.current.phase === 'flying-to-jezero') arriveDirect('The 3D overview was interrupted. Jezero remains available in the real map.')
      else if (next.phase === 'error' && isTransitioning(stateRef.current)) cancelTransition('The overview was interrupted. The real map remains available.')
    }
    void import('../../features/globe/createMarsGlobe').then(({ createMarsGlobe }) => {
      if (!mounted || !globeHostRef.current) return
      globeRef.current = createMarsGlobe(globeHostRef.current, report, (distance) => send({ type: 'globe-distance', value: distance }))
      globeRef.current.setActive(stateRef.current.phase === 'overview')
    }).catch(() => report({ phase: 'error', message: 'The 3D overview could not start. WebGL 2 and a connection are required. Retry or continue to the real map.' }))
    return () => { mounted = false; globeRef.current?.dispose(); globeRef.current = null }
  }, [globeAttempt, send, arriveDirect, cancelTransition])

  const mapShown = composition === null ? mapIsShown(state) : composition >= 0.5
  const paneOpacities = explorerPaneOpacities(state, composition)
  const transitioning = isTransitioning(state)
  // Keep the outgoing map image through its fade; stop tile rendering once overview settles.
  const effective = explorerLayerVisibility(visibility, state.phase !== 'overview', state.localDetail, { ctx: statuses.ctx.coverage, controlledCtx: statuses.controlledCtx.coverage })
  useEffect(() => { mapRef.current?.setVisibility({ mola: effective.mola, ctx: effective.ctx, controlledCtx: effective.controlledCtx }) }, [effective.mola, effective.ctx, effective.controlledCtx])
  useEffect(() => { if (retryRequest) mapRef.current?.retry(retryRequest.id) }, [retryRequest])
  useEffect(() => {
    globeRef.current?.setActive(state.phase === 'overview')
    mapRef.current?.setActive(state.phase === 'map')
    if (state.phase !== 'entering-map' && state.phase !== 'entering-overview') return
    const player = playerRef.current
    if (!player) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const controller = globeRef.current
    if (state.phase === 'entering-overview' && controller && globeStatusRef.current.phase === 'ready') {
      player.start(createReturnStages({ globe: controller, blend: setComposition, onStage: setStageMessage, reducedMotion: reduced }), { onComplete: finishTransition, onError: () => cancelTransition('The overview could not resume. The map remains available.') })
    } else {
      const destinationOpacity = state.phase === 'entering-map' ? 1 : 0
      setStageMessage(destinationOpacity ? 'Loading the real map context' : 'Returning to the overview')
      player.start([
        { durationMs: 0, onFrame: () => {}, ready: reduced || !destinationOpacity ? undefined : () => contextCanOpenWithoutImagery(preferencesRef.current, stateRef.current.localDetail, { ctx: statusesRef.current.ctx.coverage, controlledCtx: statusesRef.current.controlledCtx.coverage }) || !!mapRef.current?.hasRenderedImagery(), timeoutMs: 8000, onTimeout: () => cancelTransition('Map imagery could not be confirmed. Retry the selected layers, or open Jezero directly.') },
        { durationMs: reduced ? 0 : HANDOFF_MS, onFrame: (p) => setComposition(destinationOpacity ? easeInOut(p) : 1 - easeInOut(p)) },
      ], { onComplete: finishTransition, onError: () => cancelTransition('The transition was interrupted. Retry the map or overview.') })
    }
    return () => player.cancel()
  }, [state.phase, finishTransition, cancelTransition])
  useEffect(() => {
    if (!transitioning) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reduceMotion = () => { if (media.matches) skipTransition() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) { event.preventDefault(); cancelTransition() } }
    media.addEventListener('change', reduceMotion)
    window.addEventListener('keydown', escape)
    return () => { media.removeEventListener('change', reduceMotion); window.removeEventListener('keydown', escape) }
  }, [transitioning, skipTransition, cancelTransition])
  useEffect(() => { onSummary({ phase: state.phase, mapShown, localDetail: state.localDetail, globe, controlledImageryReady }) }, [state.phase, mapShown, state.localDetail, globe, controlledImageryReady, onSummary])
  useEffect(() => {
    if (jezeroRequest) exploreJezero()
  }, [jezeroRequest, exploreJezero])

  const busy = MARS_LAYERS.some((layer) => effective[layer.id] && (statuses[layer.id].phase === 'checking' || statuses[layer.id].pending > 0))
  const mapMessage = mapError ?? explorerViewportMessage(visibility, effective, statuses, state.localDetail)
  const canNavigate = !transitioning && (mapShown ? !!view && !mapError : globe.phase === 'ready')
  const move = (horizontal: number, vertical: number) => { if (canNavigate) { if (mapShown) mapRef.current?.panBy(horizontal, vertical); else globeRef.current?.rotate(horizontal * 0.2, vertical * 0.2) } }
  const zoom = (delta: number) => { if (canNavigate) { if (mapShown) mapRef.current?.zoomBy(delta); else globeRef.current?.zoom(delta > 0 ? 1 / 1.2 : 1.2) } }
  const retryGlobe = () => { setGlobe(initialExplorerSummary.globe); globeStatusRef.current = initialExplorerSummary.globe; setGlobeAttempt((value) => value + 1) }
  const resetView = () => { onNavigate(); if (mapShown) mapRef.current?.focusJezero(); else globeRef.current?.reset() }
  const flightHelp = transitioning ? 'An exploration transition is in progress.' : mapError ? 'The map could not start. Reload to retry.' : globe.phase === 'loading' ? 'The NASA overview is preparing. Open the map directly while it loads.' : globe.phase === 'error' ? 'The NASA overview is unavailable. Open the map directly or retry the overview.' : 'Start the scripted visual approach to the published approximate Jezero crater center.'

  return (
    <section className="map-viewport explorer-viewport" data-grid="false" data-feedback={!!notice || (mapShown && !!mapMessage)} aria-labelledby="explorer-heading">
      <div className="viewport-top map-toolbar explorer-toolbar">
        <div className="viewport-label"><h1 id="explorer-heading">{mapShown ? 'Mars map' : 'Mars'}</h1><span className="exploration-stage">{mapShown ? (state.localDetail ? 'Local imagery' : 'Regional context') : 'Visual model · orientation unverified'}</span></div>
        <div className="explorer-view-actions">
          <button className="grid-button fly-jezero-button" type="button" title={flightHelp} aria-describedby="flight-help" disabled={transitioning || !!mapError || globe.phase !== 'ready'} onClick={onJezero}><Icon name="orbit" size={17} />Fly to Jezero</button>
          <button className="grid-button view-reset" type="button" title={mapShown ? 'Center the map on approximate Jezero (Home)' : 'Restore the initial globe view (Home)'} disabled={!canNavigate} onClick={resetView}>Reset view</button>
        </div>
        <span id="flight-help" className="sr-only">{flightHelp}</span>
      </div>
      <div id="explorer-workspace" ref={workspaceRef} className="explorer-surface" tabIndex={0} role="region" aria-label="Interactive Mars explorer" aria-describedby="explorer-help handoff-limit" onPointerDown={(event) => { if (!(event.target as HTMLElement).closest('button,a')) event.currentTarget.focus({ preventScroll: true }) }} onKeyDown={(event) => {
        if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || !canNavigate) return
        const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
        if (directions[event.key]) { event.preventDefault(); move(...directions[event.key]) }
        if (event.key === 'Enter' && gridPickRole && mapShown) { event.preventDefault(); mapRef.current?.pickViewCenter() }
        if (['+', '=', '-', 'Home'].includes(event.key)) { event.preventDefault(); if (event.key === 'Home') { onNavigate(); if (mapShown) mapRef.current?.focusJezero(); else globeRef.current?.reset() } else zoom(event.key === '-' ? -1 : 1) }
      }}>
        <div className="explorer-pane globe-pane" data-visible={!mapShown} style={{ opacity: paneOpacities.globe }} aria-hidden={mapShown} inert={state.phase !== 'overview'}><div className="globe-host" ref={globeHostRef} /></div>
        <div className="explorer-pane map-pane" data-visible={mapShown} style={{ opacity: paneOpacities.map }} aria-hidden={!mapShown} inert={state.phase !== 'map'}><div className="ol-host" ref={mapHostRef} /></div>
        {!mapShown && globe.phase !== 'ready' && <div className="globe-message" role="status">
          <Icon name="orbit" size={30} /><p>{globe.message}</p>
          {globe.phase === 'error' && <button type="button" className="grid-button" onClick={retryGlobe}>Retry overview</button>}
          <button type="button" className="grid-button" disabled={transitioning} onClick={() => { onNavigate(); send({ type: 'enter-map' }) }}>Open map directly</button>
        </div>}
        {mapShown && mapMessage && <div className="map-message reference-map-message" role="status"><p>{mapMessage}</p></div>}
        {mapShown && busy && !mapMessage && <div className="map-loading" role="status">Loading NASA Mars Trek imagery…</div>}
        {mapShown && gridPickRole && <div className="grid-pick-status"><p role="status">{gridPickNotice ?? `Picking grid ${gridPickRole}: click inside the boundary, or pan and press Enter to use the map center.`}</p><button className="grid-button" type="button" onClick={onNavigate}>Cancel map picking</button></div>}
        {transitioning && <div className="handoff-status flight-status">
          <div><p role="status">{stageMessage}</p><span>Scripted visual approach · approximate crater navigation</span></div>
          <div className="flight-actions"><button type="button" className="grid-button" onClick={skipTransition}>Skip animation</button><button type="button" className="grid-button" onClick={() => cancelTransition()}>Cancel</button></div>
        </div>}
        <div className="map-credit">{mapShown ? 'NASA/JPL-Caltech Mars Trek · MGS/MOLA · MRO/CTX' : 'Visual model: NASA/JPL-Caltech'}</div>
      </div>
      {notice && <div className="explorer-notice"><p role="status">{notice}</p><div>{!mapShown && <button className="grid-button" type="button" onClick={() => arriveDirect()}>Open Jezero map</button>}<button className="grid-button" type="button" onClick={() => setNotice(null)}>Dismiss</button></div></div>}
      <div className="explorer-navigation">
        <div className="globe-actions" role="group" aria-label={mapShown ? 'Map navigation' : 'Overview navigation'}>
          {([[-1, 0, '←', 'left'], [1, 0, '→', 'right'], [0, -1, '↑', 'up'], [0, 1, '↓', 'down']] as const).map(([x, y, label, direction]) => <button key={direction} type="button" title={`${mapShown ? 'Pan map' : 'Rotate globe'} ${direction}`} disabled={!canNavigate} aria-label={`${mapShown ? 'Pan map' : 'Rotate globe'} ${direction}`} onClick={() => move(x, y)}>{label}</button>)}
          <button type="button" title="Zoom in (+)" disabled={!canNavigate || (mapShown && !view?.canZoomIn)} aria-label="Zoom in" onClick={() => zoom(1)}>+</button>
          <button type="button" title="Zoom out (−)" disabled={!canNavigate || (mapShown && !view?.canZoomOut)} aria-label="Zoom out" onClick={() => zoom(-1)}>−</button>
        </div>
        {mapShown && <button className="grid-button" type="button" disabled={transitioning} onClick={() => { onNavigate(); send({ type: 'enter-overview' }) }}>Return to overview</button>}
      </div>
      {mapShown && view && !gridPickRole && !notice && !mapMessage && !busy && <div className="map-position"><span>Service grid center</span><span>{`${view.center[0].toFixed(3)}° lon, ${view.center[1].toFixed(3)}° lat`}</span></div>}
      <details className="viewport-guide">
      <summary><Icon name="info" size={16} />Navigation & limitations</summary>
      <div className="viewport-guide-content">
      <div className="feature-legend" aria-label="Feature marker legend">
        <span><b>O</b> Reference origin</span><span><b>D</b> Reference destination</span><span><b>◇</b> Reference</span>
        <p>Approximate feature centers · imagery registration unverified{!mapShown ? ' · markers appear on the regional map' : ''}</p>
        {planningGrid && <><span><b>G-O</b> Grid origin</span><span><b>G-D</b> Grid destination</span><p>Outline: prototype terrain crop · hypothetical native cells · shown with controlled CTX</p></>}
      </div>
      <div className="viewport-bottom map-help">
        <p id="explorer-help">Drag to {mapShown ? 'pan' : 'rotate'}; scroll or pinch to zoom. Arrow keys and + / − work with focus here. Home resets the view. Zoom {mapShown ? 'out for the overview; in near Jezero for CTX detail' : 'in to continue to the real map; the first handoff enters Jezero, later handoffs resume the map area'}. The visual globe does not support geographic picking.</p>
        <p id="handoff-limit">The globe approach is scripted, not geographically registered. Jezero uses the <a href={JEZERO_NAVIGATION.sourceUrl} target="_blank" rel="noreferrer">published approximate crater center</a>, not a precise science target. Images and geometry are not numerical elevation.</p>
        {mapShown && globe.phase === 'loading' && <p>The overview is preparing; its approach action will become available when ready. Home centers Jezero directly.</p>}
        {mapShown && globe.phase === 'error' && <p className="source-warning">Overview unavailable. Zoom stays on the map; use Return to overview to retry.</p>}
      </div>
      </div>
      </details>
      {mapShown && <p className="viewport-qualification">Approximate feature locations · registration unverified</p>}
    </section>
  )
}
