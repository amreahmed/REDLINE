import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScientificValidation } from './ScientificValidation'

describe('scientific validation evidence disclosure', () => {
  it('keeps a compact qualified overall status and a focusable details destination', () => {
    const markup = renderToStaticMarkup(<ScientificValidation />)
    const visibleSummary = markup.split('<details')[0]
    expect(visibleSummary).toContain('id="scientific-details"')
    expect(visibleSummary).toContain('id="validation-heading" tabindex="-1"')
    expect(visibleSummary).toContain('Partial')
    expect(visibleSummary).toContain('Height-dependent terrain results and precise feature placement remain unverified')
    expect(visibleSummary).not.toContain('HRSC')
    expect(visibleSummary).not.toContain('SHA-256')
    expect(markup).not.toContain('class="source-warning"')
  })

  it('separates every required capability and scopes mathematical verification', () => {
    const markup = renderToStaticMarkup(<ScientificValidation />)
    const capabilities = markup.split('<summary>Capability status</summary>')[1].split('</details>')[0]
    for (const [label, status] of [
      ['Source-to-grid preservation', 'Verified'],
      ['Reference-sphere distances', 'Verified'],
      ['A* mathematical search', 'Verified'],
      ['Hypothetical distance-only paths', 'Verified'],
      ['Requested HiRISE height definition', 'Verified'],
      ['Live CTX vertical height reference', 'Unverified'],
      ['Absolute feature-to-DEM registration', 'Unverified'],
      ['Real-Mars physical slopes', 'Unverified'],
      ['Physical terrain costs', 'Unverified'],
      ['Precise named-feature routing', 'Unverified'],
      ['Scientific globe orientation', 'Unverified'],
    ]) {
      expect(capabilities).toContain(`<dt>${label}</dt><dd><span class="status-label" data-status="${status.toLowerCase()}">${status}</span>`)
    }
    expect(capabilities.match(/<dt>/g)).toHaveLength(11)
    expect(capabilities).toContain('finite nonnegative costs and the documented admissible heuristic')
    expect(capabilities).toContain('not absolute positional accuracy')
    expect(capabilities).toContain('Algorithmic correctness and scientific validity are separate')
  })

  it('distinguishes candidate controls from landmark validation and mission endpoints', () => {
    const markup = renderToStaticMarkup(<ScientificValidation />)
    expect(markup).toContain('21 archived rover-site control candidates')
    expect(markup).toContain('no image-space residuals or per-site uncertainty')
    expect(markup).toContain('not planning endpoints')
    expect(markup).toContain('Fixed site definitions do not establish visit times')
    expect(markup).toContain('97 fit and 62 held-out texture ties')
    expect(markup).toContain('2.019619400 projected m')
    expect(markup).toContain('1.945117168 m on the Mars sphere')
    expect(markup).toContain('0.336603233 CTX pixels')
    expect(markup).toContain('903.140188 m')
    expect(markup).toContain('do not establish independent absolute registration')
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
    expect(markup).toContain('constant vertical offset cancels')
    expect(markup).toContain('spatially varying correction changes')
    expect(markup).toContain('No per-cell original stereo, edited or fill-quality mask')
  })

  it('qualifies the separate exact HiRISE product without relabelling the live grid', () => {
    const markup = renderToStaticMarkup(<ScientificValidation />)
    expect(markup).toContain('DTEEC_023524_1985_023379_1985_U01')
    expect(markup).toContain('product version 1')
    expect(markup).toContain('Mars 2000 equipotential surface')
    expect(markup).toContain('3,394,839.8133163 m')
    expect(markup).toContain('1.0096633268711 m')
    expect(markup).toContain('No overlap')
    expect(markup).toContain('not the vertical equipotential datum')
    expect(markup).toContain('not been integrated or substituted')
  })

  it('exposes the unchanged full audit as a real downloadable file with persistent limitations', () => {
    const markup = renderToStaticMarkup(<ScientificValidation />)
    expect(markup).toMatch(/href="[^"]*science-routing-audit\.md[^"]*" download="REDLINE-scientific-audit\.md"/)
    expect(markup).toContain('Download full scientific audit')
    expect(markup).toContain('Original TIFF SHA-256')
    expect(markup).toContain('16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b')
    expect(markup).toContain('Distance-only hypothetical route. Terrain and human safety are not validated.')
    expect(markup).toContain('not a NASA-endorsed product or certified human-safety system')
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('<input')
  })
})
