import { useState } from 'react'
import type { useDistanceRouting } from '../../features/routing/useDistanceRouting'
import { DISTANCE_ONLY_QUALIFICATION } from '../shared/scientificCopy'

type Routing = ReturnType<typeof useDistanceRouting>
const distance = (value: number) => value >= 1000 ? `${(value / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} m`

export function RoutePlanner({ routing, onShowMap }: { routing: Routing; onShowMap: () => void }) {
  const [row, setRow] = useState('740')
  const [column, setColumn] = useState('700')
  const busy = routing.state.phase === 'loading'
  return <section className="panel-section route-planner" aria-labelledby="distance-route-heading">
    <h3 id="distance-route-heading">Hypothetical routes</h3>
    <p className="planner-subtitle">Distance-only grid model</p>
    <p className="helper">Find the shortest connected grid path. Add a waypoint to compare the distance of a visit you choose.</p>
    <details className="selection-guidance">
      <summary>Optional waypoint</summary>
      <p className="helper">Choose a valid native cell. This is your hypothetical visit, not a registered science target.</p>
      <div className="grid-cell-fields">
        <div><label className="field-label" htmlFor="route-waypoint-row">Waypoint row (586–841)</label><input id="route-waypoint-row" type="number" min={586} max={841} step={1} value={row} onChange={event => setRow(event.target.value)} /></div>
        <div><label className="field-label" htmlFor="route-waypoint-column">Waypoint column (522–777)</label><input id="route-waypoint-column" type="number" min={522} max={777} step={1} value={column} onChange={event => setColumn(event.target.value)} /></div>
      </div>
      <div className="endpoint-actions"><button type="button" className="grid-button" disabled={busy} onClick={() => routing.assignWaypoint(row.trim() ? Number(row) : NaN, column.trim() ? Number(column) : NaN)}>Set waypoint</button><button type="button" className="grid-button" disabled={busy || !routing.waypoint} onClick={routing.clearWaypoint}>Clear waypoint</button></div>
      {routing.waypointNotice && <p className="helper" role="status">{routing.waypointNotice}</p>}
    </details>
    {routing.waypoint && <p className="helper">Waypoint W: row {routing.waypoint.row}, column {routing.waypoint.column}</p>}
    <button type="button" className="open-region-button" disabled={!!routing.blocker || busy} aria-describedby="route-model-note" onClick={() => void routing.calculate()}>{busy ? 'Calculating grid paths…' : routing.state.phase === 'error' ? 'Retry hypothetical routes' : 'Calculate hypothetical routes'}</button>
    {routing.blocker && <p className="helper">{routing.blocker}</p>}
    {busy && <div className="endpoint-actions"><p className="helper" role="status">Searching native cell coverage in a background worker.</p><button type="button" className="grid-button" onClick={routing.cancel}>Cancel calculation</button></div>}
    {routing.state.phase === 'error' && <p className="source-warning" role="alert">{routing.state.reason}</p>}
    {routing.state.phase === 'idle' && !routing.blocker && <p className="helper" role="status">Ready to calculate. Changes to endpoints or waypoint clear previous results.</p>}
    {routing.state.phase === 'ready' && <>
      <div className="route-options" role="group" aria-label="Select hypothetical route">
        {routing.routes.map(route => <button className="route-option" type="button" key={route.id} aria-pressed={routing.selectedId === route.id} onClick={() => routing.selectRoute(route.id)}><span className={`route-line-key route-line-key-${route.id}`} aria-hidden="true" /><span><strong>{route.id === 'shortest' ? 'Shortest grid path' : 'Via your waypoint'}</strong><span>{distance(route.distanceM)} · {route.points.length.toLocaleString()} cell visits</span></span></button>)}
      </div>
      <p className="helper" role="status">{routing.routes.length === 1 ? 'Shortest grid path calculated. Add an optional waypoint for a distance comparison.' : `Both paths calculated. Visiting the waypoint adds ${distance(Math.max(0, routing.state.comparison.via!.distanceM - routing.state.comparison.shortest.distanceM))} in this model.`}</p>
      <button className="grid-button" type="button" onClick={onShowMap}>Show paths on map</button>
      <p className="helper">The selected path is emphasized on controlled CTX imagery.</p>
    </>}
    <p className="context-qualification" id="route-model-note">{DISTANCE_ONLY_QUALIFICATION}</p>
    <details className="selection-guidance"><summary>How this model works</summary><p className="helper">A* minimizes the sum of adjacent native-center distances on a 3,396,190 m Mars reference sphere. Eight-neighbor connections are hypothetical. Missing cells are excluded; diagonals require both flank cells. No elevation, slope, roughness or science score enters the cost.</p><p className="helper">A route through a waypoint is the shortest origin-to-waypoint path plus the shortest waypoint-to-destination path. It can revisit a cell. Grid paths may differ from a direct spherical arc.</p><p className="helper">Paths are calculated simulations, not recorded rover traverses. Valid data coverage does not prove traversability. Terrain-aware routing and precise named-feature routing are unavailable for this CTX source. The separate HRSC workflow below supports a qualified provider DEM model. Route scores are model outputs, not validated human-safety predictions.</p>{routing.routes[0] && <dl className="source-facts"><dt>Numerical source</dt><dd className="source-id">{routing.routes[0].sourceId}</dd><dt>Source SHA-256</dt><dd className="source-id">{routing.routes[0].sourceHash}</dd><dt>Grid SHA-256</dt><dd className="source-id">{routing.routes[0].gridHash}</dd></dl>}</details>
  </section>
}
