import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { AboutDialog } from '../components/layout/AboutDialog'
import { InformationPanel } from '../components/layout/InformationPanel'
import { MissionControl } from '../components/layout/MissionControl'
import { MissionStatusBar } from '../components/layout/MissionStatusBar'
import { MarsExplorer } from '../components/explorer/MarsExplorer'
import { initialExplorerSummary } from '../features/explorer/types'
import { Icon } from '../components/shared/Icon'
import { initialLayerStatus } from '../features/map/types'
import type { LayerId, LayerStatus, LayerStatuses, LayerVisibility } from '../features/map/types'
import { SCIENCE_TARGETS, targetById } from '../data/scienceTargets'
import { assignEndpoint, initialMissionSelection, swapEndpoints } from '../features/mission/selection'
import type { EndpointRole, TargetId } from '../features/mission/types'
import { MissionPlanningExperience } from '../components/mission/MissionPlanningExperience'
import { useGridPlanning } from '../features/mission/useGridPlanning'
import { useDistanceRouting } from '../features/routing/useDistanceRouting'
import { useTerrainRouting } from '../features/routing/useTerrainRouting'
import type { ExplorerSummary } from '../features/explorer/types'
import { initialWorkspacePanels, workspacePanels } from './workspacePanels'
import { globeLayerById } from '../data/globeLayers'
import type { GlobeLayerId } from '../data/globeLayers'
import { marsPoiById } from '../data/marsPois'
import type { MarsPoi } from '../data/marsPois'
import type { GeographicGlobeView } from '../features/globe/createGeographicMarsGlobe'
import type { GlobeMapImageryStatus } from '../features/map/globeMapImagery'
import type { GlobeFlyRequest, GlobeMode, PoiCategory } from '../features/globe/explorationTypes'
import { GlobeLayerControls, GlobeLocationControls } from '../components/explorer/GlobeControls'

