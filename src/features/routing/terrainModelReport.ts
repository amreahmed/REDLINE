import type { TerrainAnalysis } from '../terrain/modelTypes'
import type { TerrainComparison } from './terrainRoutes'
import hrscManifest from '../../../public/data/hrsc-terrain-model.json'
import { parseHrscModelManifest } from '../terrain/hrscModel'
import type { TravelTimeReport } from './travelTimeReport'

export function terrainModelReport(analysis: TerrainAnalysis, comparison: TerrainComparison | null, travelTime?: TravelTimeReport) {
  return {
    reportType: analysis.grid.source.authorization === 'synthetic-test' ? 'REDLINE synthetic test DEM model' : 'REDLINE qualified HRSC DEM model',
    scientificStatus: 'physical-terrain-unverified',
    source: analysis.grid.source,
    provenance: analysis.grid.source.authorization === 'provider-dem-model' ? parseHrscModelManifest(hrscManifest) : { source: analysis.grid.source, limitation: 'Synthetic test fixture; not Mars observations.' },
    grid: { rows: analysis.grid.rows, columns: analysis.grid.columns, startRow: analysis.grid.startRow, startColumn: analysis.grid.startColumn, originXM: analysis.grid.originXM, originYM: analysis.grid.originYM, pixelWidthM: analysis.grid.pixelWidthM, pixelHeightM: analysis.grid.pixelHeightM, referenceRadiusM: analysis.grid.referenceRadiusM },
    profile: analysis.profile,
    model: {
      slope: 'Central differences of provider DT5 sphere-relative heights divided by source-reference-sphere ground baselines; gradient angle in degrees.',
      roughness: 'Population standard deviation of valid heights in a complete circular physical-distance neighborhood. Includes broad terrain grade; not rock-scale irregularity.',
      shape: 'Center height minus neighborhood mean in metres. Not curvature or obstacle detection.',
      edgeCost: 'd * (1 + uphillWeight*max(0,gradeDeg)/maxUphillDeg + downhillWeight*max(0,-gradeDeg)/maxDownhillDeg + slopeWeight*maxEndpointGradient/max(maxUphillDeg,maxDownhillDeg) + roughnessWeight*maxEndpointRoughness/maxRoughnessM)',
      costUnit: 'cost-equivalent-m; a hypothetical preference score, not energy or travel time',
      unknownPolicy: 'Missing/nonfinite heights always excluded. Incomplete metric support blocked by default; explicit penalize uses distance*unknownCostMultiplier and reports unavailable terrain metrics.',
      search: 'Eight neighbors, no diagonal corner cutting through excluded flanks or restricted directional flank movements. Contracted source-sphere distance heuristic; all admissible costs are at least horizontal distance.',
    },
    routes: comparison,
    ...(travelTime ? { travelTime } : {}),
    limitations: [
      analysis.grid.source.qualification,
      'Physical Mars slopes, terrain costs, actual traversability, safety and precise named-feature routing remain unverified. These paths are hypothetical native-grid model outputs.',
      '50 m projected grid spacing and 1 m quantization do not establish local effective resolution or horizontal/vertical accuracy. Step heights, rocks, sand traps and hazards are not detected.',
      'No original per-cell stereo/support-quality mask is available. A valid numerical sample is not a measurement-quality or traversability guarantee.',
      'HRSC is part of CTX control lineage. It is not independent ground truth and does not resolve the CTX final vertical equation, correction sign or spatially varying transformation.',
      'CTX endpoints are mapped by longitude/latitude to containing HRSC cells, then use HRSC centers. This snap is not empirical imagery/DEM co-registration.',
      'Blocked search cells count all model cells exceeding assumptions, not obstacles proven avoided. Expanded cells represent search work, not measured coverage quality.',
      'Exact acquisition contributors, crop-specific error estimates and scientific release version remain unknown. HTTP modification validators are not acquisition dates.',
      'Independent prototype; not NASA endorsed or a certified human-safety system.',
    ],
    evidence: ['docs/evidence/terrain-model/source-authorization.md', 'docs/evidence/scientific-gate-resolution/hrsc/hrsc-native-reference.json', 'docs/science-routing-audit.md'],
  }
}
