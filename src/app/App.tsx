import { useCallback, useState } from 'react'
import { AboutDialog } from '../components/layout/AboutDialog'
import { InformationPanel } from '../components/layout/InformationPanel'
import { MissionControl } from '../components/layout/MissionControl'
import { MarsExplorer } from '../components/explorer/MarsExplorer'
import { initialExplorerSummary } from '../features/explorer/types'
import { Icon } from '../components/shared/Icon'
import { initialLayerStatus } from '../features/map/types'
import type { LayerId, LayerStatus, LayerStatuses, LayerVisibility } from '../features/map/types'
import { SCIENCE_TARGETS, targetById } from '../data/scienceTargets'
import { assignEndpoint, initialMissionSelection, swapEndpoints } from '../features/mission/selection'
import type { EndpointRole, TargetId } from '../features/mission/types'
import { FeaturePlanner } from '../components/mission/FeaturePlanner'

export default function App() {
  const [explorer, setExplorer] = useState(initialExplorerSummary)
  const [jezeroRequest, setJezeroRequest] = useState(0)
  const [controlsOpen, setControlsOpen] = useState(true)
  const [informationOpen, setInformationOpen] = useState(true)
  const [visibility, setVisibility] = useState<LayerVisibility>({ mola: true, ctx: true })
  const [statuses, setStatuses] = useState<LayerStatuses>({ mola: initialLayerStatus(), ctx: initialLayerStatus() })
  const [retryRequest, setRetryRequest] = useState<{ id: LayerId; sequence: number } | null>(null)
  const [missionSelection, setMissionSelection] = useState(initialMissionSelection)
  const [selectedTargetId, setSelectedTargetId] = useState<TargetId | null>(null)
  const [focusRequest, setFocusRequest] = useState<{ id: TargetId; sequence: number; focusWorkspace: boolean } | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const onStatus = useCallback((id: LayerId, status: LayerStatus) => setStatuses((previous) => ({ ...previous, [id]: status })), [])
  const toggleLayer = (id: LayerId) => setVisibility((previous) => ({ ...previous, [id]: !previous[id] }))
  const retryLayer = (id: LayerId) => setRetryRequest((previous) => ({ id, sequence: (previous?.sequence ?? 0) + 1 }))
  const openJezero = () => setJezeroRequest((value) => value + 1)
  const inspectTarget = useCallback((id: TargetId) => {
    if (!targetById(id)) return
    setSelectedTargetId(id)
    setInformationOpen(true)
    setFocusRequest((previous) => ({ id, sequence: (previous?.sequence ?? 0) + 1, focusWorkspace: true }))
  }, [])
  const selectEndpoint = (role: EndpointRole, id: string | null) => {
    const result = assignEndpoint(missionSelection, role, id, SCIENCE_TARGETS)
    setSelectionError(result.error)
    setMissionSelection(result.selection)
    if (!result.error && id) {
      const target = targetById(id)
      if (target) {
        setSelectedTargetId(target.id)
        setInformationOpen(true)
        setFocusRequest((previous) => ({ id: target.id, sequence: (previous?.sequence ?? 0) + 1, focusWorkspace: false }))
      }
    }
  }
  const swap = () => { setMissionSelection(swapEndpoints(missionSelection)); setSelectionError(null) }
  const clear = () => { setMissionSelection(initialMissionSelection); setSelectionError(null) }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#explorer-workspace">Skip to workspace</a>
      <header className="app-header flex items-center justify-between gap-4">
        <div className="brand-group flex items-center gap-4">
          <div className="brand flex items-center gap-3"><span className="brand-mark"><Icon name="orbit" size={29} /></span><span>REDLINE</span></div>
          <span className="brand-divider" />
          <p className="brand-caption">Mars mission workspace</p>
        </div>
        <div className="header-actions flex items-center gap-4">
          <span className="preview-badge">Mars preview</span>
          <AboutDialog />
        </div>
      </header>
      <div className="workspace-bar flex items-center justify-between gap-4">
        <div className="workspace-title flex items-center gap-3"><Icon name="orbit" size={18} /><span>Mars explorer</span><span className="workspace-slash">/</span><span className="mission-name">Overview to Jezero</span></div>
        <div className="panel-actions flex items-center gap-2" role="group" aria-label="Panel visibility">
          <button className="panel-toggle flex items-center gap-2" type="button" aria-expanded={controlsOpen} aria-controls="mission-control" onClick={() => setControlsOpen(!controlsOpen)}>
            <Icon name="panel-left" size={17} /><span>Mission control</span>
          </button>
          <button className="panel-toggle flex items-center gap-2" type="button" aria-expanded={informationOpen} aria-controls="information-panel" onClick={() => setInformationOpen(!informationOpen)}>
            <Icon name="panel-right" size={17} /><span>Sources & status</span>
          </button>
        </div>
      </div>
      <main className="workspace" data-controls-open={controlsOpen} data-information-open={informationOpen}>
        <div className="controls-slot" hidden={!controlsOpen}><MissionControl explorer={explorer} onJezero={openJezero} visibility={visibility} statuses={statuses} onToggle={toggleLayer} onRetry={retryLayer} missionPlanner={<FeaturePlanner targets={SCIENCE_TARGETS} selection={missionSelection} selectedId={selectedTargetId} error={selectionError} onInspect={inspectTarget} onAssign={selectEndpoint} onSwap={swap} onClear={clear} />} /></div>
        <MarsExplorer visibility={visibility} statuses={statuses} retryRequest={retryRequest} jezeroRequest={jezeroRequest} onStatus={onStatus} onSummary={setExplorer} missionSelection={missionSelection} selectedTargetId={selectedTargetId} focusRequest={focusRequest} onInspectTarget={inspectTarget} />
        <div className="information-slot" hidden={!informationOpen}><InformationPanel explorer={explorer} visibility={visibility} statuses={statuses} target={targetById(selectedTargetId)} inspectionSequence={focusRequest?.sequence ?? 0} /></div>
      </main>
      <footer className="app-footer flex items-center justify-between gap-4">
        <span>Independent exploration prototype</span>
        <span className="flex items-center gap-2"><span className="status-dot" />Archived imagery, not live observations</span>
        <span className="version-label">Unified explorer preview</span>
      </footer>
    </div>
  )
}
