import type { LayerDefinition } from '../features/map/types'

export const TREK_DOCUMENTATION = 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars'
export const ADVERTISED_CRS = 'urn:ogc:def:crs:EPSG::104905'

// Bundled provenance from saved 25 October and 13 November 2026 provider responses.
// These are display products. Catalog ingestion dates are not acquisition dates.
export const MARS_LAYERS: readonly LayerDefinition[] = [
  {
    id: 'mola',
    name: 'MOLA color hillshade',
    productId: 'Mars_MGS_MOLA_ClrShade_merge_global_463m',
    mission: 'Mars Global Surveyor / MOLA',
    description: 'Global shaded-relief context',
    capabilitiesUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml',
    sourceUrl: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_global_color_shaded_relief_463m',
    format: 'image/jpeg',
    extent: [-180, -89.9991635, 179.9983271, 90],
    maxLevel: 7,
    resolution: '463 m nominal source spacing; tile levels 0–7.',
    attribution: 'NASA/MGS/MOLA; USGS Astrogeology; served by NASA/JPL-Caltech Mars Trek',
    limitation: 'Colorized relief is a rendered image, not numerical elevation. Zooming beyond tile level 7 enlarges existing pixels.',
  },
  {
    id: 'ctx',
    name: 'Jezero CTX imagery',
    productId: 'Jezero_CTX_BlockAdj_dd',
    mission: 'Mars Reconnaissance Orbiter / CTX',
    description: 'Preliminary regional mosaic',
    capabilitiesUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/Jezero_CTX_BlockAdj_dd/1.0.0/WMTSCapabilities.xml',
    sourceUrl: 'https://trek.nasa.gov/mars/',
    format: 'image/png',
    extent: [75.1537692, 15.9058484, 78.8717121, 19.4453003],
    maxLevel: 12,
    resolution: 'CTX instrument: up to 6 m/pixel. Effective mosaic resolution is unverified; tile levels 0–12.',
    attribution: 'NASA/MRO/CTX; served by NASA/JPL-Caltech Mars Trek',
    limitation: 'Preliminary mosaic with regional coverage. Fine registration and the native product latitude convention remain unverified.',
  },
  {
    id: 'controlledCtx',
    name: 'Controlled Jezero CTX imagery',
    productId: 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0',
    mission: 'Mars Reconnaissance Orbiter / CTX; USGS photogrammetric mosaic',
    description: 'Source-controlled regional orthomosaic',
    capabilitiesUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/WMTSCapabilities.xml',
    sourceUrl: 'https://doi.org/10.5066/P9GV1ND3',
    format: 'image/png',
    extent: [77.1604655, 18.2110274, 77.6991776, 18.7211945],
    maxLevel: 13,
    resolution: '6 m native projected image pixels; rendered angular tiles at levels 0–13 resample the source.',
    attribution: 'NASA/MRO/CTX; USGS Astrogeology (doi:10.5066/P9GV1ND3); served by NASA/JPL-Caltech Mars Trek',
    limitation: 'Rendered imagery, not elevation. Native equirectangular source uses planetocentric latitude, positive-east longitude, and a 3,396,190 m sphere. Shared photogrammetric lineage supports placement relative to the source DEM; it does not validate MDIM 2.1 feature-center registration or new absolute landmark accuracy.',
  },
]

export const JEZERO_EXTENT = MARS_LAYERS[1].extent
