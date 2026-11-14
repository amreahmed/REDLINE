import { useState } from 'react'
import { Icon } from '../shared/Icon'
import type { EndpointRole } from '../../features/mission/types'
import type { GridSelection } from '../../features/mission/gridSelection'
import type { PlanningTerrainState } from '../../features/mission/useGridPlanning'
import { GridMetrics } from './GridMetrics'

type Props = {
  terrain: PlanningTerrainState
  selection: GridSelection
  pickRole: EndpointRole | null
  notice: string | null
  canPick: boolean
  onOpen: () => void
  onAssign: (role: EndpointRole, row: number, column: number) => void
  onBeginPick: (role: EndpointRole) => void
  onUseCenter: () => void
  onCancel: () => void
  onSwap: () => void
  onClear: () => void
}

export function GridPlanner({ terrain, selection, pickRole, notice, canPick, onOpen, onAssign, onBeginPick, onUseCenter, onCancel, onSwap, onClear }: Props) {
  const [row, setRow] = useState('714')
  const [column, setColumn] = useState('650')
  const ready = terrain.phase === 'ready'
  const hasEndpoints = selection.origin !== null || selection.destination !== null
  return (
    <section className="panel-section grid-planner" aria-labelledby="grid-planning-heading">
      <div className="planner-heading"><Icon name="grid" size={20} /><div><h3 id="grid-planning-heading">Terrain planning workspace</h3><p className="planner-subtitle">Hypothetical mission endpoints</p></div></div>
      <p className="helper">Choose native cells in the Belva-area crop, with controlled CTX imagery for context.</p>
      <button className="open-region-button" type="button" disabled={terrain.phase === 'loading'} onClick={onOpen}>{terrain.phase === 'loading' ? 'Checking planning terrain…' : terrain.phase === 'error' ? 'Retry planning terrain' : ready ? 'Show planning terrain' : 'Open planning terrain'}</button>
      {terrain.phase === 'loading' && <p role="status" className="helper">Loading and verifying the native grid and its source metadata.</p>}
      {terrain.phase === 'error' && <p role="alert" className="source-warning">{terrain.message}</p>}
      {ready && <>
        <p className="source-state terrain-ready-status">256 × 256 native cells · {terrain.grid.manifest.summary.validCount.toLocaleString()} valid · {terrain.grid.manifest.summary.missingCount.toLocaleString()} missing</p>
        <details className="selection-guidance"><summary>What a grid selection means</summary><p className="helper">The boundary is a prototype crop choice. Selection uses the containing 20 m projected cell and reports its native center, with no interpolation. Controlled imagery and numerical terrain share the documented source frame; this does not establish absolute landmark accuracy.</p></details>
        <div className="grid-cell-fields">
          <div>
          <label className="field-label" htmlFor="grid-row">Native row (586–841)</label>
          <input id="grid-row" type="number" min={586} max={841} step={1} value={row} onChange={(event) => setRow(event.target.value)} />
          </div><div>
          <label className="field-label" htmlFor="grid-column">Native column (522–777)</label>
          <input id="grid-column" type="number" min={522} max={777} step={1} value={column} onChange={(event) => setColumn(event.target.value)} />
          </div>
        </div>
        {(['origin', 'destination'] as const).map((role) => <div className="grid-endpoint" key={role}>
          <h4><span className="endpoint-symbol" aria-hidden="true">{role === 'origin' ? '△' : '⬡'}</span>{role === 'origin' ? 'Grid origin · G-O' : 'Grid destination · G-D'}</h4>
          {selection[role] ? <p className="helper">Row {selection[role].row}, column {selection[role].column}<br />Native center: {selection[role].lon.toFixed(6)}°E, {selection[role].lat.toFixed(6)}°N</p> : <p className="helper">No {role} cell selected.</p>}
          <div className="endpoint-actions">
            <button type="button" className="grid-button" disabled={!canPick} onClick={() => onAssign(role, row.trim() ? Number(row) : NaN, column.trim() ? Number(column) : NaN)}>Set grid {role}</button>
            <button type="button" className="grid-button" disabled={!canPick} aria-pressed={pickRole === role} onClick={() => onBeginPick(role)}>Pick {role} on map</button>
          </div>
        </div>)}
        {!canPick && <p className="source-warning">Endpoint picking requires the loaded grid and available controlled CTX at local map zoom. Show planning terrain or retry the controlled imagery.</p>}
        {pickRole && <div className="grid-pick-actions"><p className="helper">Picking {pickRole}. Pan with arrow keys; Enter in the map selects its center.</p><button type="button" className="grid-button" disabled={!canPick} onClick={onUseCenter}>Use map center</button><button type="button" className="grid-button" onClick={onCancel}>Cancel grid picking</button></div>}
        <div className="endpoint-actions"><button className="grid-button" type="button" disabled={!hasEndpoints} onClick={onSwap}>Swap grid endpoints</button><button className="grid-button" type="button" disabled={!hasEndpoints} onClick={onClear}>Clear grid endpoints</button></div>
        <GridMetrics grid={terrain.grid} selection={selection} />
      </>}
      {notice && <p className="helper grid-notice" role="status">{notice}</p>}
      <p className="context-qualification">Hypothetical native-cell endpoints · distance-only planning</p>
    </section>
  )
}
