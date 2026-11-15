import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { TerrainModelGrid } from '../../features/terrain/modelTypes'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE, modelPoint } from '../../features/terrain/terrainModel'
import { calculateTerrainComparison } from '../../features/routing/terrainRoutes'
import type { TerrainModelRoute } from '../../features/routing/terrainRoutes'
import { estimateRouteTravelTime, MOBILITY_PROFILES, parseDepartureUtc } from '../../features/routing/travelTime'
import type { RouteTravelTime, TravelTimeResult } from '../../features/routing/travelTime'
import type { useTravelTime } from '../../features/routing/useTravelTime'
import { formatTravelDuration } from '../../features/routing/travelTimeDisplay'
import { TravelTimePanel } from './TravelTimePanel'

type Travel = ReturnType<typeof useTravelTime>
const grid: TerrainModelGrid = {
  rows: 15, columns: 21, startRow: 100, startColumn: 200, originXM: -105, originYM: 75, pixelWidthM: 10, pixelHeightM: -10, referenceRadiusM: 3396000,
  values: new Float32Array(315), valid: new Uint8Array(315).fill(1),
  source: { productId: 'synthetic-ui-eta-test', gridHash: 'synthetic-grid', sourceHash: 'synthetic-source', verticalReference: 'Synthetic heights', attribution: 'Synthetic UI test fixture', qualification: 'Synthetic, not Mars data', authorization: 'synthetic-test' },
}
const analysis = analyzeTerrainModel(grid, { ...DEFAULT_TERRAIN_PROFILE, roughnessRadiusM: 11 })
const compared = calculateTerrainComparison(analysis, 7 * 21 + 2, 7 * 21 + 18)
if (compared.status !== 'available') throw new Error(compared.reason)
const route = compared.value.terrain
const estimate = (path = route, options: { departureUtc?: string | null; plannedDelaySeconds?: number } = {}): RouteTravelTime => {
  const result = estimateRouteTravelTime(analysis, path, MOBILITY_PROFILES[0], options)
  if (result.status !== 'available') throw new Error(result.reason)
  return result.value
}
const defaultEstimate = estimate()
const available = (value: RouteTravelTime): TravelTimeResult => ({ status: 'available', value })
const travel = (overrides: Partial<Travel> = {}): Travel => ({ profile: MOBILITY_PROFILES[0], departureInput: '', plannedDelayMinutes: 0, estimates: null, apply: vi.fn(), ...overrides })
const ready = (value = defaultEstimate) => travel({ estimates: { distance: available({ ...value, routeId: 'distance', routeModel: 'hypothetical-dem-distance' }), terrain: available(value) } })
const render = (configuration = travel(), selected: 'distance' | 'terrain' = 'terrain') => renderToStaticMarkup(<TravelTimePanel travel={configuration} selected={selected} />)

