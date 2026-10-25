import { useState } from 'react'
import { AboutDialog } from '../components/layout/AboutDialog'
import { InformationPanel } from '../components/layout/InformationPanel'
import { MissionControl } from '../components/layout/MissionControl'
import { MapPlaceholder } from '../components/map/MapPlaceholder'
import { Icon } from '../components/shared/Icon'

export default function App() {
  const [controlsOpen, setControlsOpen] = useState(true)
  const [informationOpen, setInformationOpen] = useState(true)
  const [showGrid, setShowGrid] = useState(true)

  return (
    <div className="app-shell">
      <a className="skip-link" href="#map-workspace">Skip to workspace</a>
      <header className="app-header flex items-center justify-between gap-4">
        <div className="brand-group flex items-center gap-4">
          <div className="brand flex items-center gap-3"><span className="brand-mark"><Icon name="orbit" size={29} /></span><span>REDLINE</span></div>
          <span className="brand-divider" />
          <p className="brand-caption">Mars mission workspace</p>
        </div>
        <div className="header-actions flex items-center gap-4">
          <span className="preview-badge">Foundation preview</span>
          <AboutDialog />
        </div>
      </header>
      <div className="workspace-bar flex items-center justify-between gap-4">
        <div className="workspace-title flex items-center gap-3"><Icon name="map" size={18} /><span>Workspace</span><span className="workspace-slash">/</span><span className="mission-name">Untitled mission</span></div>
        <div className="panel-actions flex items-center gap-2" role="group" aria-label="Panel visibility">
          <button className="panel-toggle flex items-center gap-2" type="button" aria-expanded={controlsOpen} aria-controls="mission-control" onClick={() => setControlsOpen(!controlsOpen)}>
            <Icon name="panel-left" size={17} /><span>Mission control</span>
          </button>
          <button className="panel-toggle flex items-center gap-2" type="button" aria-expanded={informationOpen} aria-controls="information-panel" onClick={() => setInformationOpen(!informationOpen)}>
            <Icon name="panel-right" size={17} /><span>Information</span>
          </button>
        </div>
      </div>
      <main className="workspace" data-controls-open={controlsOpen} data-information-open={informationOpen}>
        <div className="controls-slot" hidden={!controlsOpen}><MissionControl /></div>
        <MapPlaceholder showGrid={showGrid} onToggleGrid={() => setShowGrid(!showGrid)} />
        <div className="information-slot" hidden={!informationOpen}><InformationPanel /></div>
      </main>
      <footer className="app-footer flex items-center justify-between gap-4">
        <span>Independent exploration prototype</span>
        <span className="flex items-center gap-2"><span className="status-dot" />No sources connected</span>
        <span className="version-label">REDLINE v0.1</span>
      </footer>
    </div>
  )
}
