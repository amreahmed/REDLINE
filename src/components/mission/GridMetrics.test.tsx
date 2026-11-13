/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import sourceManifest from '../../../public/data/jezero-terrain-grid.json'
import { initialGridSelection, assignGridEndpoint } from '../../features/mission/gridSelection'
import { decodeTerrainGrid, parseTerrainGridManifest } from '../../features/terrain/terrainGrid'
import { GridMetrics } from './GridMetrics'

const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))).buffer
const grid = decodeTerrainGrid(parseTerrainGridManifest(sourceManifest), binary)
const origin = assignGridEndpoint(grid, initialGridSelection, 'origin', 714, 650).selection
const pair = assignGridEndpoint(grid, origin, 'destination', 714, 651).selection

describe('truthful endpoint geometry presentation', () => {
  it.each([initialGridSelection, origin])('waits for both endpoints without fabricated metrics', (selection) => {
    const markup = renderToStaticMarkup(<GridMetrics grid={grid} selection={selection} />)
    expect(markup).toContain('Select both grid endpoints')
    expect(markup).not.toContain('<dd>')
    expect(markup).toContain('DEM slopes and terrain costs unavailable')
  })

  it('reports separation with its model, endpoint-only support and blocked DEM metrics', () => {
    const markup = renderToStaticMarkup(<GridMetrics grid={grid} selection={pair} />)
    expect(markup).toContain(`${(18.9686745905).toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m`)
    expect(markup).toContain('Reference-sphere separation')
    expect(markup).toContain('checks endpoint cells only')
    expect(markup).toContain('not a route length or a terrain profile')
    expect(markup).toContain('synthetic fixtures')
    expect(markup).toContain('height reference unresolved')
  })

  it('does not reuse measurements when endpoint provenance differs', () => {
    if (!pair.origin) throw new Error('Fixture origin unavailable')
    const selection = { ...pair, origin: { ...pair.origin, sourceId: 'test-only-different-source' } }
    const markup = renderToStaticMarkup(<GridMetrics grid={grid} selection={selection} />)
    expect(markup).toContain('do not belong to the loaded terrain source')
    expect(markup).not.toContain('<dd>')
  })

  it('propagates missing support after selection instead of displaying old distance', () => {
    const values = grid.values.slice()
    values[(714 - 586) * 256 + 650 - 522] = grid.manifest.sourceGrid.noData
    const markup = renderToStaticMarkup(<GridMetrics grid={{ manifest: grid.manifest, values }} selection={pair} />)
    expect(markup).toContain('Distance unavailable')
    expect(markup).toContain('NoData')
    expect(markup).not.toContain('<dd>')
  })
})
