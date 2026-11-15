/** Published feature center for approximate navigation, not a science-target pick. */
export const JEZERO_NAVIGATION = {
  name: 'Jezero crater',
  center: [77.69, 18.41] as const,
  sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/14300',
  attribution: 'USGS / IAU Gazetteer of Planetary Nomenclature',
  convention: 'Planetocentric latitude; positive-east longitude, 0–360° at source. This longitude is unchanged in the map’s −180–180° domain.',
  limitation: 'Approximate published crater center for navigation. Native preliminary CTX latitude convention and fine registration remain unverified; this is not an exact science target.',
} as const

export const JEZERO_CONTEXT_ZOOM = 4
export const JEZERO_OVERVIEW_ZOOM = 8.5
export const JEZERO_DETAIL_ZOOM = 10