export default function App() {
  const [explorer, setExplorer] = useState(initialExplorerSummary)
  const [jezeroRequest, setJezeroRequest] = useState(0)
  const [globeMode, setGlobeMode] = useState<GlobeMode>('imagery')
  const [globeLayerId, setGlobeLayerId] = useState<GlobeLayerId>('viking')
  const [globePoiId, setGlobePoiId] = useState<string | null>(null)
  const [poiCategory, setPoiCategory] = useState<PoiCategory>('all')
  const [globeView, setGlobeView] = useState<GeographicGlobeView | null>(null)
  const [mapImagery, setMapImagery] = useState<GlobeMapImageryStatus | null>(null)
  const [globeFlyRequest, setGlobeFlyRequest] = useState<GlobeFlyRequest | null>(null)
  const [globeMapRequest, setGlobeMapRequest] = useState(0)
  const [globeRetryRequest, setGlobeRetryRequest] = useState(0)
  const [panels, dispatchPanel] = useReducer(workspacePanels, initialWorkspacePanels)
  const navigationRef = useRef<HTMLElement>(null)
  const scienceReturnRef = useRef<HTMLElement | null>(null)
  const [scienceRequest, setScienceRequest] = useState(0)
  const controlsOpen = panels.panel === 'mission'
  const informationOpen = panels.panel === 'sources'
  const openSources = useCallback(() => { scienceReturnRef.current = null; dispatchPanel({ type: 'sources' }) }, [])
  const openMission = (section: 'explore' | 'layers' | 'plan') => { scienceReturnRef.current = null; dispatchPanel({ type: 'mission', section }) }
  const revealSources = useCallback(() => {
    // Inspection always reveals its context, including when sources are already open.
    scienceReturnRef.current = null
    dispatchPanel({ type: 'close' })
    dispatchPanel({ type: 'sources' })
  }, [])
  const closePanel = useCallback(() => {
    dispatchPanel({ type: 'close' })
    const returnTarget = scienceReturnRef.current ?? navigationRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')
    scienceReturnRef.current = null
    returnTarget?.focus()
  }, [])
  const [visibility, setVisibility] = useState<LayerVisibility>({ mola: true, ctx: true, controlledCtx: false })
  const [statuses, setStatuses] = useState<LayerStatuses>({ mola: initialLayerStatus(), ctx: initialLayerStatus(), controlledCtx: initialLayerStatus() })
  const [retryRequest, setRetryRequest] = useState<{ id: LayerId; sequence: number } | null>(null)
  const [missionSelection, setMissionSelection] = useState(initialMissionSelection)
  const [selectedTargetId, setSelectedTargetId] = useState<TargetId | null>(null)
  const [focusRequest, setFocusRequest] = useState<{ id: TargetId; sequence: number; focusWorkspace: boolean } | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const planning = useGridPlanning()
  const routing = useDistanceRouting(planning.terrain, planning.selection)
  const terrainRouting = useTerrainRouting(planning.selection, routing.waypointPoint)
  const [gridFocusRequest, setGridFocusRequest] = useState(0)
  const [centerPickRequest, setCenterPickRequest] = useState(0)
  const canPick = planning.terrain.phase === 'ready' && visibility.controlledCtx && explorer.phase === 'map' && explorer.localDetail && statuses.controlledCtx.phase === 'available' && statuses.controlledCtx.coverage !== 'outside' && explorer.controlledImageryReady
  const cancelGridPick = planning.cancelPick
  const revealScience = useCallback(() => {
    scienceReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelGridPick()
    dispatchPanel({ type: 'close' })
    dispatchPanel({ type: 'sources' })
    setScienceRequest(value => value + 1)
  }, [cancelGridPick])
  const planningNavigation = useRef(0)
  const cancelPlanningNavigation = useCallback(() => { planningNavigation.current += 1; cancelGridPick() }, [cancelGridPick])
  const onGlobeView = useCallback((value: GeographicGlobeView) => setGlobeView(value), [])
  const inspectGlobePoi = useCallback((id: string) => {
    if (!marsPoiById(id)) return
    cancelPlanningNavigation()
    setGlobePoiId(id)
    setSelectedTargetId(null)
    revealSources()
  }, [cancelPlanningNavigation, revealSources])
  const flyGlobePoi = (poi: MarsPoi) => { cancelPlanningNavigation(); setGlobePoiId(poi.id); setGlobeFlyRequest(previous => ({ coordinate: [poi.longitude, poi.latitude], sequence: (previous?.sequence ?? 0) + 1 })) }
  const selectGlobeLayer = (mode: GlobeMode, id: GlobeLayerId) => {
    cancelPlanningNavigation()
    setGlobeMode(mode)
    setGlobeLayerId(id)
    const layer = globeLayerById(id)
    if (mode === 'imagery' && layer.regionalLayerId) {
      setGlobeFlyRequest(previous => ({ coordinate: [77.69, 18.41], sequence: (previous?.sequence ?? 0) + 1 }))
    }
  }
  const prepareGeographicMap = useCallback((id: GlobeLayerId) => {
    const layer = globeLayerById(id)
    if (layer.regionalLayerId === 'mola' || !layer.regionalLayerId) {
      setVisibility((previous) => ({ ...previous, mola: true, ctx: true }))
    } else {
      setVisibility((previous) => ({ ...previous, mola: true, ctx: true, [layer.regionalLayerId!]: true }))
    }
  }, [])
  const globeWorkspace = { preferences: { mode: globeMode, layerId: globeLayerId, selectedPoiId: globePoiId, category: poiCategory }, view: explorer.mapShown ? null : globeView, mapImagery: explorer.mapShown && !globeLayerById(globeLayerId).regionalLayerId ? mapImagery : null }
  const onSummary = useCallback((summary: ExplorerSummary) => {
    setExplorer(summary)
    if (summary.phase !== 'map' || !summary.localDetail) cancelGridPick()
  }, [cancelGridPick])
  const onStatus = useCallback((id: LayerId, status: LayerStatus) => {
    setStatuses((previous) => ({ ...previous, [id]: status }))
    if (id === 'controlledCtx' && (status.phase === 'unavailable' || status.coverage === 'outside')) cancelGridPick()
  }, [cancelGridPick])
  const toggleLayer = (id: LayerId) => { cancelPlanningNavigation(); setVisibility((previous) => ({ ...previous, [id]: !previous[id] })) }
  const retryLayer = (id: LayerId) => setRetryRequest((previous) => ({ id, sequence: (previous?.sequence ?? 0) + 1 }))
  const openJezero = () => {
    cancelPlanningNavigation()
    setGlobeMode('imagery')
    setGlobeLayerId('mola')
    setVisibility((previous) => ({ ...previous, mola: true, ctx: true }))
    setJezeroRequest((value) => value + 1)
  }
  const openPlanning = async () => {
    cancelGridPick()
    const request = ++planningNavigation.current
    if (!await planning.load() || request !== planningNavigation.current) return
    setVisibility((previous) => ({ ...previous, controlledCtx: true }))
    setGridFocusRequest((value) => value + 1)
  }
  const inspectTarget = useCallback((id: TargetId) => {
    if (!targetById(id)) return
    cancelPlanningNavigation()
    setSelectedTargetId(id)
    revealSources()
    setFocusRequest((previous) => ({ id, sequence: (previous?.sequence ?? 0) + 1, focusWorkspace: true }))
  }, [cancelPlanningNavigation, revealSources])
  const selectEndpoint = (role: EndpointRole, id: string | null) => {
    cancelPlanningNavigation()
    const result = assignEndpoint(missionSelection, role, id, SCIENCE_TARGETS)
    setSelectionError(result.error)
    setMissionSelection(result.selection)
    if (!result.error && id) {
      const target = targetById(id)
      if (target) {
        setSelectedTargetId(target.id)
        setFocusRequest((previous) => ({ id: target.id, sequence: (previous?.sequence ?? 0) + 1, focusWorkspace: false }))
      }
    }
  }
  const swap = () => { setMissionSelection(swapEndpoints(missionSelection)); setSelectionError(null) }
  const clear = () => { setMissionSelection(initialMissionSelection); setSelectionError(null) }

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]') && !['entering-map', 'entering-overview', 'flying-to-jezero'].includes(explorer.phase) && !planning.pickRole && panels.panel) {
        event.preventDefault()
        closePanel()
      }
    }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [closePanel, explorer, panels.panel, planning.pickRole])

  const mode = explorer.mapShown ? explorer.localDetail ? 'Local detail' : 'Regional context' : 'Planet overview'
  const displayingTerrainRouteState = terrainRouting.visible && terrainRouting.state.phase !== 'idle'
  const activeRoutePhase = displayingTerrainRouteState ? terrainRouting.state.phase : routing.state.phase

  return (
    <div className="app-shell">
      <a className="skip-link" href="#explorer-workspace">Skip to workspace</a>
      <header className="app-header flex items-center justify-between gap-4">
        <div className="brand-group flex items-center gap-4">
          <div className="brand flex items-center gap-3">
            <span className="brand-mark"><Icon name="orbit" size={29} /></span>
            <span className="brand-wordmark"><span className="brand-red">RED</span><span className="brand-line">LINE</span></span>
          </div>
          <span className="brand-divider" />
          <div className="header-location"><span>{explorer.mapShown ? 'Mars / Regional map' : 'Mars'}</span><span>{mode}</span></div>
        </div>
        <div className="header-actions flex items-center gap-4">
          <span className="preview-badge">Exploration prototype</span>
          <AboutDialog onOpenScientificDetails={revealScience} />
        </div>
      </header>
      <div className="exploration-layout">
        <nav ref={navigationRef} className="workspace-rail" aria-label="Exploration tools">
          {([['explore', 'orbit', 'Explore'], ['layers', 'layers', 'Layers'], ['plan', 'pin', 'Plan']] as const).map(([section, icon, label]) => <button key={section} type="button" className="rail-button" title={label === 'Plan' ? 'Choose hypothetical mission endpoints' : label} aria-expanded={controlsOpen && panels.section === section} aria-controls="mission-control" onClick={() => openMission(section)}><Icon name={icon} size={22} /><span>{label}</span></button>)}
          <button type="button" className="rail-button sources-rail-button" title="Sources and scientific status" aria-expanded={informationOpen} aria-controls="information-panel" onClick={openSources}><Icon name="info" size={22} /><span>Sources</span></button>
        </nav>
      <main className="workspace" data-panel={panels.panel ?? 'none'} data-picking={planning.pickRole !== null}>
        <div className="controls-slot" hidden={!controlsOpen}><MissionControl activeSection={panels.section} onClose={closePanel} explorer={explorer} visibility={visibility} statuses={statuses} onToggle={toggleLayer} onRetry={retryLayer} globeLocations={<GlobeLocationControls workspace={globeWorkspace} onCategory={setPoiCategory} onInspect={inspectGlobePoi} onFly={flyGlobePoi} />} globeLayers={<GlobeLayerControls workspace={globeWorkspace} onSelect={selectGlobeLayer} onRetry={() => setGlobeRetryRequest(value => value + 1)} />} missionPlanner={
          <MissionPlanningExperience
            terrain={planning.terrain}
            gridSelection={planning.selection}
            pickRole={canPick ? planning.pickRole : null}
            gridNotice={planning.notice}
            canPick={canPick}
            onOpenPlanning={() => void openPlanning()}
            onAssignGridCell={(role, row, column) => {
              void planning.assign(role, row, column)
            }}
            onBeginPickRole={(role) => {
              if (canPick) {
                planning.beginPick(role)
                if (window.matchMedia('(max-width: 640px)').matches) {
                  dispatchPanel({ type: 'close' })
                  document.getElementById('explorer-workspace')?.focus({ preventScroll: true })
                }
              }
            }}
            onUseCenter={() => {
              if (canPick) setCenterPickRequest((value) => value + 1)
            }}
            onCancelPick={cancelGridPick}
            onSwapGridEndpoints={planning.swap}
            onClearGridEndpoints={planning.clear}
            distanceRouting={routing}
            terrainRouting={terrainRouting}
            targets={SCIENCE_TARGETS}
            missionSelection={missionSelection}
            selectedTargetId={selectedTargetId}
            selectionError={selectionError}
            onInspectTarget={inspectTarget}
            onAssignTarget={selectEndpoint}
            onSwapTargets={swap}
            onClearTargets={clear}
          />
        } /></div>
        <MarsExplorer visibility={visibility} statuses={statuses} retryRequest={retryRequest} jezeroRequest={jezeroRequest} onJezero={openJezero} onStatus={onStatus} onSummary={onSummary} missionSelection={missionSelection} selectedTargetId={selectedTargetId} focusRequest={focusRequest} onInspectTarget={inspectTarget} planningGrid={planning.terrain.phase === 'ready' ? planning.terrain.grid : null} gridSelection={planning.selection} gridFocusRequest={gridFocusRequest} centerPickRequest={centerPickRequest} gridPickRole={canPick ? planning.pickRole : null} gridPickNotice={planning.notice} onPickCoordinate={(coordinate) => { if (canPick) planning.pickCoordinate(coordinate) }} onNavigate={cancelPlanningNavigation} hypotheticalRoutes={routing.routes} selectedRouteId={routing.routes.length ? routing.selectedId : null} routeWaypoint={routing.waypointPoint} terrainModelDisplay={terrainRouting.display} globePreferences={globeWorkspace.preferences} globeFlyRequest={globeFlyRequest} globeMapRequest={globeMapRequest} globeRetryRequest={globeRetryRequest} onGlobeView={onGlobeView} onMapImageryStatus={setMapImagery} onGlobeInspect={inspectGlobePoi} onPrepareGeographicMap={prepareGeographicMap} onOpenGeographicMap={() => { cancelPlanningNavigation(); setGlobeMapRequest(value => value + 1) }} onToggleLayer={toggleLayer} onSelectGlobeLayer={selectGlobeLayer} onRetryLayer={retryLayer} onToggleTerrain={() => terrainRouting.setVisible(!terrainRouting.visible)} terrainOverlay={terrainRouting.overlay} onSelectTerrainOverlay={terrainRouting.setOverlay} />
        <div className="information-slot" hidden={!informationOpen}><InformationPanel onClose={closePanel} explorer={explorer} visibility={visibility} statuses={statuses} target={targetById(selectedTargetId)} inspectionSequence={focusRequest?.sequence ?? 0} scienceRequest={scienceRequest} planningGrid={planning.terrain.phase === 'ready' ? planning.terrain.grid : undefined} globeWorkspace={globeWorkspace} globePoi={marsPoiById(globePoiId)} onFlyGlobePoi={() => { const poi = marsPoiById(globePoiId); if (poi) flyGlobePoi(poi) }} /></div>
      </main>
      </div>
      <MissionStatusBar terrain={planning.terrain} routePhase={activeRoutePhase} routeKind={displayingTerrainRouteState ? 'hrsc-model' : 'distance-only'} activity={controlsOpen ? panels.section : informationOpen ? 'sources' : explorer.mapShown && activeRoutePhase !== 'idle' ? 'plan' : 'explore'} onOpenScientificDetails={revealScience} />
    </div>
  )
}
