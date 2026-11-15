import { useMemo, useState } from 'react'
import { MOBILITY_PROFILES, parseDepartureUtc, validateMobilityProfile } from '../../features/routing/travelTime'
import type { MobilityProfile, RouteTravelTime } from '../../features/routing/travelTime'
import { formatTravelArrival, formatTravelDuration, formatTravelSpeed } from '../../features/routing/travelTimeDisplay'
import type { useTravelTime } from '../../features/routing/useTravelTime'

type MobilityKey = Exclude<keyof MobilityProfile, 'id' | 'name'>
type MobilityDraft = Record<MobilityKey, string>
const fields: readonly { key: MobilityKey; label: string }[] = [
  { key: 'nominalSpeedMps', label: 'Nominal speed (m/s)' },
  { key: 'minSpeedMps', label: 'Minimum speed (m/s)' },
  { key: 'maxSpeedMps', label: 'Maximum speed (m/s)' },
  { key: 'unknownSpeedMps', label: 'Unknown-support speed (m/s)' },
  { key: 'uphillSensitivity', label: 'Uphill slowdown factor' },
  { key: 'downhillSensitivity', label: 'Downhill slowdown factor' },
  { key: 'gradientSensitivity', label: 'DEM gradient slowdown factor' },
  { key: 'roughnessSensitivity', label: 'Roughness slowdown factor' },
  { key: 'highCostPenalty', label: 'High-cost slowdown factor' },
  { key: 'speedUncertaintyFraction', label: 'Speed scenario sensitivity (%)' },
]
const number = (value: string) => value.trim() ? Number(value) : NaN
const draftFrom = (profile: MobilityProfile): MobilityDraft => Object.fromEntries(fields.map(({ key }) => [key, String(profile[key] * (key === 'speedUncertaintyFraction' ? 100 : 1))])) as MobilityDraft
const distance = (metres: number) => `${Math.round(metres).toLocaleString('en-GB')} m (${(metres / 1000).toFixed(2)} km)`
const metric = (value: number | null, unit: string) => value === null ? 'Unknown support' : `${Number(value.toPrecision(3))} ${unit}`

function TravelTimeline({ route }: { route: RouteTravelTime }) {
  const [pagination, setPagination] = useState({ route, page: 0 })
  const pageSize = 10
  const pages = Math.ceil(route.segments.length / pageSize)
  const page = pagination.route === route ? Math.min(pagination.page, Math.max(0, pages - 1)) : 0
  const elapsed = useMemo(() => {
    const totals: number[] = []
    for (const segment of route.segments) totals.push((totals.at(-1) ?? 0) + segment.durationSeconds)
    return totals
  }, [route])
  const start = page * pageSize
  if (!route.segments.length) return <p className="helper">Stationary route: no movement segments.</p>
  return <>
    <p className="helper">Every consecutive route-cell movement is included. Elapsed time covers movement; the planned hold is separate.</p>
    <ol className="travel-timeline" start={start + 1} aria-label="Actual route segment timeline">
      {route.segments.slice(start, start + pageSize).map((segment, offset) => <li key={segment.index}>
        <div className="travel-segment-heading"><strong>Segment {segment.index + 1}</strong><span>{formatTravelDuration(segment.durationSeconds)}</span></div>
        <p className="helper">Cell {segment.from.row}, {segment.from.column} to {segment.to.row}, {segment.to.column}</p>
        <dl className="travel-segment-metrics">
          <dt>Distance / speed</dt><dd>{Math.round(segment.distanceM)} m / {formatTravelSpeed(segment.effectiveSpeedMps)}</dd>
          <dt>Movement elapsed</dt><dd>{formatTravelDuration(elapsed[start + offset])}</dd>
          <dt>Terrain support</dt><dd>{segment.classification === 'UNKNOWN' ? 'Unknown support' : segment.classification === 'HIGH_COST' ? 'High model cost' : 'Model traversable'}</dd>
          <dt>Grade / gradient</dt><dd>{metric(segment.gradeDeg, '°')} / {metric(segment.gradientDeg, '°')}</dd>
          <dt>Roughness</dt><dd>{metric(segment.roughnessM, 'm')}</dd>
        </dl>
      </li>)}
    </ol>
    <div className="travel-pagination">
      <button type="button" className="grid-button" disabled={page === 0} aria-label="Previous route segments" onClick={() => setPagination({ route, page: page - 1 })}>Previous</button>
      <span className="helper" role="status">Segments {start + 1}–{Math.min(start + pageSize, route.segments.length)} of {route.segments.length}</span>
      <button type="button" className="grid-button" disabled={page >= pages - 1} aria-label="Next route segments" onClick={() => setPagination({ route, page: page + 1 })}>Next</button>
    </div>
  </>
}

