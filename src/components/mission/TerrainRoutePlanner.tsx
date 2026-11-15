import { useState } from 'react'
import type { useTerrainRouting } from '../../features/routing/useTerrainRouting'
import { terrainModelReport } from '../../features/routing/terrainModelReport'
import type { TerrainProfile } from '../../features/terrain/modelTypes'
import type { TerrainOverlayMode } from '../../features/map/terrainModelOverlay'

type Routing = ReturnType<typeof useTerrainRouting>
type NumericProfileKey = Exclude<keyof TerrainProfile, 'unknownPolicy'>
const fields: readonly { key: NumericProfileKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'maxUphillDeg', label: 'Uphill limit (°)', min: 0.01, max: 89, step: 0.01 },
  { key: 'maxDownhillDeg', label: 'Downhill limit (°)', min: 0.01, max: 89, step: 0.01 },
  { key: 'maxRoughnessM', label: 'Roughness limit (m)', min: 0.01, max: 1000, step: 0.01 },
  { key: 'roughnessRadiusM', label: 'Neighborhood radius (m)', min: 1, max: 250, step: 1 },
  { key: 'highCostFraction', label: 'High-cost fraction', min: 0.01, max: 1, step: 0.01 },
  { key: 'unknownCostMultiplier', label: 'Unknown cost multiplier', min: 1, max: 1000, step: 1 },
  { key: 'uphillWeight', label: 'Uphill penalty weight', min: 0, max: 100, step: 0.5 },
  { key: 'downhillWeight', label: 'Downhill penalty weight', min: 0, max: 100, step: 0.5 },
  { key: 'slopeWeight', label: 'Gradient penalty weight', min: 0, max: 100, step: 0.5 },
  { key: 'roughnessWeight', label: 'Roughness penalty weight', min: 0, max: 100, step: 0.5 },
]
const distance = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${value.toFixed(1)} m`
const metric = (value: number | null, units: string) => value === null ? 'Unknown support' : `${value.toFixed(2)} ${units}`

export function TerrainRoutePlanner({ routing, onShowMap }: { routing: Routing; onShowMap: () => void }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(fields.map(field => [field.key, String(routing.profile[field.key])])) as Record<NumericProfileKey, string>)
  const [unknownPolicy, setUnknownPolicy] = useState(routing.profile.unknownPolicy)
  const [profileNotice, setProfileNotice] = useState<string | null>(null)
  const busy = routing.state.phase === 'loading'
  const selectedRoute = routing.state.phase === 'ready' ? routing.state.comparison[routing.selected] : null
  let rangeLabel: string | null = null
  if (routing.analysis && !['none', 'traversability', 'explored'].includes(routing.overlay)) {
    const values = routing.overlay === 'elevation' ? routing.analysis.grid.values : routing.overlay === 'slope' ? routing.analysis.slopeDeg : routing.overlay === 'roughness' ? routing.analysis.roughnessM : routing.analysis.shapeM
    let min = Infinity, max = -Infinity
    for (let node = 0; node < values.length; node++) if (routing.analysis.grid.valid[node] && Number.isFinite(values[node])) { min = Math.min(min, values[node]); max = Math.max(max, values[node]) }
    rangeLabel = Number.isFinite(min) ? `${min.toFixed(2)} to ${max.toFixed(2)} ${routing.overlay === 'slope' ? '°' : 'm'}` : 'No supported values'
  }
  const apply = () => {
    try {
      const next = Object.fromEntries(fields.map(field => [field.key, draft[field.key].trim() ? Number(draft[field.key]) : NaN])) as Record<NumericProfileKey, number>
      routing.applyProfile({ ...next, unknownPolicy }); setProfileNotice('Rover assumptions applied. Recalculate to compare routes.')
    } catch (error) { setProfileNotice(error instanceof Error ? error.message : 'Check the profile values.') }
  }
  const download = () => {
    if (!routing.analysis) return
    const report = terrainModelReport(routing.analysis, routing.state.phase === 'ready' ? routing.state.comparison : null)
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'REDLINE-HRSC-terrain-model.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="panel-section terrain-model-planner" aria-labelledby="terrain-model-heading">
    <div className="scientific-summary-line"><h3 id="terrain-model-heading">HRSC terrain model</h3><span className="status-label" data-status="partial">Qualified model</span></div>
    <p className="helper">Compare distance and terrain cost using a separate native Mars Express DEM. Your selected grid endpoints are retained.</p>
    <p className="context-qualification" id="terrain-model-note">Hypothetical DEM-based model. Physical traversability and human safety are not validated.</p>
    <button type="button" className="open-region-button" disabled={routing.data.phase === 'loading' || busy} onClick={() => void routing.load()}>{routing.data.phase === 'loading' ? 'Verifying HRSC DEM…' : routing.data.phase === 'error' ? 'Retry HRSC DEM' : routing.data.phase === 'ready' ? 'Reload HRSC DEM' : 'Load HRSC DEM'}</button>
    {routing.data.phase === 'loading' && <p className="helper" role="status">Verifying source metadata, native samples and validity mask.</p>}
    {routing.data.phase === 'error' && <p className="source-warning" role="alert">{routing.data.reason}</p>}
    {routing.analysis && <>
      <p className="source-state" role="status">103 × 103 native cells · 50 m projected spacing · HMC_13E10_DT5</p>
      <details className="selection-guidance"><summary>Hypothetical rover assumptions</summary>
        <p className="helper">Limits are user assumptions, not tested rover specifications. Roughness is local height standard deviation and includes broad terrain grade.</p>
        <div className="terrain-profile-fields">{fields.map(field => <div key={field.key}><label className="field-label" htmlFor={`terrain-${field.key}`}>{field.label}</label><input id={`terrain-${field.key}`} type="number" min={field.min} max={field.max} step={field.step} value={draft[field.key]} onChange={event => setDraft(previous => ({ ...previous, [field.key]: event.target.value }))} /></div>)}</div>
        <label className="field-label" htmlFor="terrain-unknown-policy">Incomplete metric support</label>
        <select id="terrain-unknown-policy" value={unknownPolicy} onChange={event => setUnknownPolicy(event.target.value as TerrainProfile['unknownPolicy'])}><option value="block">Block unknown support (default)</option><option value="penalize">Allow with explicit unknown penalty</option></select>
        <p className="helper">Missing or nonfinite heights are always excluded. Allowed unknown-support segments retain unknown terrain statistics.</p>
        <p className="helper">Step-height constraints and obstacle detection are unavailable at this DEM resolution.</p>
        <button type="button" className="grid-button" onClick={apply}>Apply rover assumptions</button>
        {profileNotice && <p className="helper" role="status">{profileNotice}</p>}
      </details>
      <details className="selection-guidance"><summary>Endpoint mapping & coverage</summary>
        <p className="helper">CTX longitude/latitude selects the containing HRSC cell. Routing uses that HRSC native center. This snap does not establish absolute feature registration.</p>
        {(['originPoint', 'destinationPoint'] as const).map((key, index) => <p className="helper" key={key}>{index === 0 ? 'HRSC origin' : 'HRSC destination'}: {routing[key] ? `row ${routing[key]!.row}, column ${routing[key]!.column}; ${routing[key]!.lon.toFixed(6)}°E, ${routing[key]!.lat.toFixed(6)}°N` : 'Choose a covered endpoint above.'}</p>)}
        <p className="helper">The optional waypoint above, when set, constrains both comparisons.</p>
      </details>
      <label className="field-label" htmlFor="terrain-overlay">Terrain overlay</label>
      <select id="terrain-overlay" value={routing.overlay} onChange={event => routing.setOverlay(event.target.value as TerrainOverlayMode)}>
        <option value="none">Imagery only</option><option value="elevation">Provider sphere-relative height</option><option value="slope">DEM gradient (°)</option><option value="roughness">Local roughness (m)</option><option value="shape">Local shape difference (m)</option><option value="traversability">Model traversability</option><option value="explored" disabled={!selectedRoute}>A* expanded cells</option>
      </select>
      {routing.overlay === 'traversability' ? <div className="terrain-legend" aria-label="Model traversability legend">{['Unknown', 'Traversable', 'High cost', 'Blocked'].map((label, index) => <span key={label}><i className={`terrain-swatch terrain-state-${index}`} aria-hidden="true" />{label}</span>)}</div> : routing.overlay !== 'none' && <p className="helper terrain-raster-key">{routing.overlay === 'explored' ? 'Blue cells: expanded by the selected search.' : `Blue to warm: ${rangeLabel}. Gray: unknown. One raster pixel per native cell.`}</p>}
      <div className="endpoint-actions"><button type="button" className="grid-button" aria-pressed={routing.visible} onClick={() => routing.setVisible(!routing.visible)}>{routing.visible ? 'Hide HRSC model' : 'Show HRSC model'}</button><button type="button" className="grid-button" onClick={onShowMap}>Show terrain on map</button></div>
      <button type="button" className="open-region-button" disabled={!!routing.blocker || busy} aria-describedby="terrain-model-note" onClick={() => void routing.calculate()}>{busy ? 'Comparing DEM routes…' : routing.state.phase === 'error' ? 'Retry DEM route comparison' : 'Compare DEM routes'}</button>
      {routing.blocker && <p className="helper">{routing.blocker}</p>}
      {busy && <div className="endpoint-actions"><p className="helper" role="status">Searching terrain costs in a background worker.</p><button type="button" className="grid-button" onClick={routing.cancel}>Cancel DEM comparison</button></div>}
      {routing.state.phase === 'error' && <p className="source-warning" role="alert">{routing.state.reason}</p>}
      {routing.state.phase === 'ready' && <>
        <div className="route-options" role="group" aria-label="Select HRSC model route">{(['distance', 'terrain'] as const).map(role => {
          const route = routing.state.phase === 'ready' ? routing.state.comparison[role] : null
          return route && <button type="button" className="route-option" key={role} aria-pressed={routing.selected === role} onClick={() => routing.selectRoute(role)}><span className={`route-line-key ${role === 'terrain' ? 'route-line-key-via' : ''}`} aria-hidden="true" /><span><strong>{role === 'terrain' ? 'Lower terrain cost' : 'Shortest permitted distance'}</strong><span>{distance(route.horizontalDistanceM)} · {route.accumulatedCostM.toFixed(1)} cost-m</span></span></button>
        })}</div>
        <p className="helper">Both routes use the same allowed cells and rover limits. Terrain cost optimizes the supported penalties; equal paths are possible when a detour offers no advantage.</p>
      </>}
      {selectedRoute && <dl className="terrain-route-metrics">
        <dt>Horizontal distance</dt><dd>{distance(selectedRoute.horizontalDistanceM)}</dd><dt>Accumulated model cost</dt><dd>{selectedRoute.accumulatedCostM.toFixed(1)} cost-m</dd>
        <dt>Maximum edge grade</dt><dd>{metric(selectedRoute.maxGradeDeg, '°')}</dd><dt>Mean absolute edge grade</dt><dd>{metric(selectedRoute.meanAbsGradeDeg, '°')}</dd>
        <dt>Maximum / mean DEM gradient</dt><dd>{metric(selectedRoute.maxSlopeDeg, '°')} / {metric(selectedRoute.meanSlopeDeg, '°')}</dd>
        <dt>Maximum / mean roughness</dt><dd>{metric(selectedRoute.maxRoughnessM, 'm')} / {metric(selectedRoute.meanRoughnessM, 'm')}</dd>
        <dt>Cell visits / expanded cells</dt><dd>{selectedRoute.nodes.length} / {selectedRoute.exploredNodes.length}</dd><dt>Blocked / unknown search cells</dt><dd>{selectedRoute.blockedSearchCells} / {selectedRoute.unknownSearchCells}</dd><dt>Unknown-support segments</dt><dd>{selectedRoute.unknownSegments}</dd>
      </dl>}
      <p className="helper">Cost-m means cost-equivalent metres, a hypothetical preference score. It is not energy, travel time or safety. Grades are provider DEM estimates relative to a sphere.</p>
      <details className="selection-guidance"><summary>Scientific details, source & cost model</summary>
        <p className="helper">{routing.analysis.grid.source.qualification}</p>
        <p className="helper">DT5 heights are metres above a 3,396,000 m sphere. Central differences use actual source-sphere ground baselines. Standard deviation uses the configured circular neighborhood; local shape is center height minus neighborhood mean, not curvature.</p>
        <p className="helper">Cost = distance × (1 + normalized uphill, downhill, gradient and roughness penalties). Each normalized term is multiplied by its displayed weight. A* uses eight neighbors, restricted diagonal flanks and a distance lower bound.</p>
        <p className="helper">50 m spacing and 1 m quantization do not establish effective resolution or per-cell measurement quality. Physical slopes, calibrated terrain costs, hazards, named-feature placement and safety remain unverified. HRSC does not resolve the CTX height conflict.</p>
        <dl className="source-facts"><dt>Product</dt><dd>HMC_13E10_DT5</dd><dt>Native raster SHA-256</dt><dd className="source-id">{routing.analysis.grid.source.gridHash}</dd><dt>Source evidence SHA-256</dt><dd className="source-id">{routing.analysis.grid.source.sourceHash}</dd></dl>
        <div className="source-links"><a href="https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_dt5.tif" target="_blank" rel="noreferrer">Original HRSC DEM</a><a href="https://hrscteam.dlr.de/imprint_hrsc_en.php" target="_blank" rel="noreferrer">HRSC terms & attribution</a></div>
      </details>
      <button type="button" className="grid-button" onClick={download}>Export DEM model report</button>
      <p className="source-credit">{routing.analysis.grid.source.attribution}</p>
    </>}
  </section>
}
