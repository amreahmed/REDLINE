import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { MARS_LAYERS } from '../../data/marsLayers'
import { readCapabilities } from './capabilities'
import molaXml from '../../../docs/evidence/phase-2/Mars_MGS_MOLA_ClrShade_merge_global_463m.WMTSCapabilities.xml?raw'
import ctxXml from '../../../docs/evidence/phase-2/Jezero_CTX_BlockAdj_dd.WMTSCapabilities.xml?raw'

// The test DOM supplies the standard XML APIs used by the browser parser.
const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document
const fixture = (id: string) => id === MARS_LAYERS[0].productId ? molaXml : ctxXml

describe('actual Mars Trek capabilities', () => {
  for (const layer of MARS_LAYERS) {
    it(`validates the saved ${layer.id} contract`, () => {
      const contract = readCapabilities(fixture(layer.productId), layer, parseXml)
      expect(contract.extent).toEqual(layer.extent)
      expect(contract.matrixIds).toEqual(Array.from({ length: layer.maxLevel + 1 }, (_, z) => String(z)))
      expect(contract.resolutions[0]).toBe(0.703125)
      expect(contract.resolutions.at(-1)).toBe(0.703125 / 2 ** layer.maxLevel)
      expect(contract.tileSize).toBe(256)
      expect(contract.origin).toEqual([-180, 90])
      expect(contract.template).toContain('/1.0.0//{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}')
    })
  }

  const ctx = MARS_LAYERS[1]
  const xml = fixture(ctx.productId)
  it.each([
    ['axis order', '-180.0 90.0', '90.0 -180.0'],
    ['matrix width', '<MatrixWidth>2.0</MatrixWidth>', '<MatrixWidth>3.0</MatrixWidth>'],
    ['matrix ID', '<TileMatrix><ows:Identifier>0</ows:Identifier>', '<TileMatrix><ows:Identifier>unexpected</ows:Identifier>'],
    ['CRS', 'urn:ogc:def:crs:EPSG::104905', 'EPSG:3857'],
    ['coverage', '75.1537692 15.9058484', '0 0'],
    ['tile endpoint', 'template="https://trek.nasa.gov/', 'template="https://example.org/'],
  ])('rejects changed %s instead of silently misplacing imagery', (_, from, to) => {
    expect(() => readCapabilities(xml.replaceAll(from, to), ctx, parseXml)).toThrow()
  })
  it('rejects non-capabilities responses', () => {
    expect(() => readCapabilities('<html><body>Service unavailable</body></html>', ctx, parseXml)).toThrow()
  })
})
