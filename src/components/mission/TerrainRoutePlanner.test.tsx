import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TerrainRoutePlanner } from './TerrainRoutePlanner'
import type { useTerrainRouting } from '../../features/routing/useTerrainRouting'
import { calculateTerrainComparison } from '../../features/routing/terrainRoutes'
import { terrainModelReport } from '../../features/routing/terrainModelReport'
import { decodeHrscModel, parseHrscModelManifest } from '../../features/terrain/hrscModel'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE, modelPoint } from '../../features/terrain/terrainModel'

type Routing = ReturnType<typeof useTerrainRouting>
const samples = Uint8Array.from(readFileSync('public/data/hrsc-terrain-model.i16'))
const mask = Uint8Array.from(readFileSync('public/data/hrsc-terrain-model.u8'))
const grid = decodeHrscModel(parseHrscModelManifest(JSON.parse(readFileSync('public/data/hrsc-terrain-model.json', 'utf8'))), samples.buffer, mask.buffer)
const analysis = analyzeTerrainModel(grid, DEFAULT_TERRAIN_PROFILE)
const result = calculateTerrainComparison(analysis, 30 * 103 + 30, 70 * 103 + 70)
if (result.status !== 'available') throw new Error(result.reason)
const comparison = result.value

const routing = (overrides: Partial<Routing> = {}): Routing => ({
  data: { phase: 'idle' }, profile: DEFAULT_TERRAIN_PROFILE, analysis: null, state: { phase: 'idle' },
  blocker: 'Load the separately documented HRSC DEM first.', load: vi.fn(), applyProfile: vi.fn(), calculate: vi.fn(), cancel: vi.fn(),
  selected: 'terrain', selectRoute: vi.fn(), overlay: 'traversability', setOverlay: vi.fn(), visible: true, setVisible: vi.fn(), display: null,
  originPoint: null, destinationPoint: null, ...overrides,
})
const ready = (overrides: Partial<Routing> = {}) => routing({ data: { phase: 'ready', grid }, analysis, blocker: null, originPoint: modelPoint(grid, 30 * 103 + 30), destinationPoint: modelPoint(grid, 70 * 103 + 70), ...overrides })
const render = (value: Routing) => renderToStaticMarkup(<TerrainRoutePlanner routing={value} onShowMap={vi.fn()} />)