export function TravelTimePanel({ travel, selected }: { travel: ReturnType<typeof useTravelTime>; selected: 'distance' | 'terrain' }) {
  const [identity, setIdentity] = useState({ id: travel.profile.id, name: travel.profile.name })
  const [draft, setDraft] = useState(() => draftFrom(travel.profile))
  const [departure, setDeparture] = useState(travel.departureInput)
  const [hold, setHold] = useState(String(travel.plannedDelayMinutes))
  const [applyError, setApplyError] = useState<string | null>(null)
  const profile = { ...identity, ...Object.fromEntries(fields.map(({ key }) => [key, number(draft[key]) / (key === 'speedUncertaintyFraction' ? 100 : 1)])) } as MobilityProfile
  const plannedHold = number(hold)
  let invalid: string | null = null
  try {
    validateMobilityProfile(profile)
    parseDepartureUtc(departure)
    if (!Number.isFinite(plannedHold) || plannedHold < 0 || plannedHold > 10080) throw new Error('Planned hold must be between zero and 10,080 minutes (7 Earth days).')
  } catch (error) {
    invalid = error instanceof Error ? error.message : 'Check the hypothetical mobility assumptions.'
  }
  const dirty = profile.id !== travel.profile.id || fields.some(({ key }) => profile[key] !== travel.profile[key]) || departure !== travel.departureInput || plannedHold !== travel.plannedDelayMinutes
  const result = travel.estimates?.[selected] ?? null
  const route = result?.status === 'available' ? result.value : null
  const apply = () => {
    try {
      travel.apply(profile, departure, plannedHold)
      setApplyError(null)
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : 'Unable to apply these travel assumptions.')
    }
  }
  const preset = (id: string) => {
    const chosen = MOBILITY_PROFILES.find(value => value.id === id)
    if (chosen) {
      setIdentity({ id: chosen.id, name: chosen.name })
      setDraft(draftFrom(chosen))
    } else setIdentity({ id: 'hypothetical-custom', name: 'Hypothetical custom vehicle' })
    setApplyError(null)
  }

  return <section className="panel-section travel-time-panel" aria-labelledby="travel-time-heading">
    <div className="scientific-summary-line"><h3 id="travel-time-heading">Travel time</h3><span className="status-label">Provisional ETA</span></div>
    <p className="helper" id="travel-time-qualification">Hypothetical vehicle assumptions. Terrain accuracy and human safety are not validated. This is not measured rover performance or a NASA mission prediction.</p>
    <p className="travel-applied-profile"><strong>Applied: {travel.profile.name}</strong><span>{formatTravelSpeed(travel.profile.nominalSpeedMps)} nominal speed</span></p>

    {route ? <div className="travel-result" aria-live="polite">
      <p className="helper">{selected === 'terrain' ? 'Lower terrain cost route' : 'Shortest permitted distance route'}</p>
      <p className="travel-duration"><span>Approx. total duration</span><strong>{formatTravelDuration(route.totalDurationSeconds)}</strong></p>
      <p className="travel-range">Speed scenario range: {formatTravelDuration(route.durationRangeSeconds.lower)}–{formatTravelDuration(route.durationRangeSeconds.upper)}</p>
      <p className="helper">Geometric route distance: {distance(route.horizontalDistanceM)}</p>
      {route.arrivalUtc && <p className="travel-arrival"><strong>Approx. arrival</strong><span>{formatTravelArrival(route.arrivalUtc)}</span></p>}
      {route.unknownSegments > 0 && <p className="source-state">{route.unknownSegments} unknown-support segments use the assumed {formatTravelSpeed(route.profile.unknownSpeedMps)} speed. Their terrain metrics remain unknown.</p>}
    </div> : <p className="source-state" role="status">{result?.status === 'unavailable' ? `ETA unavailable: ${result.reason}` : 'Calculate an HRSC route to estimate terrain-dependent travel time from its actual segments.'}</p>}

    <label className="field-label" htmlFor="travel-profile">Hypothetical vehicle profile</label>
    <select id="travel-profile" value={identity.id} onChange={event => preset(event.target.value)} aria-describedby="travel-time-qualification">
      {MOBILITY_PROFILES.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}
      <option value="hypothetical-custom">Hypothetical custom vehicle</option>
    </select>
    {route && <p className="helper travel-route-limits">Existing route limits: {route.terrainProfile.maxUphillDeg}° uphill, {route.terrainProfile.maxDownhillDeg}° downhill, {route.terrainProfile.maxRoughnessM} m roughness. These remain the terrain model’s assumptions.</p>}
    <div className="travel-config-fields">
      <div><label className="field-label" htmlFor="travel-departure">Departure time (Earth UTC)</label><input id="travel-departure" type="datetime-local" step="60" value={departure} aria-describedby="travel-departure-note" onChange={event => { setDeparture(event.target.value); setApplyError(null) }} /></div>
      <div><label className="field-label" htmlFor="travel-hold">Planned hold (minutes)</label><input id="travel-hold" type="number" min="0" max="10080" step="any" value={hold} aria-describedby="travel-hold-note" onChange={event => { setHold(event.target.value); setApplyError(null) }} /></div>
    </div>
    <p className="helper" id="travel-departure-note">Optional. Leave departure blank for duration only. The entered time is interpreted as Earth UTC.</p>
    <p className="helper" id="travel-hold-note">User-defined hold, separate from movement. No weather, charging or maintenance delays are added automatically.</p>

    <details className="selection-guidance">
      <summary>Edit hypothetical speed assumptions</summary>
      <p className="helper">Editing a value creates a custom profile. Speeds use metres per second; slowdown factors are dimensionless assumptions.</p>
      <div className="terrain-profile-fields travel-assumption-fields">{fields.map(({ key, label }) => <div key={key}>
        <label className="field-label" htmlFor={`travel-${key}`}>{label}</label>
        <input id={`travel-${key}`} type="number" min="0" max={key === 'speedUncertaintyFraction' ? 100 : undefined} step="any" value={draft[key]} onChange={event => {
          setDraft({ ...draft, [key]: event.target.value })
          setIdentity({ id: 'hypothetical-custom', name: 'Hypothetical custom vehicle' })
          setApplyError(null)
        }} />
      </div>)}</div>
      <p className="helper">Minimum ≤ nominal ≤ maximum speed. Unknown-support speed must lie between minimum and nominal; it applies only when the route’s existing unknown policy permits that support.</p>
      <p className="helper">Scenario sensitivity must be below 100%. It changes speed scenarios, not measured confidence.</p>
    </details>
    <p className={invalid || applyError ? 'source-warning' : 'helper'} id="travel-draft-status" role={applyError ? 'alert' : 'status'}>{applyError ?? (invalid ? `Draft not applied: ${invalid}` : dirty ? 'Draft changes are ready. Apply to update both existing route estimates.' : 'Current travel assumptions are applied.')}</p>
    <button type="button" className="grid-button" disabled={!!invalid || !dirty} aria-describedby="travel-draft-status travel-time-qualification" onClick={apply}>Apply travel assumptions</button>

    {route && <>
      <details className="selection-guidance">
        <summary>Timing, speed & route limits</summary>
        <dl className="terrain-route-metrics">
          <dt>Terrain movement</dt><dd>{formatTravelDuration(route.travelDurationSeconds)}</dd>
          <dt>At nominal speed</dt><dd>{formatTravelDuration(route.nominalDurationSeconds)}</dd>
          <dt>Modeled terrain penalty</dt><dd>{formatTravelDuration(route.terrainPenaltySeconds)}</dd>
          <dt>Explicit planned hold</dt><dd>{formatTravelDuration(route.plannedDelaySeconds)}</dd>
          <dt>Average movement speed</dt><dd>{formatTravelSpeed(route.averageSpeedMps)}</dd>
          <dt>Minimum / maximum speed</dt><dd>{formatTravelSpeed(route.minSegmentSpeedMps)} / {formatTravelSpeed(route.maxSegmentSpeedMps)}</dd>
          <dt>Most time-consuming segment</dt><dd>{route.slowestSegmentIndex === null ? 'No movement segments' : `Segment ${route.slowestSegmentIndex + 1} · ${formatTravelDuration(route.segments[route.slowestSegmentIndex].durationSeconds)}`}</dd>
          <dt>Route unknown-support policy</dt><dd>{route.terrainProfile.unknownPolicy === 'block' ? 'Block unknown support' : 'Permit with explicit model penalty'}</dd>
          {route.departureUtc && <><dt>Departure (Earth UTC)</dt><dd>{formatTravelArrival(route.departureUtc)}</dd></>}
          {route.arrivalRangeUtc && <><dt>Arrival speed scenarios</dt><dd>{formatTravelArrival(route.arrivalRangeUtc.lower)} to {formatTravelArrival(route.arrivalRangeUtc.upper)}</dd></>}
        </dl>
        <p className="helper">Average speed excludes the planned hold. Route limits come from the existing terrain model; editing ETA does not change those limits or rerun A*.</p>
        <p className="helper">A route minimizing distance or terrain cost is not necessarily the fastest route under these travel assumptions.</p>
      </details>
      <details className="selection-guidance"><summary>Route segment timeline ({route.segments.length})</summary><TravelTimeline route={route} /></details>
    </>}

    <details className="selection-guidance">
      <summary>ETA model & scientific limitations</summary>
      <p className="helper">Known-segment speed = nominal speed ÷ (1 + weighted uphill, downhill, DEM gradient, roughness and high-cost slowdown), bounded by the configured minimum and maximum. Each terrain term is normalized using the route’s existing terrain limits.</p>
      <p className="helper">Segment duration = actual horizontal ground distance ÷ estimated segment speed. Total duration sums every existing route segment and the explicit planned hold. Accumulated terrain cost and direct endpoint distance are not travel time.</p>
      <p className="helper">The speed scenario range is user-selected speed sensitivity, not an empirical confidence interval. Each segment’s bounded slower and faster scenarios are summed with the same planned hold.</p>
      <p className="helper">Step heights, obstacles, surface traction and operational conditions are not resolved by this model. No measured rover performance is used.</p>
      {route && <><p className="helper">{route.qualification}</p><p className="source-id">Terrain source: {route.source.productId}</p><p className="source-credit">{route.source.attribution}</p></>}
    </details>
  </section>
}
