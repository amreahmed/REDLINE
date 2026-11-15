import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { GLOBE_LAYERS, globeLayerById } from './globeLayers'
import type { GlobeLayerId } from './globeLayers'
import vikingXml from '../../docs/evidence/global-globe/sources/viking-capabilities.xml?raw'
import trekBasemaps from '../../docs/evidence/global-globe/sources/trek-main-basemap-list.json'
import globalXml from '../../docs/evidence/global-globe/sources/global-ctx-capabilities.xml?raw'
import molaXml from '../../docs/evidence/global-globe/sources/mola-capabilities.xml?raw'
import ctxXml from '../../docs/evidence/global-globe/sources/preliminary-ctx-capabilities.xml?raw'
import controlledXml from '../../docs/evidence/global-globe/sources/controlled-ctx-capabilities.xml?raw'
import hiriseXml from '../../docs/evidence/global-globe/sources/hirise-capabilities.xml?raw'
import globalArcgis from '../../docs/evidence/global-globe/sources/global-ctx-arcgis.json'

const WMTS = 'http://www.opengis.net/wmts/1.0'
const OWS = 'http://www.opengis.net/ows/1.1'
const fixtures: Record<GlobeLayerId, string> = { viking: vikingXml, globalCtx: globalXml, mola: molaXml, ctx: ctxXml, controlledCtx: controlledXml, hirise: hiriseXml }

