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
import { FeaturePlanner } from '../components/mission/FeaturePlanner'
import { GridPlanner } from '../components/mission/GridPlanner'
import { useGridPlanning } from '../features/mission/useGridPlanning'
import type { ExplorerSummary } from '../features/explorer/types'
import { initialWorkspacePanels, workspacePanels } from './workspacePanels'

export default function App() {
  const [explorer, setExplorer] = useState(initialExplorerSummary)
  const [jezeroRequest, setJezeroRequest] = useState(0)
  const [panels, dispatchPanel] = useReducer(workspacePanels, initialWorkspacePanels)
  const navigationRef = useRef<HTMLElement>(null)
  const controlsOpen = panels.panel === 'mission'
  const informationOpen = panels.panel === 'sources'
  const openSources = useCallback(() => dispatchPanel({ type: 'sources' }), [])
  const revealSources = useCallback(() => {
    // Inspection always reveals its context, including when sources are already open.
    dispatchPanel({ type: 'close' })
    dispatchPanel({ type: 'sources' })
  }, [])
  const closePanel = useCallback(() => {
    dispatchPanel({ type: 'close' })
    navigationRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus()
  }, [])
  const [visibility, setVisibility] = useState<LayerVisibility>({ mola: true, ctx: true, controlledCtx: false })
  const [statuses, setStatuses] = useState<LayerStatuses>({ mola: initialLayerStatus(), ctx: initialLayerStatus(), controlledCtx: initialLayerStatus() })
  const [retryRequest, setRetryRequest] = useState<{ id: LayerId; sequence: number } | null>(null)
  const [missionSelection, setMissionSelection] = useState(initialMissionSelection)
  const [selectedTargetId, setSelectedTargetId] = useState<TargetId | null>(null)
  const [focusRequest, setFocusRequest] = useState<{ id: TargetId; sequence: number; focusWorkspace: boolean } | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const planning = useGridPlanning()
  const [gridFocusRequest, setGridFocusRequest] = useState(0)
  const [centerPickRequest, setCenterPickRequest] = useState(0)
  const canPick = planning.terrain.phase === 'ready' && visibility.controlledCtx && explorer.phase === 'map' && explorer.localDetail && statuses.controlledCtx.phase === 'available' && statuses.controlledCtx.coverage !== 'outside' && explorer.controlledImageryReady
  const cancelGridPick = planning.cancelPick
  const planningNavigation = useRef(0)
  const cancelPlanningNavigation = useCallback(() => { planningNavigation.current += 1; cancelGridPick() }, [cancelGridPick])
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
  const openJezero = () => { cancelPlanningNavigation(); setJezeroRequest((value) => value + 1) }
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

  return (
    <div className="app-shell">
      <a className="skip-link" href="#explorer-workspace">Skip to workspace</a>
      <header className="app-header flex items-center justify-between gap-4">
        <div className="brand-group flex items-center gap-4">
          <div className="brand flex items-center gap-3"><span className="brand-mark"><Icon name="orbit" size={29} /></span><span>REDLINE</span></div>
          <span className="brand-divider" />
          <div className="header-location"><span>{explorer.mapShown ? 'Mars / Regional map' : 'Mars'}</span><span>{mode}</span></div>
        </div>
        <div className="header-actions flex items-center gap-4">
          <span className="preview-badge">Exploration prototype</span>
          <AboutDialog />
        </div>
      </header>
      <div className="exploration-layout">
        <nav ref={navigationRef} className="workspace-rail" aria-label="Exploration tools">
          {([['explore', 'orbit', 'Explore'], ['layers', 'layers', 'Layers'], ['plan', 'pin', 'Plan']] as const).map(([section, icon, label]) => <button key={section} type="button" className="rail-button" title={label === 'Plan' ? 'Choose hypothetical mission endpoints' : label} aria-expanded={controlsOpen && panels.section === section} aria-controls="mission-control" onClick={() => dispatchPanel({ type: 'mission', section })}><Icon name={icon} size={22} /><span>{label}</span></button>)}
          <button type="button" className="rail-button sources-rail-button" title="Sources and scientific status" aria-expanded={informationOpen} aria-controls="information-panel" onClick={openSources}><Icon name="info" size={22} /><span>Sources</span></button>
        </nav>
      <main className="workspace" data-panel={panels.panel ?? 'none'} data-picking={planning.pickRole !== null}>
        <div className="controls-slot" hidden={!controlsOpen}><MissionControl activeSection={panels.section} onClose={closePanel} explorer={explorer} visibility={visibility} statuses={statuses} onToggle={toggleLayer} onRetry={retryLayer} missionPlanner={<>
          <GridPlanner terrain={planning.terrain} selection={planning.selection} pickRole={planning.pickRole} notice={planning.notice} canPick={canPick} onOpen={() => void openPlanning()} onAssign={(role, row, column) => { if (canPick) planning.assign(role, row, column) }} onBeginPick={(role) => { if (canPick) { planning.beginPick(role); if (window.matchMedia('(max-width: 640px)').matches) { dispatchPanel({ type: 'close' }); document.getElementById('explorer-workspace')?.focus({ preventScroll: true }) } } }} onUseCenter={() => { if (canPick) setCenterPickRequest((value) => value + 1) }} onCancel={cancelGridPick} onSwap={planning.swap} onClear={planning.clear} />
          <FeaturePlanner targets={SCIENCE_TARGETS} selection={missionSelection} selectedId={selectedTargetId} error={selectionError} onInspect={inspectTarget} onAssign={selectEndpoint} onSwap={swap} onClear={clear} />
        </>} /></div>
        <MarsExplorer visibility={visibility} statuses={statuses} retryRequest={retryRequest} jezeroRequest={jezeroRequest} onJezero={openJezero} onStatus={onStatus} onSummary={onSummary} missionSelection={missionSelection} selectedTargetId={selectedTargetId} focusRequest={focusRequest} onInspectTarget={inspectTarget} planningGrid={planning.terrain.phase === 'ready' ? planning.terrain.grid : null} gridSelection={planning.selection} gridFocusRequest={gridFocusRequest} centerPickRequest={centerPickRequest} gridPickRole={canPick ? planning.pickRole : null} gridPickNotice={planning.notice} onPickCoordinate={(coordinate) => { if (canPick) planning.pickCoordinate(coordinate) }} onNavigate={cancelPlanningNavigation} />
        <div className="information-slot" hidden={!informationOpen}><InformationPanel onClose={closePanel} explorer={explorer} visibility={visibility} statuses={statuses} target={targetById(selectedTargetId)} inspectionSequence={focusRequest?.sequence ?? 0} planningGrid={planning.terrain.phase === 'ready' ? planning.terrain.grid : undefined} /></div>
      </main>
      </div>
      <MissionStatusBar terrain={planning.terrain} />
    </div>
  )
}
