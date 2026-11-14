/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import sourceManifest from '../../../public/data/jezero-terrain-grid.json'
import { decodeTerrainGrid, parseTerrainGridManifest } from '../../features/terrain/terrainGrid'
import type { PlanningTerrainState } from '../../features/mission/useGridPlanning'
import { MissionStatusBar } from './MissionStatusBar'

function render(terrain: PlanningTerrainState) {
  return renderToStaticMarkup(<MissionStatusBar terrain={terrain} onOpenScientificDetails={vi.fn()} />)
}

describe('honest mission status', () => {
  it('does not report on-demand terrain as loaded', () => {
    const markup = render({ phase: 'idle' })
    expect(markup).toContain('Not loaded')
    expect(markup).toContain('Open Plan to load')
    expect(markup).not.toContain('cells loaded')
  })
  it('distinguishes verification in progress from available terrain', () => {
    const markup = render({ phase: 'loading' })
    expect(markup).toContain('Verifying…')
    expect(markup).not.toContain('cells loaded')
  })
  it('reports failed terrain access with retry guidance', () => {
    const markup = render({ phase: 'error', message: 'Test-only unavailable source' })
    expect(markup).toContain('Unavailable')
    expect(markup).toContain('Retry in Plan')
    expect(markup).not.toContain('cells loaded')
  })
  it('keeps loaded native cells separate from scientific validation and routes', () => {
    const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))).buffer
    const grid = decodeTerrainGrid(parseTerrainGridManifest(sourceManifest), binary)
    const markup = render({ phase: 'ready', grid })
    expect(markup).toContain(`${grid.manifest.summary.validCount.toLocaleString()} cells loaded`)
    expect(markup).toContain('Scientific validation: Partial. Open scientific details')
    expect(markup).toContain('Source-to-grid preservation verified')
    expect(markup).not.toContain('feature registration and height reference unresolved')
    expect(markup).toContain('<dt>Hypothetical routes</dt><dd>Not calculated</dd>')
  })
  it('reports route computation separately from scientific validation', () => {
    for (const [routePhase, expected] of [['loading', 'Calculating…'], ['ready', 'Calculated · distance only'], ['error', 'Calculation unavailable']] as const) {
      const markup = renderToStaticMarkup(<MissionStatusBar terrain={{ phase: 'idle' }} routePhase={routePhase} onOpenScientificDetails={vi.fn()} />)
      expect(markup).toContain(expected)
      expect(markup).toContain('Scientific validation: Partial. Open scientific details')
    }
  })
  it('exposes a named scientific-details action independently of the current activity', () => {
    const markup = renderToStaticMarkup(<MissionStatusBar terrain={{ phase: 'idle' }} activity="explore" onOpenScientificDetails={vi.fn()} />)
    expect(markup).toContain('<button type="button"')
    expect(markup).toContain('aria-label="Scientific validation: Partial. Open scientific details"')
    expect(markup).toContain('aria-controls="scientific-details"')
    expect(markup).toContain('<strong>Partial</strong>')
  })
  it('keeps planning load and route statuses contextual without treating other activities as errors', () => {
    for (const activity of ['explore', 'layers', 'sources'] as const) {
      const markup = renderToStaticMarkup(<MissionStatusBar terrain={{ phase: 'error', message: 'Test-only failure' }} routePhase="error" activity={activity} onOpenScientificDetails={vi.fn()} />)
      expect(markup).toContain('Scientific validation: Partial. Open scientific details')
      expect(markup).not.toContain('Terrain data')
      expect(markup).not.toContain('Hypothetical routes')
      expect(markup).not.toContain('Calculation unavailable')
    }
    const planning = renderToStaticMarkup(<MissionStatusBar terrain={{ phase: 'error', message: 'Test-only failure' }} routePhase="error" activity="plan" onOpenScientificDetails={vi.fn()} />)
    expect(planning).toContain('Retry in Plan')
    expect(planning).toContain('Calculation unavailable')
  })
})
