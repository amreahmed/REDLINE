import { MARS_LAYERS, TREK_DOCUMENTATION } from './marsLayers'
import type { Bounds, LayerId, TileContract } from '../features/map/types'

export type GlobeLayerId = 'viking' | 'globalCtx' | 'mola' | 'ctx' | 'controlledCtx' | 'hirise'
export type GlobeImageryLayer = {
  id: GlobeLayerId
  name: string
  category: 'imagery' | 'relief'
  source: string
  projection: string
  coverage: Bounds
  resolution: string
  minZoom: number
  maxZoom: number
  tileSource: TileContract
  noData: string
  attribution: string
  registrationStatus: 'uncontrolled' | 'source-controlled' | 'unverified'
  limitations: string
  sourceUrl: string
  capabilitiesUrl: string
  metadataUrl?: string
  regionalLayerId?: LayerId
}

/** Inspected angular display pyramids, not physical scale or numerical terrain. */
function angularContract(extent: Bounds, maxZoom: number, tileSize: number, format: 'image/png' | 'image/jpeg', template: string): TileContract {
  return {
    extent: [...extent], origin: [-180, 90], matrixSet: 'default028mm',
    matrixIds: Array.from({ length: maxZoom + 1 }, (_, z) => String(z)),
    resolutions: Array.from({ length: maxZoom + 1 }, (_, z) => 360 / (tileSize * 2 ** (z + 1))),
    sizes: Array.from({ length: maxZoom + 1 }, (_, z) => [2 ** (z + 1), 2 ** z]),
    tileSize, style: 'default', format, template,
  }
}

const globalExtent: Bounds = [-180, -90, 180, 90]
const vikingProduct = 'Mars_Viking_MDIM21_ClrMosaic_global_232m'
const vikingCapabilities = `https://trek.nasa.gov/tiles/Mars/EQ/${vikingProduct}/1.0.0/WMTSCapabilities.xml`
const globalCapabilities = 'https://trek.nasa.gov/tiles/Mars/EQ/CTX_beta01_uncontrolled_5m_Caltech/1.0.0/WMTSCapabilities.xml'
const hiriseProduct = 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd'
const hiriseExtent: Bounds = [77.2229331, 18.3067994, 77.583964, 18.669315]
const hiriseCapabilities = `https://trek.nasa.gov/tiles/Mars/EQ/${hiriseProduct}/1.0.0/WMTSCapabilities.xml`

