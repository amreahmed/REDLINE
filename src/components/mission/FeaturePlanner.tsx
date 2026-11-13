import { useState } from 'react'
import type { EndpointRole, MissionSelection, ScienceTarget, TargetId } from '../../features/mission/types'

type Props = {
  targets: readonly ScienceTarget[]
  selection: MissionSelection
  selectedId: TargetId | null
  error: string | null
  onInspect: (id: TargetId) => void
  onAssign: (role: EndpointRole, id: string | null) => void
  onSwap: () => void
  onClear: () => void
}

export function FeaturePlanner({ targets, selection, selectedId, error, onInspect, onAssign, onSwap, onClear }: Props) {
  const [query, setQuery] = useState('')
  const matches = targets.filter((target) => target.name.toLowerCase().includes(query.trim().toLowerCase()))
  const hasEndpoints = selection.origin !== null || selection.destination !== null
  return (
    <section className="panel-section feature-planner" aria-labelledby="planning-heading">
      <h3 id="planning-heading">Feature references</h3>
      <p className="helper reference-qualification">Published approximate centers with NASA science context. Image registration is unverified; these are hypothetical endpoints.</p>
      <label className="field-label" htmlFor="reference-search">Search these three references</label>
      <input id="reference-search" type="search" placeholder="Jezero, Belva, Neretva" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="reference-list" aria-label="Supported feature references">
        {matches.map((target) => <button type="button" className="reference-button" key={target.id} aria-pressed={selectedId === target.id} onClick={() => onInspect(target.id)}>
          <span className="reference-symbol" aria-hidden="true">◇</span>
          <span><span className="reference-name">{target.name}</span><span className="reference-coordinate">{target.coordinate.lon.toFixed(2)}°E · {target.coordinate.lat.toFixed(2)}°N · approximate</span></span>
          <span className="reference-open">Inspect</span>
        </button>)}
        {matches.length === 0 && <p className="helper" role="status">No references match “{query.trim()}”. Try Jezero, Belva or Neretva.</p>}
      </div>
      <h4 className="endpoint-heading">Approximate reference endpoints</h4>
      {(['origin', 'destination'] as const).map((role) => <div className="endpoint-field" key={role}>
        <label className="field-label" htmlFor={`mission-${role}`}>{role === 'origin' ? 'Origin reference' : 'Destination reference'}</label>
        <select id={`mission-${role}`} value={selection[role] ?? ''} onChange={(event) => onAssign(role, event.target.value || null)} aria-describedby="endpoint-note">
          <option value="">Choose {role}</option>
          {targets.map((target) => <option key={target.id} value={target.id}>{target.name} (approximate center)</option>)}
        </select>
      </div>)}
      <p className="helper" id="endpoint-note">Choose different references. Markers show centers, not landing sites or rover sample locations.</p>
      {error && <p className="source-warning endpoint-error" role="alert">{error}</p>}
      <div className="endpoint-actions">
        <button type="button" className="grid-button" disabled={!hasEndpoints} onClick={onSwap}>Swap endpoints</button>
        <button type="button" className="grid-button" disabled={!hasEndpoints} onClick={onClear}>Clear endpoints</button>
      </div>
      <button type="button" className="route-unavailable" disabled aria-describedby="route-data-note">Calculate routes — unavailable</button>
      <p className="helper" id="route-data-note">The planning crop is numerical terrain. Physical distance, slope, terrain costs and route computation still require validation. Approximate reference centers are separate from grid endpoints; image colors are not elevation.</p>
    </section>
  )
}
