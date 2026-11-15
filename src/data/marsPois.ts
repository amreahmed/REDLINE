import { SCIENCE_TARGETS } from './scienceTargets'

export type MarsPoi = {
  readonly id: string
  readonly name: string
  readonly category: 'mission' | 'landmark' | 'science' | 'impact'
  readonly longitude: number
  readonly latitude: number
  readonly description: string
  readonly sourceUrl: string
  readonly sourceName: string
  readonly coordinateReference: string
  readonly coordinateAccuracy: string
  readonly confidence: string
  readonly mission?: string
  /** Landing date, not kernel creation date or current rover observation time. */
  readonly eventDate?: string
  readonly references?: readonly { readonly name: string; readonly url: string }[]
  readonly images?: readonly { readonly url: string; readonly attribution: string }[]
  readonly relatedLayers?: readonly string[]
}

const gazetteerSource = 'IAU Working Group for Planetary System Nomenclature / USGS Astrogeology'
const gazetteerReference = 'MDIM 2.1; planetocentric latitude; east-positive longitude, 0–360°.'
const gazetteerAccuracy = 'Approximate published feature center, rounded to 0.01°; no metre accuracy established. Not independently registered to CTX imagery or the DEM.'
const gazetteerConfidence = 'Published center verified against source; absolute feature registration unverified.'
const kernelAccuracy = 'No positional uncertainty supplied by the kernel; decimal precision is not accuracy. Not independently registered to global CTX imagery or the DEM.'
const kernelConfidence = 'Archived landing vector and planetocentric conversion verified; absolute imagery/DEM registration unverified.'
const missionReference = 'Planetocentric latitude; east-positive longitude, 0–360°.'
const merCatalog = 'https://pds-geosciences.wustl.edu/mer/mer1-m-pancam-3-radcal-sci-v2/mer1pc_1002/catalog/mission.cat'
const naifArchive = 'https://naif.jpl.nasa.gov/pub/naif/'

