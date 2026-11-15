import { useEffect, useState } from 'react'
import type { EndpointRole, MissionSelection, ScienceTarget, TargetId } from '../../features/mission/types'
import type { GridSelection } from '../../features/mission/gridSelection'
import type { PlanningTerrainState } from '../../features/mission/useGridPlanning'
import type { useDistanceRouting } from '../../features/routing/useDistanceRouting'
import type { useTerrainRouting } from '../../features/routing/useTerrainRouting'
import type { TerrainProfile } from '../../features/terrain/modelTypes'
import type { TerrainOverlayMode } from '../../features/map/terrainModelOverlay'
import { terrainModelReport } from '../../features/routing/terrainModelReport'
import { useTravelTime } from '../../features/routing/useTravelTime'
import { travelTimeReport } from '../../features/routing/travelTimeReport'
import { TravelTimePanel } from './TravelTimePanel'
import { DISTANCE_ONLY_QUALIFICATION } from '../shared/scientificCopy'

type DistanceRouting = ReturnType<typeof useDistanceRouting>
type TerrainRouting = ReturnType<typeof useTerrainRouting>

export type MissionPlanningProps = {
  terrain: PlanningTerrainState
  gridSelection: GridSelection
  pickRole: EndpointRole | null
  gridNotice: string | null
  canPick: boolean
  onOpenPlanning: () => void
  onAssignGridCell: (role: EndpointRole, row: number, column: number) => void
  onBeginPickRole: (role: EndpointRole) => void
  onUseCenter: () => void
  onCancelPick: () => void
  onSwapGridEndpoints: () => void
  onClearGridEndpoints: () => void
  distanceRouting: DistanceRouting
  terrainRouting: TerrainRouting
  targets: readonly ScienceTarget[]
  missionSelection: MissionSelection
  selectedTargetId: TargetId | null
  selectionError: string | null
  onInspectTarget: (id: TargetId) => void
  onAssignTarget: (role: EndpointRole, id: string | null) => void
  onSwapTargets: () => void
  onClearTargets: () => void
}

type PlanningStage = 'endpoints' | 'rover' | 'calculate' | 'results'

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

