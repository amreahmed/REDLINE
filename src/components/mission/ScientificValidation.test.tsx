import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScientificValidation } from './ScientificValidation'

describe('scientific validation evidence disclosure', () => {
  it('keeps essential unresolved status outside collapsed evidence', () => {
    const markup = renderToStaticMarkup(<ScientificValidation />)
    const visibleSummary = markup.split('<details')[0]
    expect(visibleSummary).toContain('Named-feature registration')
    expect(visibleSummary).toContain('Unresolved')
    expect(visibleSummary).toContain('Elevation height reference')
    expect(visibleSummary).toContain('Conflicted / unresolved')
    expect(visibleSummary).toContain('real DEM slopes and costs blocked')
    expect(visibleSummary).toContain('pathfinding')
  })

  it('distinguishes candidate controls from landmark validation and mission endpoints', () => {
    const markup = renderToStaticMarkup(<ScientificValidation />)
    expect(markup).toContain('21 archived rover-site control candidates')
    expect(markup).toContain('no image-space residuals or per-site uncertainty')
    expect(markup).toContain('not planning endpoints')
    expect(markup).toContain('Fixed site definitions do not establish visit times')
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('<input')
  })

  it('exposes independent reference differences without relabelling terrain or implying accuracy', () => {
    const markup = renderToStaticMarkup(<ScientificValidation />)
    expect(markup).toContain('9 numerical HRSC comparisons')
    expect(markup).toContain('50 m')
    expect(markup).toContain('−66 to +4 m')
    expect(markup).toContain('+1,621 to +1,696 m')
    expect(markup).toContain('comparison diagnostics, not accuracy estimates or a validated conversion')
    expect(markup).toContain('Source values remain unchanged')
    expect(markup).toContain('exact CTX product')
    expect(markup).toContain('NASA/JPL control archive')
    expect(markup).toContain('HRSC team documentation')
    expect(markup.match(/<summary>/g)).toHaveLength(2)
    expect(markup.match(/rel="noreferrer"/g)).toHaveLength(2)
  })
})