// Globe exploration references only. These records neither alter scientific
// targets nor become precise planning endpoints. Evidence and derivations:
// docs/evidence/global-globe/pois/README.md. No live position is inferred.
export const MARS_POIS: readonly MarsPoi[] = [
  {
    id: 'perseverance', name: 'Perseverance landing site', category: 'mission',
    longitude: 77.45088572, latitude: 18.444627153952787,
    description: 'NASA’s Mars 2020 rover landed in Jezero crater to seek signs of ancient life and collect rock and regolith samples. This marker is its archived landing reference, not its current position.',
    mission: 'NASA Mars 2020 / Perseverance', eventDate: '2021-02-18',
    sourceUrl: `${naifArchive}pds/pds4/mars2020/mars2020_spice/spice_kernels/spk/m2020_ls_ops210303_iau2000_v1.bsp`,
    sourceName: 'NASA/JPL NAIF — m2020_ls_ops210303_iau2000_v1.bsp',
    coordinateReference: 'IAU_MARS fixed landing vector, 2021-03-03 solution; planetocentric latitude; east-positive longitude, 0–360°.',
    coordinateAccuracy: kernelAccuracy, confidence: kernelConfidence,
    references: [{ name: 'NASA Perseverance mission', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/' }],
    relatedLayers: ['globalCtx', 'controlledCtx', 'hirise'],
  },
  {
    id: 'curiosity', name: 'Curiosity landing site', category: 'mission',
    longitude: 137.4417, latitude: -4.589499788236298,
    description: 'NASA’s Mars Science Laboratory rover explores Gale crater to study whether Mars could have supported microbial life. This marker is its archived landing reference, not its current position.',
    mission: 'NASA Mars Science Laboratory / Curiosity', eventDate: '2012-08-06',
    sourceUrl: `${naifArchive}MSL/kernels/spk/msl_ls_ops120808_iau2000_v1.bsp`,
    sourceName: 'NASA/JPL NAIF — msl_ls_ops120808_iau2000_v1.bsp',
    coordinateReference: 'IAU_MARS fixed landing vector, 2012-08-08 solution; planetocentric latitude; east-positive longitude, 0–360°.',
    coordinateAccuracy: kernelAccuracy, confidence: kernelConfidence,
    references: [{ name: 'NASA Curiosity mission', url: 'https://science.nasa.gov/mission/msl-curiosity/' }],
    relatedLayers: ['globalCtx', 'mola'],
  },
  {
    id: 'opportunity', name: 'Opportunity landing site', category: 'mission',
    longitude: 354.4734, latitude: -1.9462,
    description: 'NASA’s Mars Exploration Rover Opportunity landed in Meridiani Planum. The PDS catalog distinguishes this map-relative landing position from the separate inertial radio-navigation solution; it is not the rover’s final position.',
    mission: 'NASA Mars Exploration Rover / Opportunity', eventDate: '2004-01-25',
    sourceUrl: merCatalog, sourceName: 'NASA PDS Geosciences — MER mission catalog',
    coordinateReference: `MOLA IAU 2000 cartographic frame, map-relative surface-feature position; ${missionReference.toLowerCase()}`,
    coordinateAccuracy: 'Published map-relative reference to four decimal places; no positional uncertainty supplied here. Not independently registered to current CTX imagery or the DEM.',
    confidence: 'PDS map-relative landing reference verified; absolute imagery/DEM registration unverified.',
    references: [{ name: 'NASA Opportunity mission', url: 'https://science.nasa.gov/mission/mer-opportunity/' }],
    relatedLayers: ['globalCtx', 'mola'],
  },
  {
    id: 'spirit', name: 'Spirit landing site', category: 'mission',
    longitude: 175.4729, latitude: -14.5692,
    description: 'NASA’s Mars Exploration Rover Spirit landed in Gusev crater. The PDS catalog distinguishes this map-relative landing position from the separate inertial radio-navigation solution; it is not the rover’s final position.',
    mission: 'NASA Mars Exploration Rover / Spirit', eventDate: '2004-01-04',
    sourceUrl: merCatalog, sourceName: 'NASA PDS Geosciences — MER mission catalog',
    coordinateReference: `MOLA IAU 2000 cartographic frame, map-relative surface-feature position; ${missionReference.toLowerCase()}`,
    coordinateAccuracy: 'Published map-relative reference to four decimal places; no positional uncertainty supplied here. Not independently registered to current CTX imagery or the DEM.',
    confidence: 'PDS map-relative landing reference verified; absolute imagery/DEM registration unverified.',
    references: [{ name: 'NASA Spirit mission', url: 'https://science.nasa.gov/mission/mer-spirit/' }],
    relatedLayers: ['globalCtx', 'mola'],
  },
  {
    id: 'viking-1', name: 'Viking 1 landing site', category: 'mission',
    longitude: 312.05, latitude: 22.27,
    description: 'NASA’s Viking 1 lander explored Chryse Planitia. This is the rounded planetocentric landing reference published by NASA.',
    mission: 'NASA Viking 1', eventDate: '1976-07-20',
    sourceUrl: 'https://science.nasa.gov/mission/viking/', sourceName: 'NASA Science — Viking mission',
    coordinateReference: missionReference,
    coordinateAccuracy: 'NASA publishes this reference to 0.01°; no metre positional accuracy established. Not independently registered to CTX imagery or the DEM.',
    confidence: 'NASA’s rounded planetocentric reference verified; absolute imagery/DEM registration unverified.',
    relatedLayers: ['globalCtx', 'mola'],
  },
  {
    id: 'viking-2', name: 'Viking 2 landing site', category: 'mission',
    longitude: 134.29, latitude: 47.64,
    description: 'NASA’s Viking 2 lander explored Utopia Planitia. This is the rounded planetocentric landing reference published by NASA.',
    mission: 'NASA Viking 2', eventDate: '1976-09-03',
    sourceUrl: 'https://science.nasa.gov/mission/viking/', sourceName: 'NASA Science — Viking mission',
    coordinateReference: missionReference,
    coordinateAccuracy: 'NASA publishes this reference to 0.01°; no metre positional accuracy established. Not independently registered to CTX imagery or the DEM.',
    confidence: 'NASA’s rounded planetocentric reference verified; absolute imagery/DEM registration unverified.',
    relatedLayers: ['globalCtx', 'mola'],
  },
  {
    id: 'insight', name: 'InSight landing site', category: 'mission',
    longitude: 135.623447, latitude: 4.502383577390144,
    description: 'NASA’s InSight lander studied Mars’ deep interior from Elysium Planitia. This archived landing reference is based on the December 6, 2018 MRO HiRISE image identified in its kernel documentation.',
    mission: 'NASA InSight', eventDate: '2018-11-26',
    sourceUrl: `${naifArchive}INSIGHT/kernels/spk/insight_ls_ops181206_iau2000_v1.bsp`,
    sourceName: 'NASA/JPL NAIF — insight_ls_ops181206_iau2000_v1.bsp',
    coordinateReference: 'IAU_MARS fixed landing vector, ops181206 reference; planetocentric latitude; east-positive longitude, 0–360°.',
    coordinateAccuracy: kernelAccuracy, confidence: kernelConfidence,
    references: [{ name: 'NASA InSight mission', url: 'https://science.nasa.gov/mission/insight/' }],
    relatedLayers: ['globalCtx', 'mola'],
  },
  {
    id: 'olympus', name: 'Olympus Mons', category: 'landmark',
    longitude: 226.20, latitude: 18.65,
    description: 'Published center of the named Martian mountain Olympus Mons. One center represents the feature for global exploration; it does not describe the entire mountain or a precise surface target.',
    sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/4453', sourceName: gazetteerSource,
    coordinateReference: gazetteerReference, coordinateAccuracy: gazetteerAccuracy, confidence: gazetteerConfidence,
    relatedLayers: ['globalCtx', 'mola'],
  },
  {
    id: 'valles-marineris', name: 'Valles Marineris', category: 'landmark',
    longitude: 301.41, latitude: -14.01,
    description: 'Published center of the named Martian valley system Valles Marineris. This single exploration marker does not represent its complete footprint or a precise surface target.',
    sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/6288', sourceName: gazetteerSource,
    coordinateReference: gazetteerReference, coordinateAccuracy: gazetteerAccuracy, confidence: gazetteerConfidence,
    relatedLayers: ['globalCtx', 'mola'],
  },
  {
    id: 'elysium-mons', name: 'Elysium Mons', category: 'landmark',
    longitude: 147.21, latitude: 25.02,
    description: 'Published center of the named Martian mountain Elysium Mons. The marker is a regional exploration reference, not a summit survey or a precise surface target.',
    sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/1783', sourceName: gazetteerSource,
    coordinateReference: gazetteerReference, coordinateAccuracy: gazetteerAccuracy, confidence: gazetteerConfidence,
    relatedLayers: ['globalCtx', 'mola'],
  },
  {
    id: 'gale', name: 'Gale crater', category: 'landmark',
    longitude: 137.81, latitude: -5.37,
    description: 'Published center of Gale crater, the region explored by Curiosity. The crater center is distinct from Curiosity’s landing reference and current rover position.',
    sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/2071', sourceName: gazetteerSource,
    coordinateReference: gazetteerReference, coordinateAccuracy: gazetteerAccuracy, confidence: gazetteerConfidence,
    references: [{ name: 'NASA Curiosity mission', url: 'https://science.nasa.gov/mission/msl-curiosity/' }],
    relatedLayers: ['globalCtx', 'mola'],
  },
  {
    id: 'hellas', name: 'Hellas Planitia', category: 'landmark',
    longitude: 70.50, latitude: -42.43,
    description: 'Published center of Hellas Planitia, a named low plain on Mars. One center represents this extensive feature for exploration, not its entire footprint or a precise surface target.',
    sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/2432', sourceName: gazetteerSource,
    coordinateReference: gazetteerReference, coordinateAccuracy: gazetteerAccuracy, confidence: gazetteerConfidence,
    relatedLayers: ['globalCtx', 'mola'],
  },
  ...SCIENCE_TARGETS.map((target): MarsPoi => ({
    id: target.id, name: target.name, category: target.id === 'jezero' ? 'landmark' : 'science',
    longitude: target.coordinate.lon, latitude: target.coordinate.lat,
    description: `${target.scientificRationale} ${target.limitations[0]}`,
    mission: target.missionContext,
    sourceUrl: target.coordinateSourceUrl, sourceName: target.coordinateAttribution,
    coordinateReference: gazetteerReference, coordinateAccuracy: gazetteerAccuracy, confidence: gazetteerConfidence,
    references: [{ name: 'NASA scientific context', url: target.scienceSourceUrl }],
    relatedLayers: ['globalCtx', 'ctx', 'controlledCtx', 'hirise'],
  })),
]

export function marsPoiById(id: string | null): MarsPoi | undefined {
  return MARS_POIS.find(poi => poi.id === id)
}