describe('qualified HRSC terrain model presentation', () => {
  it('offers source loading and retains physical limitations before data is available', () => {
    const markup = render(routing())
    expect(markup).toContain('HRSC terrain model')
    expect(markup).toContain('Qualified model')
    expect(markup).toContain('Load HRSC DEM')
    expect(markup).toContain('Hypothetical DEM-based model. Physical traversability and human safety are not validated.')
    expect(markup).not.toContain('Compare DEM routes')
    expect(markup).not.toContain('terrain-route-metrics')
    expect(markup).toContain('aria-labelledby="terrain-model-heading"')
  })

  it('shows source verification progress and a disabled loading action', () => {
    const markup = render(routing({ data: { phase: 'loading' } }))
    expect(markup).toContain('Verifying HRSC DEM')
    expect(markup).toContain('Verifying source metadata, native samples and validity mask.')
    expect(markup).toContain('role="status"')
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Verifying HRSC DEM/)
    expect(markup).not.toContain('terrain-route-metrics')
  })

  it('exposes unavailable-source error and retry without displaying old terrain results', () => {
    const markup = render(routing({ data: { phase: 'error', reason: 'Test-only checksum mismatch' } }))
    expect(markup).toContain('Retry HRSC DEM')
    expect(markup).toContain('Test-only checksum mismatch')
    expect(markup).toContain('role="alert"')
    expect(markup).not.toContain('terrain-route-metrics')
  })

  it('gives every profile field an accessible label and displays conservative unknown policy', () => {
    const markup = render(ready())
    for (const key of Object.keys(DEFAULT_TERRAIN_PROFILE).filter(key => key !== 'unknownPolicy')) {
      expect(markup).toContain(`for="terrain-${key}"`)
      expect(markup).toContain(`id="terrain-${key}"`)
    }
    expect(markup).toContain('for="terrain-unknown-policy"')
    expect(markup).toContain('<option value="block" selected="">Block unknown support (default)</option>')
    expect(markup).toContain('Missing or nonfinite heights are always excluded.')
    expect(markup).toContain('Limits are user assumptions, not tested rover specifications.')
    expect(markup).toContain('Step-height constraints and obstacle detection are unavailable at this DEM resolution.')
    expect(markup).not.toContain('id="terrain-maxStepHeight"')
    expect(markup).toContain('Apply rover assumptions')
  })

  it('keeps source identity, provenance, attribution and unresolved scientific issues accessible', () => {
    const markup = render(ready())
    expect(markup).toContain('103 × 103 native cells · 50 m projected spacing · HMC_13E10_DT5')
    expect(markup).toContain('<summary>Scientific details, source &amp; cost model</summary>')
    expect(markup).toContain(grid.source.gridHash)
    expect(markup).toContain(grid.source.sourceHash)
    expect(markup).toContain('Terrain data: ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO')
    expect(markup).toContain('https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_dt5.tif')
    expect(markup).toContain('https://hrscteam.dlr.de/imprint_hrsc_en.php')
    expect(markup).toContain('Physical slope accuracy')
    expect(markup).toContain('remain unverified')
    expect(markup).toContain('HRSC does not resolve the CTX height conflict.')
    expect(markup).toContain('This snap does not establish absolute feature registration.')
    expect(markup).toContain('Export DEM model report')
  })

  it('explains all overlays and disables expanded cells before a route exists', () => {
    const markup = render(ready())
    expect(markup).toContain('for="terrain-overlay"')
    for (const value of ['none', 'elevation', 'slope', 'roughness', 'shape', 'traversability', 'explored']) expect(markup).toContain(`value="${value}"`)
    expect(markup).toContain('<option value="explored" disabled="">A* expanded cells</option>')
    expect(markup).toContain('aria-label="Model traversability legend"')
    for (const label of ['Unknown', 'Traversable', 'High cost', 'Blocked']) expect(markup).toContain(`>${label}</span>`)
    expect(markup).toContain('Hide HRSC model')
    expect(markup).toContain('Show terrain on map')
  })

  it('connects a disabled comparison action to its scientific qualification and endpoint blocker', () => {
    const markup = render(ready({ blocker: 'Test-only endpoint is outside native HRSC coverage.' }))
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="terrain-model-note"[^>]*>Compare DEM routes/)
    expect(markup).toContain('Test-only endpoint is outside native HRSC coverage.')
    expect(markup).not.toContain('terrain-route-metrics')
  })

  it('shows background search, cancellation and retry errors without retaining stale results', () => {
    const loading = render(ready({ state: { phase: 'loading' } }))
    expect(loading).toContain('Comparing DEM routes')
    expect(loading).toContain('Searching terrain costs in a background worker.')
    expect(loading).toContain('Cancel DEM comparison')
    expect(loading).not.toContain('terrain-route-metrics')
    const error = render(ready({ state: { phase: 'error', reason: 'Test-only disconnected destination' } }))
    expect(error).toContain('Retry DEM route comparison')
    expect(error).toContain('Test-only disconnected destination')
    expect(error).toContain('role="alert"')
    expect(error).not.toContain('terrain-route-metrics')
  })

  it('shows exact returned metrics and distinguishes distance from terrain cost without safety claims', () => {
    const markup = render(ready({ state: { phase: 'ready', comparison }, selected: 'terrain' }))
    expect(markup).toContain('aria-label="Select HRSC model route"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('Shortest permitted distance')
    expect(markup).toContain('Lower terrain cost')
    expect(markup).toContain(comparison.terrain.accumulatedCostM.toFixed(1))
    expect(markup).toContain('Maximum edge grade')
    expect(markup).toContain('Mean absolute edge grade')
    expect(markup).toContain('Blocked / unknown search cells')
    expect(markup).toContain(`${comparison.terrain.nodes.length} / ${comparison.terrain.exploredNodes.length}`)
    expect(markup).toContain('Both routes use the same allowed cells and rover limits.')
    expect(markup).toContain('It is not energy, travel time or safety.')
    expect(markup).toContain('Physical traversability and human safety are not validated.')
  })

  it('preserves unknown statistics rather than showing unsupported zero grades or roughness', () => {
    const incomplete = { ...comparison, terrain: { ...comparison.terrain, maxGradeDeg: null, meanAbsGradeDeg: null, maxRoughnessM: null, meanRoughnessM: null, unknownSegments: 2 } }
    const markup = render(ready({ state: { phase: 'ready', comparison: incomplete } }))
    expect(markup).toContain('<dt>Maximum edge grade</dt><dd>Unknown support</dd>')
    expect(markup).toContain('<dt>Mean absolute edge grade</dt><dd>Unknown support</dd>')
    expect(markup).toContain('<dt>Maximum / mean roughness</dt><dd>Unknown support / Unknown support</dd>')
    expect(markup).toContain('<dt>Unknown-support segments</dt><dd>2</dd>')
  })

  it('retains complete native paths, assumptions, source identifiers and limitations in the downloadable report', () => {
    const report = terrainModelReport(analysis, comparison)
    const saved = JSON.parse(JSON.stringify(report))
    expect(saved.source).toEqual(grid.source)
    expect(saved.profile).toEqual(DEFAULT_TERRAIN_PROFILE)
    expect(saved.routes.terrain.nodes).toEqual(comparison.terrain.nodes)
    expect(saved.routes.terrain.points).toEqual(comparison.terrain.points)
    expect(saved.routes.terrain.accumulatedCostM).toBe(comparison.terrain.accumulatedCostM)
    expect(saved.scientificStatus).toBe('physical-terrain-unverified')
    expect(saved.limitations.join(' ')).toContain('Physical Mars slopes')
    expect(saved.limitations.join(' ')).toContain('does not resolve the CTX final vertical equation')
    expect(saved.limitations.join(' ')).toContain('Step heights, rocks, sand traps and hazards are not detected')
    expect(saved.model.unknownPolicy).toContain('Missing/nonfinite heights always excluded')
    expect(saved.model.costUnit).toContain('not energy or travel time')
    expect(saved.evidence).toContain('docs/science-routing-audit.md')
  })

  it('exports an inspected source with no fabricated routes when comparison is unavailable', () => {
    const report = terrainModelReport(analysis, null)
    expect(report.routes).toBeNull()
    expect(report.source.productId).toBe('HMC_13E10_DT5')
    expect(report.scientificStatus).toBe('physical-terrain-unverified')
    expect(report.limitations).toContain(grid.source.qualification)
  })
})
