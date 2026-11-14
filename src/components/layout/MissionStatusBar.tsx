import type { PlanningTerrainState } from '../../features/mission/useGridPlanning'
import { Icon } from '../shared/Icon'

export function MissionStatusBar({ terrain, routePhase = 'idle', activity = 'plan', onOpenScientificDetails }: { terrain: PlanningTerrainState; routePhase?: 'idle' | 'loading' | 'error' | 'ready'; activity?: 'explore' | 'layers' | 'plan' | 'sources'; onOpenScientificDetails: () => void }) {
  const value = terrain.phase === 'ready' ? `${terrain.grid.manifest.summary.validCount.toLocaleString()} cells loaded` : terrain.phase === 'loading' ? 'Verifying…' : terrain.phase === 'error' ? 'Unavailable' : 'Not loaded'
  const guidance = terrain.phase === 'ready' ? 'Archived numerical terrain loaded. Source-to-grid preservation verified.' : terrain.phase === 'loading' ? 'Verifying the numerical terrain manifest and native cells.' : terrain.phase === 'error' ? 'Terrain could not load. Retry in Plan.' : 'Open Plan to load the numerical terrain.'
  return (
    <footer className="app-footer" aria-label="Mission status">
      <button type="button" className="validation-status scientific-status-link" aria-label="Scientific validation: Partial. Open scientific details" aria-controls="scientific-details" onClick={onOpenScientificDetails}><span>Scientific validation:</span><strong>Partial</strong><Icon name="info" size={15} /></button>
      {activity === 'plan' && <dl className="mission-status-list">
        <div className="terrain-load-status" data-phase={terrain.phase} role="status" title={guidance}><dt>Terrain data</dt><dd>{value}<span className="sr-only">. {guidance}</span></dd></div>
        <div className="route-status" role="status"><dt>Hypothetical routes</dt><dd>{routePhase === 'ready' ? 'Calculated · distance only' : routePhase === 'loading' ? 'Calculating…' : routePhase === 'error' ? 'Calculation unavailable' : 'Not calculated'}</dd></div>
      </dl>}
    </footer>
  )
}
