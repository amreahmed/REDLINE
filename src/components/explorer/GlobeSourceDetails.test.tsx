import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { globeLayerById } from '../../data/globeLayers'
import type { GlobeLayerId } from '../../data/globeLayers'
import { MARS_POIS } from '../../data/marsPois'
import type { GlobeWorkspace } from '../../features/globe/explorationTypes'
import { GlobeImageryDetails, GlobePoiDetails } from './GlobeSourceDetails'

const workspace = (layerId: GlobeLayerId, mode: 'imagery' | 'model' = 'imagery'): GlobeWorkspace => ({ preferences: { mode, layerId, category: 'all', selectedPoiId: null }, view: null })
const imagery = (id: GlobeLayerId, mode: 'imagery' | 'model' = 'imagery') => renderToStaticMarkup(<GlobeImageryDetails workspace={workspace(id, mode)} />)

describe('globe scientific details and provenance', () => {
  it('keeps uncontrolled Beta01 identity, coverage limits and imagery-only qualifications in expandable details', () => {
    const markup = imagery('globalCtx')
    const layer = globeLayerById('globalCtx')
    expect(markup).toContain('Global CTX · Beta01')
    expect(markup).toContain('Uncontrolled global imagery · absolute registration unverified')
    expect(markup).toContain('Globe coordinates, tiles &amp; limitations')
    expect(markup).toContain('not the later V01 release')
    expect(markup).toContain('V01 coverage percentages must not be applied to this product')
    expect(markup).toContain('Imagery is not numerical elevation')
    expect(markup).toContain('not surveyed registration')
    expect(markup).toContain('512 px; levels 0–12')
    expect(markup).toContain(layer.capabilitiesUrl)
    expect(markup).toContain(layer.attribution)
    expect(markup).toContain('current solar ephemeris or atmospheric observations')
    expect(markup).toContain('another dataset is never silently substituted')
  })

  it('retains rendered MOLA and the separate HiRISE imagery identities without claiming numerical height', () => {
    const mola = imagery('mola')
    const hirise = imagery('hirise')
    expect(mola).toContain('Colorized relief is a rendered image, not numerical elevation')
    expect(mola).toContain('Imagery is not numerical elevation')
    expect(hirise).toContain('25 cm native projected image pixels')
    expect(hirise).toContain('first_dd imagery mosaic')
    expect(hirise).toContain('not a numerical DTM')
    expect(hirise).toContain('not the separate nonoverlapping HiRISE DTM')
    expect(hirise).toContain('independent absolute accuracy unverified')
    expect(hirise).toContain('256 px; levels 0–17')
  })

  it('does not attach an imagery dataset claim to the separate NASA GLB renderer', () => {
    expect(imagery('globalCtx', 'model')).toBe('')
  })

  it('retains exact archived landing coordinates and qualifications while disabling unsupported flight', () => {
    const poi = MARS_POIS.find(candidate => candidate.id === 'curiosity')!
    const markup = renderToStaticMarkup(<GlobePoiDetails poi={poi} onFly={vi.fn()} canFly={false} />)
    expect(markup).toContain('not its current position')
    expect(markup).toContain(String(poi.longitude))
    expect(markup).toContain(String(poi.latitude))
    expect(markup).toContain('decimal precision is not accuracy')
    expect(markup).toContain('not its current position')
    expect(markup).toContain('does not establish absolute feature-to-DEM registration or a route endpoint')
    expect(markup).toContain('disabled=""')
    expect(markup).toContain(poi.sourceUrl)
    expect(markup).toContain('tabindex="-1"')
  })

  it('preserves secondary NASA mission references alongside the exact coordinate-evidence source', () => {
    const poi = MARS_POIS.find(candidate => candidate.id === 'perseverance')!
    const markup = renderToStaticMarkup(<GlobePoiDetails poi={poi} onFly={vi.fn()} canFly />)
    expect(markup).toContain(poi.sourceUrl)
    expect(poi.references).toHaveLength(1)
    for (const reference of poi.references!) {
      expect(markup).toContain(`href="${reference.url}" target="_blank" rel="noreferrer"`)
      expect(markup).toContain(reference.name)
    }
    expect(markup).toContain('Fly to Perseverance landing site')
    expect(markup).not.toContain('disabled=""')
  })
})
