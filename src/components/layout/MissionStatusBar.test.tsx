/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import sourceManifest from '../../../public/data/jezero-terrain-grid.json'
import { decodeTerrainGrid, parseTerrainGridManifest } from '../../features/terrain/terrainGrid'
import type { PlanningTerrainState } from '../../features/mission/useGridPlanning'
import { MissionStatusBar } from './MissionStatusBar'

function render(terrain: PlanningTerrainState) {
  return renderToStaticMarkup(<MissionStatusBar terrain={terrain} />)
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
    expect(markup).toContain('<dt>Scientific validation</dt><dd>Partial')
    expect(markup).toContain('feature registration and height reference unresolved')
    expect(markup).toContain('<dt>Route comparison</dt><dd>Unavailable</dd>')
  })
})