// Verified 15 November 2026 HTTP receipts and exact capabilities are in
// docs/evidence/global-globe/sources/. Beta01 is not the later Caltech V01.
export const GLOBE_LAYERS: readonly GlobeImageryLayer[] = [
  {
    id: 'viking', name: 'Mars Trek Viking basemap', category: 'imagery',
    source: 'NASA Viking 1 and Viking 2 Orbiter Imaging Systems; NASA/JPL-Caltech Mars Trek',
    projection: 'Trek angular longitude/latitude display grid in degrees, origin −180°, +90°, east-positive signed longitude. Advertised EPSG:104905 is not used as an Earth projection. Native latitude definition and absolute landmark registration have not been independently validated.',
    coverage: globalExtent,
    resolution: 'Viking MDIM 2.1 color mosaic, 232 m product label. Streamed angular pixel resolution varies with level (0–7) and latitude.',
    minZoom: 0, maxZoom: 7,
    tileSource: angularContract(globalExtent, 7, 256, 'image/jpeg', vikingCapabilities.replace('/WMTSCapabilities.xml', '') + '/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg'),
    noData: 'Failed or missing tiles remain absent. The advertised global bounds do not establish a numerical or per-pixel validity mask.',
    attribution: 'NASA/Viking Orbiter Imaging Systems; NASA/JPL-Caltech Mars Trek',
    registrationStatus: 'unverified',
    limitations: 'The current official Mars Trek configuration selects Mars_Viking_MDIM21_ClrMosaic_global_232m as its main equirectangular basemap. This is rendered Viking color imagery, not numerical elevation. Absolute feature registration and native latitude definition remain unverified. The catalog metadata contains placeholder dates and terms; REDLINE makes no new acquisition-date or unrestricted-use claim.',
    sourceUrl: `https://trek.nasa.gov/mars/TrekWS/rest/cat/abstract?label=${vikingProduct}`,
    capabilitiesUrl: vikingCapabilities,
    metadataUrl: `https://trek.nasa.gov/mars/TrekWS/rest/cat/metadata/fgdc/html?label=${vikingProduct}`,
  },
  {
    id: 'globalCtx', name: 'Global CTX · Beta01', category: 'imagery',
    source: 'NASA/MRO/CTX; Caltech Murray Lab; Esri tile service',
    projection: 'Mars 2000 sphere geographic coordinates (radius 3,396,190 m), longitude then latitude in degrees; east-positive, signed longitude. Sphere latitude is planetocentric. Trek advertises EPSG:104905; the actual Esri source declares GCS_Mars_2000_Sphere (104971).',
    coverage: globalExtent,
    resolution: 'CTX nominal ~5 m/pixel; streaming levels 0–12. Level 12 pixels span about 5.09 m along the reference-sphere equator; angular pixels do not give uniform ground resolution. Trek lists 0–11; level 12 is verified on the same Esri source.',
    minZoom: 0, maxZoom: 12,
    tileSource: angularContract(globalExtent, 12, 512, 'image/png', 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{TileMatrix}/{TileRow}/{TileCol}'),
    noData: 'Missing requests and mosaic gaps are not filled. No numerical or per-pixel validity mask is established for this rendered service.',
    attribution: 'NASA/JPL/MSSS/Caltech Murray Lab/Esri',
    registrationStatus: 'uncontrolled',
    limitations: 'Preliminary uncontrolled Beta01 imagery, not the later V01 release. Advertised global extent does not guarantee complete imagery, especially near the poles. V01 coverage percentages must not be applied to this product. The provider describes lossy 8-bit rendering; pixels are imagery, not elevation. Nominal source resolution does not describe every streamed overview. The same Esri source advertises levels 0–17, but REDLINE stops at tested level 12; Trek WMTS itself lists only 0–11. Absolute feature registration remains unverified.',
    sourceUrl: 'https://trek.nasa.gov/mars/TrekWS/rest/cat/metadata/fgdc/html?label=CTX_beta01_uncontrolled_5m_Caltech',
    capabilitiesUrl: globalCapabilities,
    metadataUrl: 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer?f=pjson',
  },
  ...MARS_LAYERS.map((layer): GlobeImageryLayer => ({
    id: layer.id, name: layer.name, category: layer.id === 'mola' ? 'relief' : 'imagery',
    source: layer.mission, coverage: [...layer.extent], resolution: layer.resolution,
    projection: layer.id === 'controlledCtx'
      ? 'Trek angular longitude/latitude display grid in degrees. Native source is equirectangular, planetocentric, east-positive on the 3,396,190 m sphere. Advertised EPSG:104905 is not used as an Earth projection.'
      : 'Trek angular longitude/latitude display grid, east-positive longitude in degrees. Advertised EPSG:104905 is not used as an Earth projection. Native latitude and fine cross-product registration qualifications remain in the source details.',
    minZoom: 0, maxZoom: layer.maxLevel,
    tileSource: angularContract(layer.extent, layer.maxLevel, 256, layer.format, layer.capabilitiesUrl.replace('/WMTSCapabilities.xml', '') + `/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${layer.format === 'image/png' ? 'png' : 'jpg'}`),
    noData: 'Transparent or missing service tiles remain absent; no numerical elevation encoding.',
    attribution: layer.attribution, registrationStatus: layer.id === 'controlledCtx' ? 'source-controlled' : 'unverified',
    limitations: layer.limitation, sourceUrl: layer.sourceUrl, capabilitiesUrl: layer.capabilitiesUrl,
    regionalLayerId: layer.id,
  })),
  {
    id: 'hirise', name: 'Jezero HiRISE orthomosaic', category: 'imagery',
    source: 'NASA/MRO/HiRISE; USGS Astrogeology; NASA/JPL-Caltech Mars Trek',
    projection: 'Trek angular longitude/latitude display grid in degrees. Native first product label: equirectangular latitude 0°, longitude 0°, planetocentric, positive-east, domain 180, on the 3,396,190 m sphere. No independent absolute feature-to-imagery registration has been established by REDLINE.',
    coverage: hiriseExtent,
    resolution: '25 cm native projected image pixels, verified in the source label. Angular tiles resample the source; displayed resolution depends on level (0–17).',
    minZoom: 0, maxZoom: 17,
    tileSource: angularContract(hiriseExtent, 17, 256, 'image/png', hiriseCapabilities.replace('/WMTSCapabilities.xml', '') + '/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png'),
    noData: 'No imagery is shown outside the published footprint. Missing or transparent tiles are not filled.',
    attribution: 'NASA/MRO/HiRISE; USGS Astrogeology; served by NASA/JPL-Caltech Mars Trek',
    registrationStatus: 'source-controlled',
    limitations: 'Source catalog calls this a controlled Jezero orthomosaic. Shared provider control does not establish independent absolute landmark accuracy. This is the first_dd imagery mosaic, not a numerical DTM and not the separate nonoverlapping HiRISE DTM in the prior height audit. No height, hazard or safety result is derived from it.',
    sourceUrl: `https://trek.nasa.gov/mars/TrekWS/rest/cat/metadata/fgdc/html?label=${hiriseProduct}`,
    capabilitiesUrl: hiriseCapabilities,
  },
]

export const GLOBE_SOURCE_DOCUMENTATION = TREK_DOCUMENTATION

export function globeLayerById(id: GlobeLayerId): GlobeImageryLayer {
  const layer = GLOBE_LAYERS.find(candidate => candidate.id === id)
  if (!layer) throw new Error('Unknown globe imagery layer.')
  return layer
}
