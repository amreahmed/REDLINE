import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { JEZERO_CONTEXT_ZOOM, JEZERO_DETAIL_ZOOM, JEZERO_NAVIGATION } from '../../data/jezero'
import { MARS_LAYERS } from '../../data/marsLayers'
import { readCapabilities } from './capabilities'
import { createDisplayProjection, createTileSource } from './mapProjection'
import { clampApproachZoom, clampDetailOpacity, jezeroCenter } from './jezeroView'
import ctxXml from '../../../docs/evidence/phase-2/Jezero_CTX_BlockAdj_dd.WMTSCapabilities.xml?raw'
import gazetteer from '../../../docs/evidence/terrain-detail-audit/hirise-jezero-gazetteer.html?raw'

describe('published Jezero navigation framing', () => {
  it('uses the cited planetocentric east-positive crater center, not the mosaic midpoint', () => {
    expect(gazetteer).toMatch(/Planetocentric, \+East, 0 - 360/)
    expect(gazetteer).toMatch(/Center Latitude<\/th>\s*<td>\s*18\.41/)
    expect(gazetteer).toMatch(/Center Longitude<\/th>\s*<td>\s*77\.69/)
    expect(JEZERO_NAVIGATION.sourceUrl).toBe('https://planetarynames.wr.usgs.gov/Feature/14300')
    expect(jezeroCenter()).toEqual([77.69, 18.41])
    expect(JEZERO_NAVIGATION.limitation).toContain('not an exact science target')
    const bounds = MARS_LAYERS[1].extent
    const [longitude, latitude] = jezeroCenter()
    expect(longitude).toBeGreaterThan(bounds[0])
    expect(longitude).toBeLessThan(bounds[2])
    expect(latitude).toBeGreaterThan(bounds[1])
    expect(latitude).toBeLessThan(bounds[3])
  })

  it('returns independent center arrays for mutable OpenLayers views', () => {
    const first = jezeroCenter()
    first[0] = 0
    expect(jezeroCenter()).toEqual([77.69, 18.41])
  })

  it('keeps scripted approach scale within context and supported close-up bounds', () => {
    expect(JEZERO_CONTEXT_ZOOM).toBe(4)
    expect(JEZERO_DETAIL_ZOOM).toBe(10)
    expect(clampApproachZoom(-20)).toBe(4)
    expect(clampApproachZoom(7.5)).toBe(7.5)
    expect(clampApproachZoom(50)).toBe(10)
    expect(clampApproachZoom(NaN)).toBe(4)
    expect(clampApproachZoom(Infinity)).toBe(4)
  })

  it('clamps CTX reveal opacity while rejecting non-finite values', () => {
    expect([-1, 0, 0.3, 1, 2, NaN].map(clampDetailOpacity)).toEqual([0, 0, 0.3, 1, 1, 0])
  })

  it('uses actual CTX matrices 10–12 and longitude/row conventions at the corrected center', () => {
    const definition = MARS_LAYERS[1]
    const contract = readCapabilities(ctxXml, definition, (xml) => new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document)
    const projection = createDisplayProjection()
    const source = createTileSource(definition, contract, projection, () => {})
    try {
      const grid = source.getTileGrid()!
      for (const [zoom, column, row] of [[10, 1465, 407], [11, 2931, 814], [12, 5863, 1629]]) {
        const tile = grid.getTileCoordForCoordAndZ(jezeroCenter(), zoom)
        expect(tile).toEqual([zoom, column, row])
        expect(grid.getResolution(zoom)).toBe(0.703125 / 2 ** zoom)
        expect(source.getTileUrlFunction()(tile, 1, projection)).toBe(`https://trek.nasa.gov/tiles/Mars/EQ/Jezero_CTX_BlockAdj_dd/1.0.0//default/default028mm/${zoom}/${row}/${column}.png`)
      }
    } finally {
      source.dispose()
    }
  })
})
