import { Icon } from '../shared/Icon'
import { MARS_LAYERS } from '../../data/marsLayers'
import { layerStatusLabel } from '../../features/map/types'
import type { LayerId, LayerStatuses, LayerVisibility } from '../../features/map/types'
import type { ExplorerSummary } from '../../features/explorer/types'
import type { ReactNode } from 'react'

type MissionControlProps = { explorer: ExplorerSummary; onJezero: () => void; visibility: LayerVisibility; statuses: LayerStatuses; onToggle: (id: LayerId) => void; onRetry: (id: LayerId) => void; missionPlanner: ReactNode }

export function MissionControl({ explorer, onJezero, visibility, statuses, onToggle, onRetry, missionPlanner }: MissionControlProps) {
  return (
    <aside id="mission-control" className="panel mission-sidebar" aria-labelledby="mission-heading">
      <div className="panel-heading flex items-center gap-3">
        <Icon name="panel-left" />
        <h2 id="mission-heading">Mission control</h2>
      </div>
      <section className="panel-section" aria-labelledby="region-heading">
        <div className="section-title flex items-center justify-between">
          <h3 id="region-heading">Exploration destination</h3>
          <Icon name="pin" />
        </div>
        <p className="region-name">Jezero</p>
        <p className="helper">Take a scripted approach from the full Mars overview into real Jezero imagery.</p>
        <button className="open-region-button" type="button" disabled={explorer.globe.phase === 'loading' || explorer.phase === 'entering-map' || explorer.phase === 'entering-overview' || explorer.phase === 'flying-to-jezero'} onClick={onJezero}>{explorer.mapShown ? 'Jezero detail' : 'Explore Jezero'}</button>
        {explorer.globe.phase === 'loading' && <p className="helper">The NASA overview is preparing. Map context remains available while it loads.</p>}
        <p className="helper">The globe rotation is approximate. The map arrives at the published crater center; your layer choices stay selected.</p>
      </section>
      <section className="panel-section" aria-labelledby="layers-heading">
        <div className="section-title flex items-center justify-between">
          <h3 id="layers-heading">Map layers</h3>
          <Icon name="layers" />
        </div>
        <p id="layers-note" className="helper mb-4">MOLA provides the wider context. Selected CTX appears at local zoom inside its Jezero footprint. Your layer choices persist in the overview.</p>
        <div className="layer-list">
          {MARS_LAYERS.map((layer) => {
            const status = statuses[layer.id]
            const hasError = status.phase === 'unavailable' || status.failed > 0 || status.missing > 0
            return (
              <div key={layer.id} className="map-layer-control">
                <label className="layer-row map-layer-row flex items-start gap-3">
                  <input type="checkbox" checked={visibility[layer.id]} onChange={() => onToggle(layer.id)} aria-describedby={`${layer.id}-status`} />
                  <span><span className="layer-name">{layer.name}</span><span className="layer-description">{layer.description}</span></span>
                </label>
                <p id={`${layer.id}-status`} className="layer-status" data-warning={hasError || status.coverage !== 'inside'} role="status">{!visibility[layer.id] ? 'Hidden by you' : status.phase === 'checking' ? 'Checking service metadata' : status.phase === 'unavailable' ? 'Service unavailable' : !explorer.mapShown ? 'Selected for map exploration' : status.coverage === 'outside' ? 'Outside coverage' : layer.id === 'ctx' && !explorer.localDetail ? 'Zoom closer to Jezero for CTX detail' : layerStatusLabel(status, true)}</p>
                {visibility[layer.id] && status.enlarged && <p className="helper layer-enlarged">Enlarged beyond native tile detail.</p>}
                {hasError && <button className="retry-button" type="button" onClick={() => onRetry(layer.id)} disabled={status.phase === 'checking'}>Retry {layer.id === 'ctx' ? 'CTX' : 'MOLA'}</button>}
              </div>
            )
          })}
        </div>
      </section>
      {missionPlanner}
      <div className="sidebar-footnote flex items-start gap-2">
        <Icon name="info" size={16} className="shrink-0" />
        <p>Coverage boxes do not guarantee complete imagery. Missing or failed tiles are never replaced with simulated data.</p>
      </div>
    </aside>
  )
}
