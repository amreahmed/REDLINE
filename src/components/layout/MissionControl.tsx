import { Icon } from '../shared/Icon'
import { MARS_LAYERS } from '../../data/marsLayers'
import { layerStatusLabel } from '../../features/map/types'
import type { LayerId, LayerStatuses, LayerVisibility } from '../../features/map/types'
import type { ExplorerSummary } from '../../features/explorer/types'
import type { ReactNode } from 'react'

export type MissionSection = 'explore' | 'layers' | 'plan'

type MissionControlProps = {
  explorer: ExplorerSummary
  visibility: LayerVisibility
  statuses: LayerStatuses
  onToggle: (id: LayerId) => void
  onRetry: (id: LayerId) => void
  missionPlanner: ReactNode
  activeSection: MissionSection
  onClose: () => void
}

export function MissionControl({ explorer, visibility, statuses, onToggle, onRetry, missionPlanner, activeSection, onClose }: MissionControlProps) {
  const sectionHeading = activeSection === 'explore' ? 'Explore' : activeSection === 'layers' ? 'Map layers' : 'Mission endpoints'
  const transitionMessage = explorer.phase === 'flying-to-jezero' ? 'Flying to Jezero…' : explorer.phase === 'entering-map' ? 'Opening map context…' : explorer.phase === 'entering-overview' ? 'Returning to the Mars overview…' : null
  return (
    <aside id="mission-control" className="panel mission-sidebar" aria-labelledby="mission-heading">
      <div className="panel-heading flex items-center justify-between gap-3">
        <div><h2 id="mission-heading">{sectionHeading}</h2><p className="panel-subtitle">Mission control</p></div>
        <button className="icon-button" type="button" aria-label="Close mission control" onClick={onClose}><Icon name="close" size={20} /></button>
      </div>
      <div className="mission-sections">
      <div id="mission-explore-section" className="mission-section-content" hidden={activeSection !== 'explore'}>
      <section className="panel-section region-section" aria-labelledby="region-heading">
        <div className="section-title flex items-center justify-between">
          <h3 id="region-heading">Exploration destination</h3>
          <Icon name="pin" />
        </div>
        <p className="region-name">Jezero crater</p>
        <p className="helper">Explore the Perseverance region through NASA imagery and sourced science references.</p>
        <p className="helper exploration-next-step">Use <strong>Fly to Jezero</strong> in the viewport to open the region.</p>
        {transitionMessage ? <p className="source-state" role="status">{transitionMessage}</p> : explorer.globe.phase !== 'ready' ? <p className={explorer.globe.phase === 'error' ? 'source-warning' : 'source-state'} role="status">{explorer.globe.message}</p> : <p className="source-state" role="status">{explorer.mapShown ? explorer.localDetail ? 'Local map detail active.' : 'Regional map context active.' : 'NASA visual overview ready.'}</p>}
        <p className="source-warning region-qualification">The approach is scripted. Globe orientation is unvalidated; the map opens at the published approximate crater center.</p>
      </section>
      <section className="panel-section mission-objective" aria-labelledby="objective-heading">
        <h3 id="objective-heading">What to do next</h3>
        <ol className="mission-journey">
          <li className="journey-step"><Icon name="layers" /><span><strong>Inspect the evidence</strong><span>Open Layers to check imagery and coverage.</span></span></li>
          <li className="journey-step"><Icon name="pin" /><span><strong>Choose mission endpoints</strong><span>Open Plan for hypothetical grid cells or references.</span></span></li>
          <li className="journey-step"><Icon name="grid" /><span><strong>Compare hypothetical paths</strong><span>Open Plan for distance-only routing and an optional waypoint.</span></span></li>
        </ol>
      </section>
      </div>
      <div id="mission-layers-section" className="mission-section-content" hidden={activeSection !== 'layers'}>
      <section className="panel-section" aria-labelledby="layers-heading">
        <div className="section-title flex items-center justify-between">
          <h3 id="layers-heading">Imagery selection</h3>
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
      </div>
      </div>
    </aside>
  )
}
