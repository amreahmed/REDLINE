import { Icon } from '../shared/Icon'
import { MARS_LAYERS } from '../../data/marsLayers'
import { layerStatusLabel } from '../../features/map/types'
import type { LayerId, LayerStatuses, LayerVisibility } from '../../features/map/types'
import type { ExplorerSummary } from '../../features/explorer/types'
import type { ReactNode } from 'react'

export type MissionSection = 'explore' | 'layers' | 'plan'

type MissionControlProps = {
  explorer: ExplorerSummary
  onJezero: () => void
  visibility: LayerVisibility
  statuses: LayerStatuses
  onToggle: (id: LayerId) => void
  onRetry: (id: LayerId) => void
  missionPlanner: ReactNode
  activeSection: MissionSection
  onSectionChange: (section: MissionSection) => void
  onClose: () => void
}

export function MissionControl({ explorer, onJezero, visibility, statuses, onToggle, onRetry, missionPlanner, activeSection, onSectionChange, onClose }: MissionControlProps) {
  return (
    <aside id="mission-control" className="panel mission-sidebar" aria-labelledby="mission-heading">
      <div className="panel-heading flex items-center justify-between gap-3">
        <div><h2 id="mission-heading">Mission control</h2><p className="panel-subtitle">Explore with evidence</p></div>
        <button className="icon-button" type="button" aria-label="Close mission control" onClick={onClose}><Icon name="close" size={20} /></button>
      </div>
      <nav className="mission-tabs" aria-label="Mission control sections">
        {(['explore', 'layers', 'plan'] as const).map((section) => <button key={section} type="button" className="mission-tab" aria-pressed={activeSection === section} aria-controls={`mission-${section}-section`} onClick={() => onSectionChange(section)}><Icon name={section === 'explore' ? 'orbit' : section === 'layers' ? 'layers' : 'pin'} size={17} />{section === 'explore' ? 'Explore' : section === 'layers' ? 'Layers' : 'Plan'}</button>)}
      </nav>
      <div className="mission-sections">
      <div id="mission-explore-section" className="mission-section-content" hidden={activeSection !== 'explore'}>
      <section className="panel-section region-section" aria-labelledby="region-heading">
        <div className="section-title flex items-center justify-between">
          <h3 id="region-heading">Exploration destination</h3>
          <Icon name="pin" />
        </div>
        <p className="region-name">Jezero crater</p>
        <p className="helper">Explore the Perseverance region through NASA imagery and sourced science references.</p>
        <button className="open-region-button" type="button" disabled={explorer.globe.phase === 'loading' || explorer.phase === 'entering-map' || explorer.phase === 'entering-overview' || explorer.phase === 'flying-to-jezero'} onClick={onJezero}>{explorer.mapShown ? 'Jezero detail' : 'Explore Jezero'}</button>
        {explorer.globe.phase === 'loading' && <p className="helper">The NASA overview is preparing. Map context remains available while it loads.</p>}
        <p className="source-warning region-qualification">The approach is scripted. Globe orientation is unvalidated; the map opens at the published approximate crater center.</p>
      </section>
      <section className="panel-section mission-objective" aria-labelledby="objective-heading">
        <h3 id="objective-heading">Your exploration journey</h3>
        <p className="helper">Inspect the evidence, then choose hypothetical mission endpoints.</p>
        <ol className="mission-journey">
          <li><button type="button" onClick={() => onSectionChange('layers')}><Icon name="layers" /><span><strong>Inspect map layers</strong><span>Check imagery, coverage and availability.</span></span><Icon name="arrow" size={16} /></button></li>
          <li><button type="button" onClick={() => onSectionChange('plan')}><Icon name="pin" /><span><strong>Plan a mission</strong><span>Choose grid cells or approximate references.</span></span><Icon name="arrow" size={16} /></button></li>
          <li className="journey-pending"><Icon name="lock" /><span><strong>Compare routes</strong><span>Unavailable until science and routing are validated.</span></span></li>
        </ol>
      </section>
      </div>
      <div id="mission-layers-section" className="mission-section-content" hidden={activeSection !== 'layers'}>
      <section className="panel-section" aria-labelledby="layers-heading">
        <div className="section-title flex items-center justify-between">
          <h3 id="layers-heading">Map layers</h3>
          <Icon name="layers" />
        </div>
        <p id="layers-note" className="helper mb-4">MOLA shows regional context. CTX imagery appears at local zoom within its footprint.</p>
        <div className="layer-list">
          {MARS_LAYERS.map((layer) => {
            const status = statuses[layer.id]
            const hasError = status.phase === 'unavailable' || status.failed > 0 || status.missing > 0
            return (
              <div key={layer.id} className="map-layer-control">
                <label className="layer-row map-layer-row flex items-start gap-3">
                  <input type="checkbox" checked={visibility[layer.id]} onChange={() => onToggle(layer.id)} aria-describedby={`${layer.id}-status`} aria-label={layer.name} />
                  <span><span className="layer-name">{layer.name}</span><span className="layer-description">{layer.description}</span></span>
                </label>
                <p id={`${layer.id}-status`} className="layer-status" data-warning={hasError || status.coverage !== 'inside'} role="status">{!visibility[layer.id] ? 'Hidden by you' : status.phase === 'checking' ? 'Checking service metadata' : status.phase === 'unavailable' ? 'Service unavailable' : !explorer.mapShown ? 'Selected for map exploration' : status.coverage === 'outside' ? 'Outside coverage' : layer.id !== 'mola' && !explorer.localDetail ? 'Zoom closer to Jezero for CTX detail' : layerStatusLabel(status, true)}</p>
                {visibility[layer.id] && status.enlarged && <p className="helper layer-enlarged">Enlarged beyond native tile detail.</p>}
                {hasError && <button className="retry-button" type="button" onClick={() => onRetry(layer.id)} disabled={status.phase === 'checking'}>Retry {layer.id === 'controlledCtx' ? 'controlled CTX' : layer.id === 'ctx' ? 'CTX' : 'MOLA'}</button>}
              </div>
            )
          })}
        </div>
        <details className="layer-guidance"><summary>How the layers work</summary><p className="helper">Controlled CTX supports the planning crop and draws above preliminary CTX when both are selected. All map layers are rendered images, separate from numerical terrain. Source details include resolution, coordinate qualifications and attribution.</p></details>
      </section>
      <div className="sidebar-footnote flex items-start gap-2">
        <Icon name="info" size={16} className="shrink-0" />
        <p>Coverage boxes do not guarantee complete imagery. Missing or failed tiles are never replaced with simulated data.</p>
      </div>
      </div>
      <div id="mission-plan-section" className="mission-section-content" hidden={activeSection !== 'plan'}>
        {missionPlanner}
        <section className="panel-section route-prerequisites" aria-labelledby="route-prerequisites-heading">
          <h3 id="route-prerequisites-heading">Route comparison</h3>
          <button type="button" className="route-unavailable" disabled aria-describedby="route-data-note"><Icon name="lock" size={16} />Compare routes — unavailable</button>
          <p className="helper" id="route-data-note">Endpoints can be selected. Routes require the following work before comparison is available:</p>
          <ul><li>Scientific feature registration</li><li>Elevation height-reference validation</li><li>Distance, slope and terrain-cost validation</li><li>Pathfinding implementation and tests</li></ul>
          <p className="source-warning">No route, hazard or astronaut-safety results are calculated.</p>
        </section>
      </div>
      </div>
    </aside>
  )
}