describe('globe imagery source contracts', () => {
  it.each(GLOBE_LAYERS.map(layer => [layer.id] as const))('%s matches exact live saved WMTS angular matrices and footprint', id => {
    const layer = globeLayerById(id)
    const xml = new DOMParser().parseFromString(fixtures[id], 'text/xml')
    const bounds = Array.from(xml.getElementsByTagNameNS(OWS, 'BoundingBox'))[0]!
    const values = ['LowerCorner', 'UpperCorner'].flatMap(name => bounds.getElementsByTagNameNS(OWS, name)[0]!.textContent!.trim().split(/\s+/).map(Number))
    expect(layer.coverage).toEqual(values)
    expect(layer.tileSource.extent).toEqual(values)
    const matrices = Array.from(xml.getElementsByTagNameNS(WMTS, 'TileMatrix'))
    expect(matrices).toHaveLength(id === 'globalCtx' ? 12 : layer.maxZoom + 1)
    for (const [z, matrix] of matrices.entries()) {
      const text = (name: string, namespace = WMTS) => matrix.getElementsByTagNameNS(namespace, name)[0]!.textContent!.trim()
      expect(text('Identifier', OWS)).toBe(layer.tileSource.matrixIds[z])
      expect(text('TopLeftCorner').split(/\s+/).map(Number)).toEqual(layer.tileSource.origin)
      expect(Number(text('TileWidth'))).toBe(layer.tileSource.tileSize)
      expect(Number(text('TileHeight'))).toBe(layer.tileSource.tileSize)
      const size = [Number(text('MatrixWidth')), Number(text('MatrixHeight'))]
      expect(size).toEqual(layer.tileSource.sizes[z])
      expect(layer.tileSource.resolutions[z]).toBe(360 / (size[0]! * layer.tileSource.tileSize))
    }
    const resource = xml.getElementsByTagNameNS(WMTS, 'ResourceURL')[0]!
    expect(layer.tileSource.template).toBe(resource.getAttribute('template')!.replace('/1.0.0//', '/1.0.0/'))
    expect(layer.tileSource.format).toBe(resource.getAttribute('format'))
  })

  it('uses the current official Mars Trek default Viking product before the alternate global CTX layer', () => {
    const officialProduct = 'Mars_Viking_MDIM21_ClrMosaic_global_232m'
    expect(trekBasemaps.defaultBasemaps[0]).toBe(officialProduct)
    expect(trekBasemaps.basemaps.equirect).toContain(officialProduct)
    expect(GLOBE_LAYERS[0]?.id).toBe('viking')
    const layer = globeLayerById('viking')
    expect(layer.capabilitiesUrl).toContain(`/${officialProduct}/`)
    expect(layer.maxZoom).toBe(7)
    expect(layer.tileSource.matrixIds).toEqual(['0', '1', '2', '3', '4', '5', '6', '7'])
    expect(layer.tileSource.format).toBe('image/jpeg')
    expect(layer.coverage).toEqual([-180, -90, 180, 90])
    expect(layer.source).toContain('Viking 1 and Viking 2')
    expect(layer.registrationStatus).toBe('unverified')
    expect(layer.limitations).toContain('not numerical elevation')
    expect(layer.limitations).toContain('placeholder dates and terms')
    expect(GLOBE_LAYERS.some(candidate => candidate.id === 'globalCtx')).toBe(true)
  })

  it('extends only global level 12 using the exact linked Esri cache rather than claiming an extra Trek WMTS matrix', () => {
    const layer = globeLayerById('globalCtx')
    expect(layer.maxZoom).toBe(12)
    expect(layer.tileSource.matrixIds).toHaveLength(13)
    expect(layer.metadataUrl).toBe('https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer?f=pjson')
    expect(globalArcgis.serviceDescription).toContain('CTX uncontrolled')
    expect(globalArcgis.spatialReference.wkt).toContain('GCS_Mars_2000_Sphere')
    expect(globalArcgis.spatialReference.wkt).toContain('3396190.0')
    expect(globalArcgis.tileInfo.origin).toEqual({ x: -180, y: 90 })
    expect(globalArcgis.tileInfo.cols).toBe(layer.tileSource.tileSize)
    expect(globalArcgis.tileInfo.rows).toBe(layer.tileSource.tileSize)
    const lod = globalArcgis.tileInfo.lods.find(value => value.level === 12)!
    expect(lod.resolution).toBe(layer.tileSource.resolutions[12])
    expect(layer.tileSource.sizes[12]).toEqual([8192, 4096])
    const equatorialPixelM = lod.resolution * Math.PI / 180 * 3396190
    expect(equatorialPixelM).toBeGreaterThan(5.08)
    expect(equatorialPixelM).toBeLessThan(5.10)
    expect(layer.resolution).toContain('do not give uniform ground resolution')
    expect(layer.limitations).toContain('stops at tested level 12')
  })

  it('keeps the global 512-pixel Esri pyramid distinct from 256-pixel regional pyramids', () => {
    expect(globeLayerById('globalCtx').tileSource.tileSize).toBe(512)
    expect(globeLayerById('globalCtx').tileSource.resolutions[0]).toBe(0.3515625)
    for (const id of ['viking', 'mola', 'ctx', 'controlledCtx', 'hirise'] as const) {
      expect(globeLayerById(id).tileSource.tileSize).toBe(256)
      expect(globeLayerById(id).tileSource.resolutions[0]).toBe(0.703125)
    }
  })

  it('identifies Beta01 rather than applying the later V01 coverage or registration claim', () => {
    const global = globeLayerById('globalCtx')
    expect(global.name).toContain('Beta01')
    expect(global.registrationStatus).toBe('uncontrolled')
    expect(global.limitations).toContain('not the later V01')
    expect(global.resolution).not.toContain('99.5')
    expect(global.limitations).toContain('does not guarantee complete imagery')
  })

  it('separates rendered relief and source-controlled imagery from scientific absolute registration', () => {
    expect(globeLayerById('mola').category).toBe('relief')
    expect(globeLayerById('mola').limitations).toContain('not numerical elevation')
    expect(globeLayerById('ctx').registrationStatus).toBe('unverified')
    expect(globeLayerById('controlledCtx').registrationStatus).toBe('source-controlled')
    expect(globeLayerById('controlledCtx').limitations).toContain('does not validate')
  })

  it('treats local HiRISE as source-controlled rendered imagery with a limited actual footprint', () => {
    const layer = globeLayerById('hirise')
    expect(layer.coverage).toEqual([77.2229331, 18.3067994, 77.583964, 18.669315])
    expect(layer.registrationStatus).toBe('source-controlled')
    expect(layer.limitations).toContain('not a numerical DTM')
    expect(layer.limitations).toContain('not the separate nonoverlapping HiRISE DTM')
    expect(layer.noData).toContain('outside the published footprint')
  })

  it('retains NASA attribution, public source references, and missing-data qualifications for every layer', () => {
    for (const layer of GLOBE_LAYERS) {
      expect(layer.attribution).toContain('NASA')
      expect(layer.sourceUrl).toMatch(/^https:\/\//)
      expect(layer.capabilitiesUrl).toMatch(/^https:\/\/trek\.nasa\.gov\//)
      expect(layer.noData.length).toBeGreaterThan(20)
      expect(layer.limitations.length).toBeGreaterThan(50)
      expect(layer.projection).toContain('degrees')
    }
  })
})
