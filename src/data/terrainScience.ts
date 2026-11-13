import type { TerrainGrid } from '../features/terrain/gridTypes'
import { TERRAIN_SOURCE_HASH, TERRAIN_SOURCE_ID } from '../features/terrain/sampling'

type ScientificFinding = {
  readonly status: 'verified' | 'unresolved'
  readonly summary: string
  readonly limitation: string
}

/** Evidence: docs/evidence/scientific-validation/{feature-registration,height-reference}-audit.md.
 * Findings are separate from the immutable source-asset declaration.
 */
export const TERRAIN_SCIENTIFIC_REVIEW: {
  readonly sourceId: string
  readonly sourceHash: string
  readonly geometry: ScientificFinding
  readonly featureRegistration: ScientificFinding
  readonly heightReference: ScientificFinding
  readonly heightDifferences: ScientificFinding
} = {
  sourceId: TERRAIN_SOURCE_ID,
  sourceHash: TERRAIN_SOURCE_HASH,
  geometry: {
    status: 'verified',
    summary: 'Native source geometry verified',
    limitation: 'Controlled CTX and DEM share source geometry and processing lineage. This does not establish absolute landmark accuracy.',
  },
  featureRegistration: {
    status: 'unresolved',
    summary: 'Named-feature registration unresolved',
    limitation: 'Published MDIM 2.1 centers are approximate. No independent landmark control-point residuals establish their precise placement in the controlled CTX or DEM.',
  },
  heightReference: {
    status: 'unresolved',
    summary: 'Elevation height reference conflicted / unresolved',
    limitation: 'USGS metadata declares IAU-sphere heights, but nine coarse PDS MOLA comparisons disagree with that interpretation by 1.626–1.699 km. These are sanity probes, not accuracy measurements or a validated conversion. The exact vertical surface, adjustment and sign remain unresolved.',
  },
  heightDifferences: {
    status: 'unresolved',
    summary: 'DEM slopes and terrain costs unavailable',
    limitation: 'Height-dependent results require a supported interpretation of the exact numerical band. A spatially varying areoid correction changes derivatives; this cannot be assumed to be a constant offset. Valid samples and tested arithmetic alone do not establish physical slopes.',
  },
}

/** Fails closed for unknown source contracts and unresolved vertical evidence. */
export function terrainHeightDifferenceBlocker(grid: TerrainGrid): string | null {
  if (grid.manifest.source.productId !== TERRAIN_SCIENTIFIC_REVIEW.sourceId || grid.manifest.source.sha256 !== TERRAIN_SCIENTIFIC_REVIEW.sourceHash || grid.manifest.source.units !== 'm' || grid.manifest.source.heightReference !== 'provider-declared-iau-sphere-unvalidated') return 'This numerical source does not match the scientific review contract.'
  if (TERRAIN_SCIENTIFIC_REVIEW.heightReference.status !== 'verified' || TERRAIN_SCIENTIFIC_REVIEW.heightDifferences.status !== 'verified') return `${TERRAIN_SCIENTIFIC_REVIEW.heightReference.summary}. ${TERRAIN_SCIENTIFIC_REVIEW.heightDifferences.limitation}`
  return null
}
