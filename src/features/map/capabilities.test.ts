import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { MARS_LAYERS } from '../../data/marsLayers'
import { readCapabilities } from './capabilities'
import molaXml from '../../../docs/evidence/phase-2/Mars_MGS_MOLA_ClrShade_merge_global_463m.WMTSCapabilities.xml?raw'
import ctxXml from '../../../docs/evidence/phase-2/Jezero_CTX_BlockAdj_dd.WMTSCapabilities.xml?raw'
import controlledCtxXml from '../../../docs/evidence/challenge-resources-2026-11-13/controlled-ctx-capabilities.xml?raw'
import controlledNativeLabel from '../../../docs/evidence/terrain-validation/registration-sources/controlled-ctx-isis.lbl?raw'

// The test DOM supplies the standard XML APIs used by the browser parser.
const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document
const fixture = (id: string) => id === MARS_LAYERS[0].productId ? molaXml : id === MARS_LAYERS[1].productId ? ctxXml : controlledCtxXml

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
  it('pins the controlled image lineage, native spacing and exact layer identity independently', () => {
    const controlled = MARS_LAYERS.find((layer) => layer.id === 'controlledCtx')!
    expect(controlled.productId).toBe('JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0')
    expect(controlled.extent).toEqual([77.1604655, 18.2110274, 77.6991776, 18.7211945])
    expect(controlled.maxLevel).toBe(13)
    expect(controlled.sourceUrl).toBe('https://doi.org/10.5066/P9GV1ND3')
    expect(controlled.resolution).toMatch(/6 m native.*resample/)
    expect(controlled.limitation).toMatch(/3,396,190 m sphere/)
    expect(() => readCapabilities(controlledCtxXml.replaceAll('77.1604655 18.2110274', '18.2110274 77.1604655'), controlled, parseXml)).toThrow()
    expect(() => readCapabilities(controlledCtxXml.replaceAll('JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0', 'Jezero_CTX_BlockAdj_dd'), controlled, parseXml)).toThrow()
  })
  it('agrees with all native projected image corners using the provider-declared sphere', () => {
    const controlled = MARS_LAYERS.find((layer) => layer.id === 'controlledCtx')!
    const number = (key: string) => Number(controlledNativeLabel.match(new RegExp(`^\\s*${key}\\s*=\\s*([0-9.+-]+)`, 'm'))?.[1])
    expect(number('EquatorialRadius')).toBe(3_396_190)
    expect(number('PolarRadius')).toBe(3_396_190)
    expect(number('PixelResolution')).toBe(6)
    expect(number('Samples')).toBe(5322)
    expect(number('Lines')).toBe(5040)
    expect(controlledNativeLabel).toMatch(/LatitudeType\s*= Planetocentric/)
    expect(controlledNativeLabel).toMatch(/LongitudeDirection\s*= PositiveEast/)
    const metersPerDegree = number('EquatorialRadius') * Math.PI / 180
    const west = number('UpperLeftCornerX') / metersPerDegree
    const north = number('UpperLeftCornerY') / metersPerDegree
    const east = (number('UpperLeftCornerX') + number('Samples') * number('PixelResolution')) / metersPerDegree
    const south = (number('UpperLeftCornerY') - number('Lines') * number('PixelResolution')) / metersPerDegree
    for (const [value, index] of [[west, 0], [south, 1], [east, 2], [north, 3]]) expect(value).toBeCloseTo(controlled.extent[index], 7)
  })
})
