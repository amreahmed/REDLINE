import { TERRAIN_SOURCE_HASH, TERRAIN_SOURCE_ID } from '../features/terrain/sampling'

/** Diagnostic evidence, not authorization. Full receipts and reproducible controls live
 * in docs/evidence/scientific-resolution-2026-11-14/. Ranges round outward to metres.
 * No source heights, scientific gates or mission selections depend on this summary.
 */
export const SCIENTIFIC_CONTROL_EVIDENCE = {
  sourceId: TERRAIN_SOURCE_ID,
  sourceHash: TERRAIN_SOURCE_HASH,
  reviewDateLocal: '2026-11-14',
  registration: {
    totalSiteDefinitions: 41,
    insideCropCandidates: 21,
    sourceUrl: 'https://naif.jpl.nasa.gov/pub/naif/pds/pds4/mars2020/mars2020_spice/document/spiceds_v003.html',
  },
  height: {
    probeCount: 9,
    referenceSpacingM: 50,
    referenceSphereRadiusM: 3396000,
    ctxMinusAreoidM: [-66, 4],
    ctxMinusAppSphereM: [1621, 1696],
    sourceUrl: 'https://hrscteam.dlr.de/public/data/HMC30/MC13E/AA_README_HMC30.txt',
  },
} as const
