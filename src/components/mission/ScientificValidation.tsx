import { SCIENTIFIC_CONTROL_EVIDENCE } from '../../data/scientificEvidence'
import { TERRAIN_SCIENTIFIC_REVIEW } from '../../data/terrainScience'

function signedRange(values: readonly [number, number]): string {
  return values.map(value => `${value < 0 ? '−' : '+'}${Math.abs(value).toLocaleString('en-US')}`).join(' to ')
}

export function ScientificValidation() {
  const evidence = SCIENTIFIC_CONTROL_EVIDENCE
  return <section className="validation-summary" aria-labelledby="validation-heading">
    <h3 id="validation-heading">Scientific validation</h3>
    <dl className="scientific-findings">
      <dt>Native source geometry</dt><dd>Verified against provider geometry and independent cell fixtures</dd>
      <dt>Named-feature registration</dt><dd>Unresolved — precise landmark alignment not established</dd>
      <dt>Elevation height reference</dt><dd>Conflicted / unresolved — real DEM slopes and costs blocked</dd>
      <dt>Terrain arithmetic</dt><dd>Reference-sphere distances validated; grade and cost formulas tested with synthetic fixtures</dd>
    </dl>
    <p className="helper">Plan provides grid separation and A* distance-only hypothetical paths. Grid connectivity is a simulation assumption. Terrain-aware pathfinding and precise science-site routing require additional evidence.</p>
    <details className="source-metadata">
      <summary>Registration evidence & next requirement</summary>
      <p className="helper">{evidence.registration.insideCropCandidates} archived rover-site control candidates map inside this crop, from {evidence.registration.totalSiteDefinitions} site definitions in a NASA/JPL localized SPICE kernel.</p>
      <p className="helper">These are coordinate-to-cell mappings with no image-space residuals or per-site uncertainty. They are not planning endpoints and do not register the rounded MDIM feature centers.</p>
      <p className="helper">Positions were decoded in IAU_MARS as planetocentric, east-positive coordinates. The landing kernel’s Gaussian latitude is a different convention; its decoded landing position is outside this crop. Fixed site definitions do not establish visit times.</p>
      <p className="source-warning">Next: identify independent image landmarks with compatible coordinates and uncertainty, measure residuals in controlled CTX, and justify an acceptance criterion.</p>
      <div className="source-links"><a href={evidence.registration.sourceUrl} target="_blank" rel="noreferrer">NASA/JPL control archive</a></div>
    </details>
    <details className="source-metadata">
      <summary>Height evidence & next requirement</summary>
      <p className="helper">{TERRAIN_SCIENTIFIC_REVIEW.heightReference.limitation}</p>
      <p className="helper">{evidence.height.probeCount} numerical HRSC comparisons use separate {evidence.height.referenceSpacingM} m cells with explicit sphere and areoid height metadata. CTX minus HRSC areoid heights ranges from {signedRange(evidence.height.ctxMinusAreoidM)} m; CTX minus HRSC sphere heights expressed relative to the app’s sphere ranges from {signedRange(evidence.height.ctxMinusAppSphereM)} m. Ranges are rounded outward.</p>
      <p className="helper">HRSC uses a 3,396,000 m sphere and a GMM3 equipotential reference. Different cells, resolution and processing make these comparison diagnostics, not accuracy estimates or a validated conversion. HRSC was also used in CTX alignment, so it is not an independent accuracy truth.</p>
      <p className="source-warning">Next: obtain the final vertical surface, correction model and sign for the exact CTX product, then validate compatible height controls. An alternative DEM needs its own full contract.</p>
      <p className="helper">{TERRAIN_SCIENTIFIC_REVIEW.heightDifferences.limitation} Source values remain unchanged.</p>
      <div className="source-links"><a href={evidence.height.sourceUrl} target="_blank" rel="noreferrer">HRSC team documentation</a></div>
    </details>
  </section>
}
