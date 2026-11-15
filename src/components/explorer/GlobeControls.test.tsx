import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GLOBE_LAYERS } from '../../data/globeLayers'
import { MARS_POIS } from '../../data/marsPois'
import type { GlobeWorkspace } from '../../features/globe/explorationTypes'
import { GlobeLayerControls, GlobeLocationControls } from './GlobeControls'

const workspace = (overrides: Partial<GlobeWorkspace['preferences']> = {}, phase: 'ready' | 'loading' | 'error' | 'outside' = 'ready'): GlobeWorkspace => ({
  preferences: { mode: 'imagery', layerId: 'globalCtx', category: 'all', selectedPoiId: null, ...overrides },
  view: { longitude: 77.69, latitude: 18.41, distance: 2, level: 4, imagery: { phase, pending: phase === 'loading' ? 1 : 0, loaded: phase === 'ready' ? 4 : 0, failed: phase === 'error' ? 1 : 0, missing: 0 } },
})
const layers = (value: GlobeWorkspace) => renderToStaticMarkup(<GlobeLayerControls workspace={value} onSelect={vi.fn()} onRetry={vi.fn()} />)
const locations = (value: GlobeWorkspace) => renderToStaticMarkup(<GlobeLocationControls workspace={value} onCategory={vi.fn()} onInspect={vi.fn()} onFly={vi.fn()} />)

describe('geographic globe controls and source disclosure', () => {
  it('offers every real imagery source and the separately qualified NASA model through a labeled select', () => {
    const markup = layers(workspace())
    expect(markup).toContain('for="globe-surface-source"')
    expect(markup).toContain('id="globe-surface-source"')
    for (const layer of GLOBE_LAYERS) expect(markup).toContain(`value="${layer.id}"`)
    expect(markup).toContain('value="model"')
    expect(markup).toContain('value="globalCtx" selected=""')
    expect(markup).toContain('Uncontrolled imagery · absolute registration unverified')
    expect(markup).toContain('tile level 4')
    expect(markup).toContain('Source changes preserve the camera location')
  })

  it('keeps loading, coverage absence and retryable errors distinct from available imagery', () => {
    const loading = layers(workspace({}, 'loading'))
    const outside = layers(workspace({ layerId: 'hirise' }, 'outside'))
    const failed = layers(workspace({}, 'error'))
    expect(loading).toContain('Loading selected imagery')
    expect(outside).toContain('Selected source has no coverage at this location.')
    expect(outside).not.toContain('source tiles loaded')
    expect(failed).toContain('Selected imagery unavailable · 1 failed · 0 missing. Retry this source.')
    expect(failed).toContain('Retry selected imagery')
    expect(failed).toContain('role="status"')
    expect(failed).not.toContain('source tiles loaded')
  })

  it('does not expose geographic imagery readiness or retry actions in uncalibrated visual-model mode', () => {
    const markup = layers(workspace({ mode: 'model' }))
    expect(markup).toContain('value="model" selected=""')
    expect(markup).toContain('Original NASA GLB · geographic orientation unverified')
    expect(markup).toContain('Geographic markers are available in imagery mode')
    expect(markup).not.toContain('source tiles loaded')
    expect(markup).not.toContain('Retry selected imagery')
  })

  it('discloses partial failed and missing tiles beside loaded globe imagery', () => {
    const value = workspace()
    value.view!.imagery.failed = 2
    value.view!.imagery.missing = 3
    const markup = layers(value)
    expect(markup).toContain('4 source tiles loaded · tile level 4 · 2 failed · 3 missing')
    expect(markup).toContain('class="source-warning" role="status"')
    expect(markup).toContain('Retry selected imagery')
  })

  it('shows active regional imagery status without borrowing the inactive globe level or availability', () => {
    const value = workspace()
    value.mapImagery = { phase: 'loading', pending: 2, loaded: 1, failed: 1, missing: 3 }
    const markup = layers(value)
    expect(markup).toContain('Loading selected imagery · 1 failed · 3 missing')
    expect(markup).not.toContain('tile level 4')
    expect(markup).not.toContain('4 source tiles loaded')
    value.mapImagery = { phase: 'outside', pending: 0, loaded: 0, failed: 0, missing: 0 }
    expect(layers(value)).toContain('Selected source has no coverage at this location.')
  })
})

describe('sourced location navigation controls', () => {
  it('retains all sourced references and distinct detail / flight controls with accessible names', () => {
    const selected = MARS_POIS[0]
    const markup = locations(workspace({ selectedPoiId: selected.id }))
    for (const poi of MARS_POIS) expect(markup).toContain(`aria-label="Fly to ${poi.name}"`)
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('for="globe-location-search"')
    expect(markup).toContain('type="search"')
    expect(markup).toContain('for="globe-poi-category"')
    expect(markup).not.toContain('disabled=""')
  })

  it('filters categories without inventing a confirmed-impact record', () => {
    const missions = locations(workspace({ category: 'mission' }))
    const impacts = locations(workspace({ category: 'impact' }))
    expect(missions).toContain('Fly to Perseverance landing site')
    expect(missions).not.toContain('Fly to Olympus Mons')
    expect(impacts).toContain('No sourced locations match this search and category.')
    expect(impacts).toContain('role="status"')
    expect(impacts).not.toContain('aria-label="Fly to ')
  })

  it('disables every geographic flight while retaining source inspection in model mode', () => {
    const markup = locations(workspace({ mode: 'model' }))
    expect(markup.match(/disabled=""/g)).toHaveLength(MARS_POIS.length)
    expect(markup.match(/class="reference-button"/g)).toHaveLength(MARS_POIS.length)
    expect(markup).toContain('Select a coordinate-based imagery source in Layers to fly to these locations.')
  })
})