export function MissionPlanningExperience({
  terrain,
  gridSelection,
  pickRole,
  gridNotice,
  canPick,
  onOpenPlanning,
  onAssignGridCell,
  onBeginPickRole,
  onUseCenter,
  onCancelPick,
  onSwapGridEndpoints,
  onClearGridEndpoints,
  distanceRouting,
  terrainRouting,
  targets,
  missionSelection,
  selectedTargetId,
  selectionError,
  onInspectTarget,
  onAssignTarget,
  onSwapTargets,
  onClearTargets,
}: MissionPlanningProps) {
  const [activeStage, setActiveStage] = useState<PlanningStage>('endpoints')
  const [customDraft, setCustomDraft] = useState(() => Object.fromEntries(fields.map(f => [f.key, String(terrainRouting.profile[f.key])])) as Record<NumericProfileKey, string>)
  const [unknownPolicy, setUnknownPolicy] = useState(terrainRouting.profile.unknownPolicy)
  const [profileNotice, setProfileNotice] = useState<string | null>(null)
  const [featureSearch, setFeatureSearch] = useState('')
  const [originRow, setOriginRow] = useState('714')
  const [originCol, setOriginCol] = useState('650')
  const [destRow, setDestRow] = useState('760')
  const [destCol, setDestCol] = useState('690')
  const [waypointRow, setWaypointRow] = useState('740')
  const [waypointCol, setWaypointCol] = useState('700')

  const terrainReady = terrain.phase === 'ready'
  const hasGridEndpoints = gridSelection.origin !== null && gridSelection.destination !== null
  const hasResults = distanceRouting.routes.length > 0 || terrainRouting.state.phase === 'ready'
  const isCalculating = distanceRouting.state.phase === 'loading' || terrainRouting.state.phase === 'loading'

  const selectedTerrainRoute = terrainRouting.state.phase === 'ready' ? terrainRouting.state.comparison[terrainRouting.selected] : null
  const selectedDistanceRoute = distanceRouting.routes.find(r => r.id === distanceRouting.selectedId) ?? distanceRouting.routes[0]
  const travel = useTravelTime(terrainRouting.analysis, terrainRouting.state.phase === 'ready' ? terrainRouting.state.comparison : null)

  // Automatically ensure the HRSC DEM is loaded so the A* terrain route (orange line) is ready to calculate
  useEffect(() => {
    if (terrainRouting.data.phase === 'idle') {
      void terrainRouting.load()
    }
  }, [terrainRouting])

  let rangeLabel: string | null = null
  if (terrainRouting.analysis && !['none', 'traversability', 'explored'].includes(terrainRouting.overlay)) {
    const values = terrainRouting.overlay === 'elevation' ? terrainRouting.analysis.grid.values : terrainRouting.overlay === 'slope' ? terrainRouting.analysis.slopeDeg : terrainRouting.overlay === 'roughness' ? terrainRouting.analysis.roughnessM : terrainRouting.analysis.shapeM
    let min = Infinity, max = -Infinity
    for (let node = 0; node < values.length; node++) if (terrainRouting.analysis.grid.valid[node] && Number.isFinite(values[node])) { min = Math.min(min, values[node]); max = Math.max(max, values[node]) }
    rangeLabel = Number.isFinite(min) ? `${min.toFixed(2)} to ${max.toFixed(2)} ${terrainRouting.overlay === 'slope' ? '°' : 'm'}` : 'No supported values'
  }

  // Presets
  const applyPreset = (oR: number, oC: number, dR: number, dC: number) => {
    onAssignGridCell('origin', oR, oC)
    onAssignGridCell('destination', dR, dC)
    setOriginRow(String(oR))
    setOriginCol(String(oC))
    setDestRow(String(dR))
    setDestCol(String(dC))
    if (terrainRouting.data.phase === 'idle') {
      void terrainRouting.load()
    }
  }

  const applyRoverPreset = (preset: 'standard' | 'rugged') => {
    if (preset === 'standard') {
      const next = { ...terrainRouting.profile, maxUphillDeg: 15, maxDownhillDeg: 15, maxRoughnessM: 0.5, unknownPolicy: 'block' as const }
      terrainRouting.applyProfile(next)
      setCustomDraft(prev => ({ ...prev, maxUphillDeg: '15', maxDownhillDeg: '15', maxRoughnessM: '0.5' }))
      setUnknownPolicy('block')
      setProfileNotice('Applied Perseverance standard profile (15° limit).')
    } else {
      const next = { ...terrainRouting.profile, maxUphillDeg: 25, maxDownhillDeg: 25, maxRoughnessM: 1.2, unknownPolicy: 'penalize' as const }
      terrainRouting.applyProfile(next)
      setCustomDraft(prev => ({ ...prev, maxUphillDeg: '25', maxDownhillDeg: '25', maxRoughnessM: '1.2' }))
      setUnknownPolicy('penalize')
      setProfileNotice('Applied Rugged Explorer profile (25° limit).')
    }
  }

  const handleApplyCustomProfile = () => {
    try {
      const next = Object.fromEntries(fields.map(f => [f.key, customDraft[f.key].trim() ? Number(customDraft[f.key]) : NaN])) as Record<NumericProfileKey, number>
      terrainRouting.applyProfile({ ...next, unknownPolicy })
      setProfileNotice('Custom rover parameters applied.')
    } catch (e) {
      setProfileNotice(e instanceof Error ? e.message : 'Invalid values.')
    }
  }

  const handleCalculateAll = async () => {
    terrainRouting.setVisible(true)
    terrainRouting.selectRoute('terrain')
    await Promise.all([
      terrainRouting.calculate(),
      distanceRouting.calculate(),
    ])
    terrainRouting.setVisible(true)
    terrainRouting.selectRoute('terrain')
    setActiveStage('results')
  }

  const handleCalculateDistance = async () => {
    await distanceRouting.calculate()
    setActiveStage('results')
  }

  const handleCalculateTerrain = async () => {
    terrainRouting.setVisible(true)
    terrainRouting.selectRoute('terrain')
    await terrainRouting.calculate()
    terrainRouting.setVisible(true)
    terrainRouting.selectRoute('terrain')
    setActiveStage('results')
  }

  const handleDownloadReport = () => {
    if (!terrainRouting.analysis) return
    const report = terrainModelReport(terrainRouting.analysis, terrainRouting.state.phase === 'ready' ? terrainRouting.state.comparison : null, travelTimeReport(travel))
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'REDLINE-Mars-Mission-Plan.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const filteredTargets = targets.filter(t => t.name.toLowerCase().includes(featureSearch.trim().toLowerCase()))

  return (
    <div className="mission-planning-experience">
      {/* Workflow Navigation Bar */}
      <nav className="planning-stage-nav" aria-label="Planning stages">
        <button
          type="button"
          className={`planning-stage-pill ${activeStage === 'endpoints' ? 'is-active' : ''}`}
          onClick={() => setActiveStage('endpoints')}
        >
          <span className="stage-num">{hasGridEndpoints ? '✓' : '1'}</span>
          <span className="stage-label">Endpoints</span>
        </button>
        <button
          type="button"
          className={`planning-stage-pill ${activeStage === 'rover' ? 'is-active' : ''}`}
          onClick={() => setActiveStage('rover')}
        >
          <span className="stage-num">2</span>
          <span className="stage-label">Rover Profile</span>
        </button>
        <button
          type="button"
          className={`planning-stage-pill ${activeStage === 'calculate' ? 'is-active' : ''}`}
          onClick={() => setActiveStage('calculate')}
        >
          <span className="stage-num">3</span>
          <span className="stage-label">Calculate</span>
        </button>
        <button
          type="button"
          className={`planning-stage-pill ${activeStage === 'results' ? 'is-active' : ''}`}
          onClick={() => setActiveStage('results')}
          disabled={!hasResults}
        >
          <span className="stage-num">{hasResults ? '✓' : '4'}</span>
          <span className="stage-label">Results</span>
        </button>
      </nav>

      {/* STAGE 1: ROUTE ENDPOINTS */}
      {activeStage === 'endpoints' && (
        <section className="planning-section" aria-labelledby="stage-endpoints-heading">
          <div className="planning-section-header">
            <div>
              <h3 id="stage-endpoints-heading" className="planning-section-title">Define Mission Route</h3>
              <p className="helper">Select or pick starting origin and destination points in the Belva crop.</p>
            </div>
            <button className="grid-button text-button" type="button" onClick={onOpenPlanning}>
              {terrainReady ? 'Show grid on map' : 'Load planning grid'}
            </button>
          </div>

          {/* Quick Mission Presets */}
          <div className="planning-card presets-card">
            <h4 className="card-heading">Quick mission presets</h4>
            <p className="helper">Explore verified Jezero terrain routes with one click:</p>
            <div className="preset-buttons">
              <button
                type="button"
                className="grid-button preset-btn"
                onClick={() => applyPreset(664, 584, 764, 684)}
              >
                <strong>Belva Rim to Floor</strong>
                <span>Verified unblocked traverse (664, 584) → (764, 684)</span>
              </button>
              <button
                type="button"
                className="grid-button preset-btn"
                onClick={() => applyPreset(714, 649, 799, 729)}
              >
                <strong>Neretva Delta Traverse</strong>
                <span>Verified unblocked corridor (714, 649) → (799, 729)</span>
              </button>
            </div>
          </div>

          {/* Origin & Destination Cards */}
          <div className="endpoint-cards-container">
            {/* Origin Card */}
            <div className="endpoint-card origin-card">
              <div className="endpoint-card-header">
                <span className="endpoint-symbol">△</span>
                <div>
                  <h4 className="endpoint-title">Grid origin · G-O</h4>
                  <p className="endpoint-meta">
                    {gridSelection.origin
                      ? `Row ${gridSelection.origin.row}, Col ${gridSelection.origin.column} (${gridSelection.origin.lon.toFixed(4)}°E, ${gridSelection.origin.lat.toFixed(4)}°N)`
                      : 'No origin cell selected'}
                  </p>
                </div>
              </div>
              <div className="endpoint-card-actions">
                <button
                  type="button"
                  className="grid-button"
                  disabled={!canPick}
                  aria-pressed={pickRole === 'origin'}
                  onClick={() => onBeginPickRole('origin')}
                >
                  Pick origin on map
                </button>
              </div>
              <details className="endpoint-manual-details">
                <summary>Edit coordinates manually</summary>
                <div className="grid-cell-fields">
                  <div>
                    <label className="field-label" htmlFor="grid-origin-row">Row (586–841)</label>
                    <input id="grid-origin-row" type="number" min={586} max={841} value={originRow} onChange={e => setOriginRow(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="grid-origin-col">Column (522–777)</label>
                    <input id="grid-origin-col" type="number" min={522} max={777} value={originCol} onChange={e => setOriginCol(e.target.value)} />
                  </div>
                </div>
                <button
                  type="button"
                  className="grid-button"
                  disabled={!canPick}
                  onClick={() => onAssignGridCell('origin', Number(originRow), Number(originCol))}
                >
                  Set origin coordinates
                </button>
              </details>
            </div>

            {/* Swap & Clear Bar */}
            <div className="endpoint-utilities-bar">
              <button
                type="button"
                className="grid-button utility-btn"
                disabled={!gridSelection.origin && !gridSelection.destination}
                onClick={onSwapGridEndpoints}
              >
                ⇄ Swap endpoints
              </button>
              <button
                type="button"
                className="grid-button utility-btn"
                disabled={!gridSelection.origin && !gridSelection.destination}
                onClick={onClearGridEndpoints}
              >
                ✕ Clear endpoints
              </button>
            </div>

            {/* Destination Card */}
            <div className="endpoint-card destination-card">
              <div className="endpoint-card-header">
                <span className="endpoint-symbol">⬡</span>
                <div>
                  <h4 className="endpoint-title">Grid destination · G-D</h4>
                  <p className="endpoint-meta">
                    {gridSelection.destination
                      ? `Row ${gridSelection.destination.row}, Col ${gridSelection.destination.column} (${gridSelection.destination.lon.toFixed(4)}°E, ${gridSelection.destination.lat.toFixed(4)}°N)`
                      : 'No destination cell selected'}
                  </p>
                </div>
              </div>
              <div className="endpoint-card-actions">
                <button
                  type="button"
                  className="grid-button"
                  disabled={!canPick}
                  aria-pressed={pickRole === 'destination'}
                  onClick={() => onBeginPickRole('destination')}
                >
                  Pick destination on map
                </button>
              </div>
              <details className="endpoint-manual-details">
                <summary>Edit coordinates manually</summary>
                <div className="grid-cell-fields">
                  <div>
                    <label className="field-label" htmlFor="grid-dest-row">Row (586–841)</label>
                    <input id="grid-dest-row" type="number" min={586} max={841} value={destRow} onChange={e => setDestRow(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="grid-dest-col">Column (522–777)</label>
                    <input id="grid-dest-col" type="number" min={522} max={777} value={destCol} onChange={e => setDestCol(e.target.value)} />
                  </div>
                </div>
                <button
                  type="button"
                  className="grid-button"
                  disabled={!canPick}
                  onClick={() => onAssignGridCell('destination', Number(destRow), Number(destCol))}
                >
                  Set destination coordinates
                </button>
              </details>
            </div>
          </div>

          {/* Map Picking Active Banner */}
          {pickRole && (
            <div className="grid-pick-actions">
              <p className="helper">Picking {pickRole}. Pan with arrow keys; Enter in the map selects its center.</p>
              <button type="button" className="grid-button" disabled={!canPick} onClick={onUseCenter}>Use map center</button>
              <button type="button" className="grid-button" onClick={onCancelPick}>Cancel grid picking</button>
            </div>
          )}

          {/* Optional Waypoint Card */}
          <details className="planning-card selection-guidance">
            <summary>Optional waypoint visit</summary>
            <p className="helper">Insert an intermediate stop into your route:</p>
            <div className="grid-cell-fields">
              <div>
                <label className="field-label" htmlFor="route-waypoint-row">Waypoint row (586–841)</label>
                <input id="route-waypoint-row" type="number" min={586} max={841} step={1} value={waypointRow} onChange={e => setWaypointRow(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="route-waypoint-column">Waypoint column (522–777)</label>
                <input id="route-waypoint-column" type="number" min={522} max={777} step={1} value={waypointCol} onChange={e => setWaypointCol(e.target.value)} />
              </div>
            </div>
            <div className="endpoint-actions">
              <button type="button" className="grid-button" onClick={() => distanceRouting.assignWaypoint(Number(waypointRow), Number(waypointCol))}>
                Set waypoint
              </button>
              <button type="button" className="grid-button" disabled={!distanceRouting.waypoint} onClick={distanceRouting.clearWaypoint}>
                Clear waypoint
              </button>
            </div>
            {distanceRouting.waypoint && (
              <p className="helper status-text">Active Waypoint W: Row {distanceRouting.waypoint.row}, Col {distanceRouting.waypoint.column}</p>
            )}
            {distanceRouting.waypointNotice && (
              <p className="helper" role="status">{distanceRouting.waypointNotice}</p>
            )}
          </details>

          {/* Sourced Feature References (Jezero, Belva, Neretva) */}
          <details className="planning-card selection-guidance">
            <summary>Approximate feature references</summary>
            <p className="context-qualification">Approximate feature centers · absolute registration unverified</p>
            <input
              type="search"
              placeholder="Search Jezero, Belva, Neretva…"
              value={featureSearch}
              onChange={e => setFeatureSearch(e.target.value)}
            />
            <div className="reference-list">
              {filteredTargets.map(t => (
                <div key={t.id} className="target-item-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-control)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <button
                    type="button"
                    className="reference-button"
                    aria-pressed={selectedTargetId === t.id}
                    onClick={() => onInspectTarget(t.id)}
                  >
                    <span className="reference-symbol">◇</span>
                    <span>
                      <span className="reference-name">{t.name}</span>
                      <span className="reference-coordinate">{t.coordinate.lon.toFixed(2)}°E · {t.coordinate.lat.toFixed(2)}°N</span>
                    </span>
                    <span className="reference-open">Inspect</span>
                  </button>
                  <div className="target-assign-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="grid-button text-button" aria-pressed={missionSelection.origin === t.id} onClick={() => onAssignTarget('origin', t.id)}>Start</button>
                    <button type="button" className="grid-button text-button" aria-pressed={missionSelection.destination === t.id} onClick={() => onAssignTarget('destination', t.id)}>Goal</button>
                  </div>
                </div>
              ))}
            </div>
            {selectionError && <p className="source-warning" role="alert">{selectionError}</p>}
            <div className="endpoint-utilities-bar" style={{ marginTop: '10px' }}>
              <button type="button" className="grid-button utility-btn" disabled={!missionSelection.origin && !missionSelection.destination} onClick={onSwapTargets}>⇄ Swap targets</button>
              <button type="button" className="grid-button utility-btn" disabled={!missionSelection.origin && !missionSelection.destination} onClick={onClearTargets}>✕ Clear targets</button>
            </div>
          </details>

          {gridNotice && <p className="helper grid-notice" role="status">{gridNotice}</p>}

          {/* Stage 1 Next Button */}
          <div className="stage-actions">
            <button
              type="button"
              className="open-region-button"
              onClick={() => setActiveStage('rover')}
            >
              Continue to Rover &amp; Constraints →
            </button>
          </div>
        </section>
      )}

      {/* STAGE 2: ROVER PROFILE & TERRAIN DATA */}
      {activeStage === 'rover' && (
        <section className="planning-section" aria-labelledby="stage-rover-heading">
          <div className="planning-section-header">
            <div>
              <h3 id="stage-rover-heading" className="planning-section-title">Rover Profile &amp; Constraints</h3>
              <p className="helper">Configure mobility limits and load numerical terrain data.</p>
            </div>
          </div>

          {/* Rover Profile Presets */}
          <div className="planning-card">
            <h4 className="card-heading">Vehicle mobility profiles</h4>
            <div className="preset-buttons">
              <button
                type="button"
                className="grid-button preset-btn"
                onClick={() => applyRoverPreset('standard')}
              >
                <strong>Perseverance Standard</strong>
                <span>15° max slope · conservative roughness</span>
              </button>
              <button
                type="button"
                className="grid-button preset-btn"
                onClick={() => applyRoverPreset('rugged')}
              >
                <strong>Rugged Explorer</strong>
                <span>25° max slope · high clearance</span>
              </button>
            </div>
            {profileNotice && <p className="helper status-text" role="status">{profileNotice}</p>}
          </div>

          {/* HRSC DEM Dataset Loader */}
          <div className="planning-card">
            <div className="scientific-summary-line">
              <h4 className="card-heading">HRSC Mars Express 50m DEM</h4>
              <span className="status-label" data-status={terrainRouting.data.phase === 'ready' ? 'verified' : 'unverified'}>
                {terrainRouting.data.phase === 'ready' ? 'Loaded' : 'Not Loaded'}
              </span>
            </div>
            <p className="helper">Digital elevation model supporting gradient, roughness, and terrain-aware cost calculations.</p>
            <button
              type="button"
              className="grid-button"
              disabled={terrainRouting.data.phase === 'loading'}
              onClick={() => void terrainRouting.load()}
            >
              {terrainRouting.data.phase === 'loading'
                ? 'Verifying HRSC DEM…'
                : terrainRouting.data.phase === 'ready'
                ? 'Reload HRSC DEM'
                : 'Load HRSC DEM'}
            </button>
            {terrainRouting.analysis && (
              <p className="source-state">103 × 103 native cells · 50 m projected spacing · HMC_13E10_DT5</p>
            )}
          </div>

          {/* Detailed Profile Customization */}
          <details className="planning-card selection-guidance">
            <summary>Custom engineering constraints</summary>
            <div className="terrain-profile-fields">
              {fields.map(field => (
                <div key={field.key}>
                  <label className="field-label" htmlFor={`terrain-${field.key}`}>{field.label}</label>
                  <input
                    id={`terrain-${field.key}`}
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={customDraft[field.key]}
                    onChange={e => setCustomDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <label className="field-label" htmlFor="terrain-unknown-policy">Incomplete metric support</label>
            <select
              id="terrain-unknown-policy"
              value={unknownPolicy}
              onChange={e => setUnknownPolicy(e.target.value as TerrainProfile['unknownPolicy'])}
            >
              <option value="block">Block unknown support (default)</option>
              <option value="penalize">Allow with explicit unknown penalty</option>
            </select>
            <button type="button" className="grid-button" onClick={handleApplyCustomProfile}>
              Apply custom parameters
            </button>
          </details>

          {/* Endpoint Mapping & Coverage */}
          <details className="planning-card selection-guidance">
            <summary>Endpoint mapping &amp; DEM coverage</summary>
            <p className="helper">CTX longitude/latitude selects containing HRSC cell. Routing uses that HRSC native center.</p>
            {(['originPoint', 'destinationPoint'] as const).map((key, index) => (
              <p className="helper" key={key}>
                {index === 0 ? 'HRSC origin' : 'HRSC destination'}:{' '}
                {terrainRouting[key]
                  ? `Row ${terrainRouting[key]!.row}, Col ${terrainRouting[key]!.column}; ${terrainRouting[key]!.lon.toFixed(6)}°E, ${terrainRouting[key]!.lat.toFixed(6)}°N`
                  : 'Choose a covered endpoint in Step 1.'}
              </p>
            ))}
          </details>

          <p className="context-qualification">
            Hypothetical DEM-based model. Physical traversability and human safety are not validated.
          </p>

          <div className="stage-actions flex gap-3">
            <button type="button" className="grid-button" onClick={() => setActiveStage('endpoints')}>
              ← Back to Endpoints
            </button>
            <button type="button" className="open-region-button" onClick={() => setActiveStage('calculate')}>
              Continue to Calculate →
            </button>
          </div>
        </section>
      )}

      {/* STAGE 3: CALCULATE & COMPARE */}
      {activeStage === 'calculate' && (
        <section className="planning-section" aria-labelledby="stage-calc-heading">
          <div className="planning-section-header">
            <div>
              <h3 id="stage-calc-heading" className="planning-section-title">Calculate &amp; Compare Routes</h3>
              <p className="helper">Run pathfinding algorithms to find optimal trajectories.</p>
            </div>
          </div>

          <div className="planning-card summary-review-card">
            <h4 className="card-heading">Mission setup summary</h4>
            <dl className="summary-dl">
              <div>
                <dt>Origin cell</dt>
                <dd>{gridSelection.origin ? `Row ${gridSelection.origin.row}, Col ${gridSelection.origin.column}` : 'None chosen'}</dd>
              </div>
              <div>
                <dt>Destination cell</dt>
                <dd>{gridSelection.destination ? `Row ${gridSelection.destination.row}, Col ${gridSelection.destination.column}` : 'None chosen'}</dd>
              </div>
              <div>
                <dt>Waypoint</dt>
                <dd>{distanceRouting.waypoint ? `Row ${distanceRouting.waypoint.row}, Col ${distanceRouting.waypoint.column}` : 'None set (direct route)'}</dd>
              </div>
              <div>
                <dt>Terrain Model</dt>
                <dd>{terrainRouting.data.phase === 'ready' ? 'HRSC 50m DEM Active' : 'Distance-Only (DEM not loaded)'}</dd>
              </div>
            </dl>
          </div>

          {/* Primary Calculate CTA Block */}
          <div className="calculation-cta-block">
            <button
              type="button"
              className="open-region-button calc-cta-btn"
              disabled={!hasGridEndpoints || isCalculating}
              onClick={handleCalculateAll}
            >
              {isCalculating
                ? 'Computing A* paths in background…'
                : terrainRouting.data.phase === 'ready'
                ? '⚡ Calculate All Routes (Distance & Terrain Cost)'
                : '⚡ Calculate Distance-Optimal Route'}
            </button>

            {terrainRouting.data.phase === 'ready' && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="grid-button flex-1"
                  disabled={!hasGridEndpoints || isCalculating}
                  onClick={handleCalculateTerrain}
                >
                  Compare DEM Routes (HRSC)
                </button>
                <button
                  type="button"
                  className="grid-button flex-1"
                  disabled={!hasGridEndpoints || isCalculating}
                  onClick={handleCalculateDistance}
                >
                  Calculate CTX Grid Paths
                </button>
              </div>
            )}

            {!hasGridEndpoints && (
              <p className="source-warning">Select both origin and destination endpoints in Step 1 to calculate routes.</p>
            )}
            {distanceRouting.blocker && <p className="helper">{distanceRouting.blocker}</p>}
            {terrainRouting.blocker && <p className="helper">{terrainRouting.blocker}</p>}
            {distanceRouting.state.phase === 'error' && <p className="source-warning" role="alert">{distanceRouting.state.reason}</p>}
            {terrainRouting.state.phase === 'error' && <p className="source-warning" role="alert">{terrainRouting.state.reason}</p>}

            {isCalculating && (
              <div className="flex gap-2 justify-center mt-3">
                <button type="button" className="grid-button" onClick={() => { distanceRouting.cancel(); terrainRouting.cancel(); }}>
                  Cancel calculation
                </button>
              </div>
            )}
          </div>

          <p className="context-qualification">{DISTANCE_ONLY_QUALIFICATION}</p>

          <div className="stage-actions">
            <button type="button" className="grid-button" onClick={() => setActiveStage('rover')}>
              ← Back to Rover Profile
            </button>
            {hasResults && (
              <button type="button" className="open-region-button" onClick={() => setActiveStage('results')}>
                View Results &amp; Comparison →
              </button>
            )}
          </div>
        </section>
      )}

      {/* STAGE 4: RESULTS & ANALYSIS */}
      {activeStage === 'results' && (
        <section className="planning-section" aria-labelledby="stage-results-heading">
          <div className="planning-section-header">
            <div>
              <h3 id="stage-results-heading" className="planning-section-title">Route Comparison &amp; Review</h3>
              <p className="helper">Select any calculated path to display on the map and compare metrics.</p>
            </div>
            <button type="button" className="grid-button" onClick={handleDownloadReport}>
              Export JSON Report
            </button>
          </div>

          {/* ALL 4 A* ROUTE OPTIONS WITH LINE KEYS */}
          <div className="planning-card">
            <h4 className="card-heading">Available A* Trajectory Options</h4>
            <p className="helper">Click any route option to emphasize on the map:</p>

            <div className="route-options" role="group" aria-label="Select A* route">
              {/* HRSC DEM 50m Terrain Routes (Winding A* & Permitted Distance) */}
              {terrainRouting.state.phase === 'loading' && (
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-control)', background: 'rgba(255, 42, 59, 0.1)', border: '1px dashed rgba(255, 42, 59, 0.5)' }}>
                  <p className="helper" style={{ color: '#ff4d5e', margin: 0, fontWeight: 600 }}>
                    ⚡ Calculating terrain-optimal A* obstacle-avoiding route (Orange Line)…
                  </p>
                </div>
              )}
              {terrainRouting.state.phase === 'error' && (
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-control)', background: 'rgba(255, 42, 59, 0.08)', border: '1px solid rgba(255, 42, 59, 0.4)' }}>
                  <p className="source-warning" style={{ margin: '0 0 8px' }}>{terrainRouting.state.reason}</p>
                  <button type="button" className="grid-button" onClick={() => void terrainRouting.calculate()}>
                    ⚡ Retry Terrain Route (Orange Line)
                  </button>
                </div>
              )}
              {terrainRouting.state.phase === 'ready' && (['terrain', 'distance'] as const).map(role => {
                const route = terrainRouting.state.phase === 'ready' ? terrainRouting.state.comparison[role] : null
                if (!route) return null
                const isSelected = terrainRouting.visible && terrainRouting.selected === role
                return (
                  <button
                    type="button"
                    className="route-option"
                    key={role}
                    aria-pressed={isSelected}
                    onClick={() => {
                      terrainRouting.setVisible(true)
                      terrainRouting.selectRoute(role)
                    }}
                  >
                    <span className={`route-line-key ${role === 'terrain' ? 'route-line-key-via' : ''}`} aria-hidden="true" />
                    <span>
                      <strong>{role === 'terrain' ? 'Lower terrain cost (Winding A* · Orange Line)' : 'Shortest permitted distance (Distance A* · Cyan Line)'}</strong>
                      <span>{distance(route.horizontalDistanceM)} · {route.accumulatedCostM.toFixed(1)} cost-m (HRSC terrain model)</span>
                    </span>
                  </button>
                )
              })}

              {/* CTX 6m Distance Grid Routes */}
              {distanceRouting.routes.map(route => {
                const isSelected = (!terrainRouting.visible || terrainRouting.state.phase !== 'ready') && distanceRouting.selectedId === route.id
                return (
                  <button
                    className="route-option"
                    type="button"
                    key={route.id}
                    aria-pressed={isSelected}
                    onClick={() => {
                      distanceRouting.selectRoute(route.id)
                      if (terrainRouting.state.phase === 'ready') {
                        terrainRouting.setVisible(true)
                        terrainRouting.selectRoute('distance')
                      } else {
                        terrainRouting.setVisible(false)
                      }
                    }}
                  >
                    <span className={`route-line-key ${route.id === 'via' ? 'route-line-key-via' : ''}`} aria-hidden="true" />
                    <span>
                      <strong>{route.id === 'shortest' ? 'Shortest grid path (Distance-Only CTX)' : 'Via your waypoint (CTX Grid)'}</strong>
                      <span>{distance(route.distanceM)} · {route.points.length.toLocaleString()} cell visits (CTX distance model)</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {!hasResults && (
              <p className="helper" role="status">No routes calculated yet. Go to Stage 3 (Calculate) to run the A* routing engine.</p>
            )}
          </div>

          {/* ACTIVE ROUTE METRICS */}
          {terrainRouting.visible && selectedTerrainRoute && (
            <div className="planning-card">
              <div className="scientific-summary-line">
                <h4 className="card-heading">
                  {terrainRouting.selected === 'terrain' ? 'Lower Terrain Cost Route Metrics' : 'Shortest Permitted Distance Route Metrics'}
                </h4>
                <span className="status-label" data-status="verified">HRSC DEM 50m</span>
              </div>
              <dl className="terrain-route-metrics">
                <dt>Horizontal distance</dt><dd>{distance(selectedTerrainRoute.horizontalDistanceM)}</dd>
                <dt>Accumulated model cost</dt><dd>{selectedTerrainRoute.accumulatedCostM.toFixed(1)} cost-m</dd>
                <dt>Maximum edge grade</dt><dd>{metric(selectedTerrainRoute.maxGradeDeg, '°')}</dd>
                <dt>Mean absolute edge grade</dt><dd>{metric(selectedTerrainRoute.meanAbsGradeDeg, '°')}</dd>
                <dt>Maximum / mean DEM gradient</dt><dd>{metric(selectedTerrainRoute.maxSlopeDeg, '°')} / {metric(selectedTerrainRoute.meanSlopeDeg, '°')}</dd>
                <dt>Maximum / mean roughness</dt><dd>{metric(selectedTerrainRoute.maxRoughnessM, 'm')} / {metric(selectedTerrainRoute.meanRoughnessM, 'm')}</dd>
                <dt>Cell visits / expanded cells</dt><dd>{selectedTerrainRoute.nodes.length} / {selectedTerrainRoute.exploredNodes.length}</dd>
                <dt>Blocked / unknown search cells</dt><dd>{selectedTerrainRoute.blockedSearchCells} / {selectedTerrainRoute.unknownSearchCells}</dd>
                <dt>Unknown-support segments</dt><dd>{selectedTerrainRoute.unknownSegments}</dd>
              </dl>
              <p className="helper">Cost-m means cost-equivalent metres, a hypothetical preference score. It is not energy, travel time or safety.</p>
            </div>
          )}

          {!terrainRouting.visible && selectedDistanceRoute && (
            <div className="planning-card">
              <div className="scientific-summary-line">
                <h4 className="card-heading">
                  {distanceRouting.selectedId === 'shortest' ? 'Shortest Grid Path Metrics' : 'Waypoint Route Metrics'}
                </h4>
                <span className="status-label" data-status="partial">CTX Grid 6m</span>
              </div>
              <dl className="terrain-route-metrics">
                <dt>Physical distance</dt><dd>{distance(selectedDistanceRoute.distanceM)}</dd>
                <dt>Connected cell visits</dt><dd>{selectedDistanceRoute.points.length.toLocaleString()}</dd>
                <dt>Native cell visits</dt><dd>{selectedDistanceRoute.visitedCells.toLocaleString()}</dd>
                <dt>Origin cell</dt><dd>{gridSelection.origin ? `R${gridSelection.origin.row}, C${gridSelection.origin.column}` : '—'}</dd>
                <dt>Destination cell</dt><dd>{gridSelection.destination ? `R${gridSelection.destination.row}, C${gridSelection.destination.column}` : '—'}</dd>
              </dl>
            </div>
          )}

          {/* TERRAIN OVERLAY CONTROLS (when HRSC loaded) */}
          {terrainRouting.analysis && (
            <div className="planning-card">
              <h4 className="card-heading">Terrain raster overlay</h4>
              <label className="field-label" htmlFor="plan-terrain-overlay">Select surface visualization</label>
              <select
                id="plan-terrain-overlay"
                value={terrainRouting.overlay}
                onChange={e => terrainRouting.setOverlay(e.target.value as TerrainOverlayMode)}
              >
                <option value="none">Imagery only</option>
                <option value="elevation">Provider sphere-relative height</option>
                <option value="slope">DEM gradient (°)</option>
                <option value="roughness">Local roughness (m)</option>
                <option value="shape">Local shape difference (m)</option>
                <option value="traversability">Model traversability</option>
                <option value="explored" disabled={!selectedTerrainRoute}>A* expanded cells</option>
              </select>
              {terrainRouting.overlay === 'traversability' ? (
                <div className="terrain-legend" aria-label="Model traversability legend">
                  {['Unknown', 'Traversable', 'High cost', 'Blocked'].map((label, index) => (
                    <span key={label}><i className={`terrain-swatch terrain-state-${index}`} aria-hidden="true" />{label}</span>
                  ))}
                </div>
              ) : terrainRouting.overlay !== 'none' && (
                <p className="helper terrain-raster-key">
                  {terrainRouting.overlay === 'explored'
                    ? 'Blue cells: expanded by the selected search.'
                    : `Blue to warm: ${rangeLabel}. Gray: unknown. One raster pixel per native cell.`}
                </p>
              )}
              <div className="endpoint-actions" style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="grid-button"
                  aria-pressed={terrainRouting.visible}
                  onClick={() => terrainRouting.setVisible(!terrainRouting.visible)}
                >
                  {terrainRouting.visible ? 'Hide HRSC model' : 'Show HRSC model'}
                </button>
                <button type="button" className="grid-button" onClick={onOpenPlanning}>
                  Show terrain on map
                </button>
              </div>
            </div>
          )}

          {/* TRAVEL TIME PANEL */}
          {terrainRouting.state.phase === 'ready' && (
            <div className="planning-card">
              <TravelTimePanel travel={travel} selected={terrainRouting.visible ? terrainRouting.selected : 'distance'} />
            </div>
          )}

          {/* SCIENTIFIC QUALIFICATION & DETAILS */}
          <details className="planning-card selection-guidance">
            <summary>Scientific qualification &amp; evidence</summary>
            <p className="helper">
              Model output only. The A* algorithms minimize Euclidean distance and DEM slope/roughness penalties.
              Valid terrain coverage does not guarantee safety. This prototype is not an official NASA navigation instrument.
            </p>
            {terrainRouting.analysis && (
              <>
                <p className="helper">{terrainRouting.analysis.grid.source.qualification}</p>
                <dl className="source-facts">
                  <dt>Product</dt><dd>HMC_13E10_DT5</dd>
                  <dt>Native raster SHA-256</dt><dd className="source-id">{terrainRouting.analysis.grid.source.gridHash}</dd>
                  <dt>Source evidence SHA-256</dt><dd className="source-id">{terrainRouting.analysis.grid.source.sourceHash}</dd>
                </dl>
              </>
            )}
          </details>

          <div className="stage-actions">
            <button type="button" className="grid-button" onClick={() => setActiveStage('calculate')}>
              ← Recalculate
            </button>
            <button type="button" className="grid-button" onClick={() => setActiveStage('endpoints')}>
              Edit Endpoints
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
