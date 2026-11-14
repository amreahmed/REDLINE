import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RoutePlanner } from './RoutePlanner'
import type { useDistanceRouting } from '../../features/routing/useDistanceRouting'
import type { HypotheticalRoute } from '../../features/routing/types'

type Routing = ReturnType<typeof useDistanceRouting>
// Synthetic route fixture for presentation semantics, never an application observation.
const path: HypotheticalRoute = { id: 'shortest', name: 'Shortest grid path', points: [{ row: 0, column: 0, lon: 0, lat: 0 }, { row: 0, column: 1, lon: 0.1, lat: 0 }], distanceM: 42, visitedCells: 2, sourceId: 'test-only-source', sourceHash: 'test-only-source-hash', gridHash: 'test-only-grid-hash', referenceRadiusM: 3396190, model: 'hypothetical-distance-only' }
const routing = (overrides: Partial<Routing> = {}): Routing => ({ state: { phase: 'idle' }, blocker: null, waypoint: null, waypointPoint: null, waypointNotice: null, assignWaypoint: vi.fn(), clearWaypoint: vi.fn(), calculate: vi.fn(), cancel: vi.fn(), routes: [], selectedId: 'shortest', selectRoute: vi.fn(), ...overrides })
const render = (value: Routing) => renderToStaticMarkup(<RoutePlanner routing={value} onShowMap={vi.fn()} />)

describe('hypothetical route controls and qualifications', () => {
  it('labels simulation and keeps unsupported terrain factors out of the model', () => {
    const markup = render(routing({ blocker: 'Choose grid endpoints first.' }))
    expect(markup).toContain('Distance-only hypothetical route. Terrain and human safety are not validated.')
    expect(markup).toContain('Paths are calculated simulations, not recorded rover traverses')
    expect(markup).toContain('Valid data coverage does not prove traversability')
    expect(markup).toContain('No elevation, slope, roughness or science score enters the cost')
    expect(markup).toContain('Choose grid endpoints first')
    expect(markup).toContain('aria-describedby="route-model-note"')
    expect(markup).not.toContain('42 m')
  })
  it('shows a real active waypoint separately from draft input values', () => {
    const markup = render(routing({ waypoint: { row: 600, column: 610 } }))
    expect(markup).toContain('Waypoint W: row 600, column 610')
    expect(markup).toContain('id="route-waypoint-row"')
    expect(markup).toContain('Set waypoint')
    expect(markup).toContain('Clear waypoint')
  })
  it('offers cancellation and retry status rather than showing old results during search/errors', () => {
    expect(render(routing({ state: { phase: 'loading' } }))).toContain('Cancel calculation')
    const error = render(routing({ state: { phase: 'error', reason: 'Test-only worker failure' } }))
    expect(error).toContain('Retry hypothetical routes')
    expect(error).toContain('role="alert"')
    expect(error).not.toContain('42 m')
  })
  it('compares calculated distances and exposes route selection by accessible pressed state', () => {
    const via: HypotheticalRoute = { ...path, id: 'via', name: 'Via your waypoint', distanceM: 100 }
    const markup = render(routing({ state: { phase: 'ready', comparison: { shortest: path, via } }, routes: [path, via], selectedId: 'via' }))
    expect(markup).toContain('42 m')
    expect(markup).toContain('100 m')
    expect(markup).toContain('2 cell visits')
    expect(markup).toContain('adds 58 m')
    expect(markup).toContain('aria-label="Select hypothetical route"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('Show paths on map')
    expect(markup).toContain('Distance-only hypothetical route. Terrain and human safety are not validated.')
  })
  it('retains scientific assumptions and route provenance in expandable model details', () => {
    const markup = render(routing({ state: { phase: 'ready', comparison: { shortest: path, via: null } }, routes: [path] }))
    const details = markup.slice(markup.indexOf('<summary>How this model works</summary>'))
    expect(details).toContain('3,396,190 m Mars reference sphere')
    expect(details).toContain('Missing cells are excluded; diagonals require both flank cells')
    expect(details).toContain('No elevation, slope, roughness or science score enters the cost')
    expect(details).toContain('Terrain-aware routing and precise named-feature routing are unavailable')
    expect(details).toContain('Route scores are model outputs, not validated human-safety predictions')
    expect(details).toContain('<dt>Numerical source</dt><dd class="source-id">test-only-source</dd>')
    expect(details).toContain('<dt>Source SHA-256</dt><dd class="source-id">test-only-source-hash</dd>')
    expect(details).toContain('<dt>Grid SHA-256</dt><dd class="source-id">test-only-grid-hash</dd>')
    expect(markup).not.toMatch(/<button[^>]*>Terrain-aware/)
  })
})
