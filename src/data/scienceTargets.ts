import type { ScienceTarget } from '../features/mission/types'

// Published feature centers and cited science context verified in
// docs/evidence/phase-3-targets/. These are approximate references, not rover targets.
const coordinateAttribution = 'International Astronomical Union Working Group for Planetary System Nomenclature; Gazetteer maintained by USGS Astrogeology'
const scienceAttribution = 'NASA/JPL-Caltech/ASU/MSSS'
const registrationLimit = 'MDIM 2.1 feature geometry is not independently registered to the preliminary CTX mosaic.'
const calculationLimit = 'No distance, slope, terrain safety, or routing follows from this record.'

export const SCIENCE_TARGETS: readonly ScienceTarget[] = [
  {
    id: 'jezero',
    name: 'Jezero crater',
    coordinate: { lon: 77.69, lat: 18.41, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeDomain: '0-360' },
    scientificRationale: "Jezero preserves a delta interpreted as the remnant of an ancient river entering a lake. NASA's cited Mastcam-Z image description grounds this regional context.",
    coordinateSourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/14300',
    scienceSourceUrl: 'https://science.nasa.gov/resource/perseverance-view-of-the-delta-in-jezero-crater/',
    missionContext: 'Mars 2020 / Perseverance / Mastcam-Z',
    controlNetwork: 'MDIM 2.1',
    coordinateAttribution,
    scienceAttribution,
    limitations: [
      'The marker represents the published crater center, not the delta, landing point, or a rover sample location.',
      registrationLimit,
      calculationLimit,
    ],
  },
  {
    id: 'belva',
    name: 'Belva crater',
    coordinate: { lon: 77.38, lat: 18.48, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeDomain: '0-360' },
    scientificRationale: "Perseverance's Mastcam-Z observations of Belva show exposed bedrock cross-sections that provide clues to the region's geologic history. NASA discusses dipping beds as a possible ancient sandbar interpretation.",
    coordinateSourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/15872',
    scienceSourceUrl: 'https://science.nasa.gov/resource/perseverance-takes-in-view-at-belva-crater/',
    missionContext: 'Mars 2020 / Perseverance / Mastcam-Z',
    controlNetwork: 'MDIM 2.1',
    coordinateAttribution,
    scienceAttribution,
    limitations: [
      'The marker represents the published crater center, not Echo Creek or the position where the rover acquired the panorama.',
      'The source publishes center coordinates to two decimal places; no sub-pixel or metre positional accuracy is claimed.',
      registrationLimit,
      calculationLimit,
    ],
  },
  {
    id: 'neretva',
    name: 'Neretva Vallis',
    coordinate: { lon: 77.20, lat: 18.55, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeDomain: '0-360' },
    scientificRationale: "Neretva is an ancient river channel that fed water into Jezero crater. NASA's Mastcam-Z panorama provides mission context for exploring the channel.",
    coordinateSourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/15879',
    scienceSourceUrl: 'https://science.nasa.gov/photojournal/perseverances-view-of-neretva-vallis-river-channel/',
    missionContext: 'Mars 2020 / Perseverance / Mastcam-Z',
    controlNetwork: 'MDIM 2.1',
    coordinateAttribution,
    scienceAttribution,
    limitations: [
      'The marker represents the published valley center, not Bright Angel, Mount Washburn, or a precise rover target.',
      'The geographic feature spans a valley; one center does not represent its complete footprint.',
      registrationLimit,
      calculationLimit,
    ],
  },
]

export function targetById(id: string | null): ScienceTarget | undefined {
  return SCIENCE_TARGETS.find((target) => target.id === id)
}