describe('provisional travel time mission panel', () => {
  it('retains usable hypothetical assumptions and a qualified next step before routes exist', () => {
    const markup = render()
    expect(markup).toContain('aria-labelledby="travel-time-heading"')
    expect(markup).toContain('Provisional ETA')
    expect(markup).toContain('Calculate an HRSC route to estimate terrain-dependent travel time from its actual segments.')
    expect(markup).toContain('Hypothetical vehicle assumptions.')
    expect(markup).toContain('Terrain accuracy and human safety are not validated.')
    expect(markup).toContain('not measured rover performance or a NASA mission prediction')
    for (const value of MOBILITY_PROFILES) expect(markup).toContain(value.name)
    expect(markup).toContain('Hypothetical custom vehicle')
    expect(markup).toContain('Applied: Hypothetical survey vehicle')
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Apply travel assumptions/)
    expect(markup).not.toContain('Approx. total duration')
    expect(markup).not.toContain('Approx. arrival')
  })

  it('labels every editable assumption, optional Earth UTC departure and explicit hold', () => {
    const markup = render()
    for (const key of Object.keys(MOBILITY_PROFILES[0]).filter(key => key !== 'id' && key !== 'name')) {
      expect(markup).toContain(`for="travel-${key}"`)
      expect(markup).toContain(`id="travel-${key}"`)
    }
    expect(markup).toContain('for="travel-profile"')
    expect(markup).toContain('Departure time (Earth UTC)')
    expect(markup).toMatch(/id="travel-departure" type="datetime-local"[^>]*value=""/)
    expect(markup).toMatch(/id="travel-hold" type="number"[^>]*value="0"/)
    expect(markup).toContain('Leave departure blank for duration only.')
    expect(markup).toContain('No weather, charging or maintenance delays are added automatically.')
    expect(markup).toContain('Edit hypothetical speed assumptions')
    expect(markup).not.toContain('id="travel-maxUphillDeg"')
    expect(markup).not.toContain('id="travel-maxDownhillDeg"')
    expect(markup).not.toContain('id="travel-maxStepHeight"')
  })

  it('shows unavailable reasons without stale duration, arrival or timeline', () => {
    const unavailable: TravelTimeResult = { status: 'unavailable', reason: 'Test-only blocked segment' }
    const markup = render(travel({ estimates: { terrain: unavailable, distance: available(defaultEstimate) } }))
    expect(markup).toContain('ETA unavailable: Test-only blocked segment')
    expect(markup).toContain('role="status"')
    expect(markup).not.toContain('Approx. total duration')
    expect(markup).not.toContain('Actual route segment timeline')
    expect(markup).not.toContain('Approx. arrival')
  })

  it('uses the selected route’s rounded duration and geometric distance, keeping scenarios qualified', () => {
    const changed = { ...defaultEstimate, totalDurationSeconds: 3721, durationRangeSeconds: { lower: 3100, upper: 4700 } }
    const configuration = travel({ estimates: { terrain: available(changed), distance: available(defaultEstimate) } })
    const markup = render(configuration)
    expect(markup).toContain('Lower terrain cost route')
    expect(markup).toContain('<strong>1 h 2 min</strong>')
    expect(markup).toContain('Speed scenario range: 52 min–1 h 18 min')
    expect(markup).toContain('Geometric route distance: 160 m (0.16 km)')
    expect(markup).toContain('user-selected speed sensitivity, not an empirical confidence interval')
    const shortest = render(configuration, 'distance')
    expect(shortest).toContain('Shortest permitted distance route')
    expect(shortest).toContain(`<strong>${formatTravelDuration(defaultEstimate.totalDurationSeconds)}</strong>`)
    expect(shortest).not.toContain('<strong>1 h 2 min</strong>')
  })

  it('shows supplied UTC arrival and separately documents movement, holds, speed and inherited limits', () => {
    const timed = estimate(route, { departureUtc: parseDepartureUtc('2026-11-15T12:00'), plannedDelaySeconds: 600 })
    const markup = render(ready(timed))
    expect(markup).toContain('Approx. arrival')
    expect(markup).toContain('15 Nov 2026, 12:37 UTC')
    expect(markup).toContain('<dt>Explicit planned hold</dt><dd>10 min</dd>')
    expect(markup).toContain('<dt>Average movement speed</dt><dd>0.1 m/s</dd>')
    expect(markup).toContain(`Existing route limits: ${DEFAULT_TERRAIN_PROFILE.maxUphillDeg}° uphill, ${DEFAULT_TERRAIN_PROFILE.maxDownhillDeg}° downhill, ${DEFAULT_TERRAIN_PROFILE.maxRoughnessM} m roughness.`)
    expect(markup).toContain('Average speed excludes the planned hold.')
    expect(markup).toContain('editing ETA does not change those limits or rerun A*')
    expect(markup).toContain('not necessarily the fastest route')
  })

  it('exposes a paginated actual movement timeline with complete count and accessible controls', () => {
    const markup = render(ready())
    expect(defaultEstimate.segments.length).toBe(16)
    expect(markup).toContain('Route segment timeline (16)')
    expect(markup).toContain('aria-label="Actual route segment timeline"')
    expect(markup).toContain('Segments 1–10 of 16')
    expect(markup).toContain('Segment 1</strong>')
    expect(markup).toContain('Segment 10</strong>')
    expect(markup).not.toContain('Segment 11</strong>')
    expect(markup).toContain('Cell 107, 202 to 107, 203')
    expect(markup).toContain('<dt>Movement elapsed</dt><dd>17 min</dd>')
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Previous route segments"/)
    expect(markup).toMatch(/<button[^>]*aria-label="Next route segments"[^>]*>Next/)
    expect(markup).toContain('Every consecutive route-cell movement is included.')
  })

  it('preserves null unsupported metrics and exposes the assumed unknown-support speed', () => {
    const incomplete: RouteTravelTime = { ...defaultEstimate, unknownSegments: 1, segments: [{ ...defaultEstimate.segments[0], classification: 'UNKNOWN', gradeDeg: null, gradientDeg: null, roughnessM: null, effectiveSpeedMps: MOBILITY_PROFILES[0].unknownSpeedMps }, ...defaultEstimate.segments.slice(1)] }
    const markup = render(ready(incomplete))
    expect(markup).toContain('1 unknown-support segments use the assumed 0.03 m/s speed.')
    expect(markup).toContain('Their terrain metrics remain unknown.')
    expect(markup).toContain('<dt>Grade / gradient</dt><dd>Unknown support / Unknown support</dd>')
    expect(markup).toContain('<dt>Roughness</dt><dd>Unknown support</dd>')
  })

  it('presents a stationary valid cell without inventing speeds, segments or time penalties', () => {
    const origin = route.nodes[0]
    const stationary: TerrainModelRoute = { ...route, nodes: [origin], points: [modelPoint(grid, origin)], exploredNodes: [origin], horizontalDistanceM: 0, accumulatedCostM: 0, maxGradeDeg: 0, meanAbsGradeDeg: 0, maxSlopeDeg: 0, meanSlopeDeg: 0, maxRoughnessM: 0, meanRoughnessM: 0, unknownSegments: 0 }
    const markup = render(ready(estimate(stationary)))
    expect(markup).toContain('<strong>0 min</strong>')
    expect(markup).toContain('Geometric route distance: 0 m (0.00 km)')
    expect(markup).toContain('<dt>Average movement speed</dt><dd>Unavailable</dd>')
    expect(markup).toContain('<dt>Most time-consuming segment</dt><dd>No movement segments</dd>')
    expect(markup).toContain('Stationary route: no movement segments.')
    expect(markup).not.toContain('Actual route segment timeline')
  })

  it('retains the model, source attribution and scientific qualifications in expandable details', () => {
    const markup = render(ready())
    expect(markup).toContain('ETA model &amp; scientific limitations')
    expect(markup).toContain('actual horizontal ground distance ÷ estimated segment speed')
    expect(markup).toContain('Accumulated terrain cost and direct endpoint distance are not travel time.')
    expect(markup).toContain('Step heights, obstacles, surface traction and operational conditions')
    expect(markup).toContain(defaultEstimate.source.productId)
    expect(markup).toContain(defaultEstimate.source.qualification)
    expect(markup).toContain(defaultEstimate.source.attribution)
    expect(markup).toContain('not measured rover performance')
  })
})
