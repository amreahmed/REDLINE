import type { PlanningTerrainState } from '../../features/mission/useGridPlanning'

export function MissionStatusBar({ terrain }: { terrain: PlanningTerrainState }) {
  const value = terrain.phase === 'ready' ? `${terrain.grid.manifest.summary.validCount.toLocaleString()} cells loaded` : terrain.phase === 'loading' ? 'Verifying…' : terrain.phase === 'error' ? 'Unavailable' : 'Not loaded'
  const guidance = terrain.phase === 'ready' ? 'Archived numerical terrain loaded. Source geometry verified; named-feature registration and height reference remain unresolved.' : terrain.phase === 'loading' ? 'Verifying the numerical terrain manifest and native cells.' : terrain.phase === 'error' ? 'Terrain could not load. Retry in Plan.' : 'Open Plan to load the numerical terrain.'
  return (
    <footer className="app-footer" aria-label="Mission status">
      <dl className="mission-status-list">
        <div className="terrain-load-status" data-phase={terrain.phase} role="status" title={guidance}><dt>Terrain data</dt><dd>{value}<span className="sr-only">. {guidance}</span></dd></div>
        <div className="validation-status" title="Native source geometry verified. Named-feature registration and elevation height reference unresolved."><dt>Scientific validation</dt><dd>Partial<span className="sr-only">. Source geometry verified; feature registration and height reference unresolved.</span></dd></div>
        <div className="route-status"><dt>Route comparison</dt><dd>Unavailable</dd></div>
      </dl>
    </footer>
  )
}
