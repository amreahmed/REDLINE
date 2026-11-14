import { SCIENTIFIC_CONTROL_EVIDENCE } from '../../data/scientificEvidence'
import { TERRAIN_SCIENTIFIC_REVIEW } from '../../data/terrainScience'
import scientificAuditUrl from '../../../docs/science-routing-audit.md?url'

const capabilityStatuses = [
  { label: 'Source-to-grid preservation', status: 'Verified', detail: 'All 65,536 native float32 cells match the original CTX TIFF bytes. Finite coverage is not proof of stereo support or traversability.' },
  { label: 'Reference-sphere distances', status: 'Verified', detail: 'Native centers and neighbor distances agree with independent PROJ on the documented 3,396,190 m sphere. This establishes arithmetic agreement, not absolute positional accuracy.' },
  { label: 'A* mathematical search', status: 'Verified', detail: 'Under finite nonnegative costs and the documented admissible heuristic. Independent Dijkstra comparisons validate the graph-search problem, not real-Mars terrain safety.' },
  { label: 'Hypothetical distance-only paths', status: 'Verified', detail: 'Calculated reference-sphere graph lengths and waypoint comparison. Eight-neighbor connectivity is a hypothetical modeling assumption.' },
  { label: 'Requested HiRISE height definition', status: 'Verified', detail: 'For the separate DTEEC_023524_1985_023379_1985_U01 product only. It does not overlap the live CTX crop.' },
  { label: 'Live CTX vertical height reference', status: 'Unverified', detail: 'The final sample equation, reference model, correction sign and operation order remain unresolved.' },
  { label: 'Absolute feature-to-DEM registration', status: 'Unverified', detail: 'Relative image diagnostics and approximate MDIM 2.1 centers do not establish independently controlled landmark placement.' },
  { label: 'Real-Mars physical slopes', status: 'Unverified', detail: 'Height-dependent results remain unavailable until the exact local height interpretation is supported.' },
  { label: 'Physical terrain costs', status: 'Unverified', detail: 'The tested preference formula is not calibrated effort or safety, and real terrain inputs remain gated.' },
  { label: 'Precise named-feature routing', status: 'Unverified', detail: 'Approximate feature references remain separate from explicit hypothetical native-cell endpoints.' },
  { label: 'Scientific globe orientation', status: 'Unverified', detail: 'The NASA model and scripted approach are visual aids. No geographic model picking or scientific orientation is validated.' },
] as const

function signedRange(values: readonly [number, number]): string {
  return values.map(value => `${value < 0 ? '−' : '+'}${Math.abs(value).toLocaleString('en-US')}`).join(' to ')
}

export function ScientificValidation() {
  const evidence = SCIENTIFIC_CONTROL_EVIDENCE
  return <section id="scientific-details" className="validation-summary" aria-labelledby="validation-heading">
    <div className="scientific-summary-line"><h3 id="validation-heading" tabIndex={-1}>Scientific validation</h3><span className="status-label" data-status="partial">Partial</span></div>
    <p className="helper">Distance geometry and mathematical search are verified within their documented scope. Height-dependent terrain results and precise feature placement remain unverified.</p>
    <details className="source-metadata">
      <summary>Capability status</summary>
      <dl className="scientific-findings">
        {capabilityStatuses.map(finding => <div key={finding.label}><dt>{finding.label}</dt><dd><span className="status-label" data-status={finding.status.toLowerCase()}>{finding.status}</span><p className="helper">{finding.detail}</p></dd></div>)}
      </dl>
      <p className="helper">Algorithmic correctness and scientific validity are separate. Distance-only hypothetical paths do not use source heights; terrain-aware pathfinding, hazards and safety predictions remain unavailable.</p>
    </details>
    <details className="source-metadata">
      <summary>Registration evidence & limitations</summary>
      <p className="helper">{evidence.registration.insideCropCandidates} archived rover-site control candidates map inside this crop, from {evidence.registration.totalSiteDefinitions} site definitions in a NASA/JPL localized SPICE kernel.</p>
      <p className="helper">These are coordinate-to-cell mappings with no image-space residuals or per-site uncertainty. They are not planning endpoints and do not register the rounded MDIM feature centers.</p>
      <p className="helper">Positions were decoded in IAU_MARS as planetocentric, east-positive coordinates. The landing kernel’s Gaussian latitude is a different convention; its decoded landing position is outside this crop. Fixed site definitions do not establish visit times.</p>
      <p className="helper">A separate relative image diagnostic reproduces 97 fit and 62 held-out texture ties across nine sampled patches. Held-out RMS residuals are 2.019619400 projected m, 1.945117168 m on the Mars sphere and 0.336603233 CTX pixels.</p>
      <p className="helper">The PLACES cutout omits the crop’s northern 903.140188 m. Shared mission-map control and sampled texture ties do not establish independent absolute registration, unsampled ground accuracy or a justified positional acceptance threshold.</p>
      <p className="helper">Precise feature placement requires independently identifiable landmarks with compatible coordinates and uncertainty, held-out residuals and a justified acceptance criterion.</p>
      <div className="source-links"><a href={evidence.registration.sourceUrl} target="_blank" rel="noreferrer">NASA/JPL control archive</a></div>
    </details>
    <details className="source-metadata">
      <summary>CTX height reference & terrain limits</summary>
      <p className="helper">{TERRAIN_SCIENTIFIC_REVIEW.heightReference.limitation}</p>
      <p className="helper">{evidence.height.probeCount} numerical HRSC comparisons use separate {evidence.height.referenceSpacingM} m cells with explicit sphere and areoid height metadata. CTX minus HRSC areoid heights ranges from {signedRange(evidence.height.ctxMinusAreoidM)} m; CTX minus HRSC sphere heights expressed relative to the app’s sphere ranges from {signedRange(evidence.height.ctxMinusAppSphereM)} m. Ranges are rounded outward.</p>
      <p className="helper">HRSC uses a 3,396,000 m sphere and a GMM3 equipotential reference. Different cells, resolution and processing make these comparison diagnostics, not accuracy estimates or a validated conversion. HRSC was also used in CTX alignment, so it is not an independent accuracy truth.</p>
      <p className="helper">The exact CTX product still requires its final vertical surface, correction model, sign and operation order, followed by compatible height-control validation. An alternative DEM needs its own full contract.</p>
      <p className="helper">{TERRAIN_SCIENTIFIC_REVIEW.heightDifferences.limitation} Source values remain unchanged.</p>
      <p className="helper">A common constant vertical offset cancels in height differences and directional grades. A spatially varying correction changes those differences and gradients; the unresolved CTX transformation cannot be assumed constant.</p>
      <p className="helper">No per-cell original stereo, edited or fill-quality mask is established. Valid numerical samples do not prove uniformly measured terrain or human traversability.</p>
      <div className="source-links"><a href={evidence.height.sourceUrl} target="_blank" rel="noreferrer">HRSC team documentation</a></div>
    </details>
    <details className="source-metadata">
      <summary>Separate HiRISE height definition</summary>
      <p className="source-id">DTEEC_023524_1985_023379_1985_U01 · product version 1</p>
      <p className="helper">The complete PDS label defines metres above the Mars 2000 equipotential surface, Smith et al. (2001), with scale 1 and offset 0. This is a verified height definition for that product, not a validation of the live CTX heights.</p>
      <dl className="source-facts"><dt>Horizontal mapping sphere</dt><dd>3,394,839.8133163 m; equirectangular standard parallel 15°, central meridian 77.53°</dd><dt>Actual projected sample spacing</dt><dd>1.0096633268711 m</dd><dt>Relationship to the planning crop</dt><dd>No overlap: HiRISE west edge 77.45290261°E lies east of the CTX crop’s 77.42297207081594°E edge</dd></dl>
      <p className="helper">The horizontal sphere is not the vertical equipotential datum. The candidate has not been integrated or substituted for the current terrain grid; its orthophoto associations do not supply independent crop registration.</p>
      <div className="source-links"><a href="https://www.uahirise.org/dtm/ESP_023524_1985" target="_blank" rel="noreferrer">Official HiRISE product</a></div>
    </details>
    <details className="source-metadata">
      <summary>Source identity & full audit</summary>
      <dl className="source-facts"><dt>Live numerical product</dt><dd className="source-id">{evidence.sourceId}</dd><dt>Original TIFF SHA-256</dt><dd className="source-id">{evidence.sourceHash}</dd></dl>
      <p className="helper">The full 15 November 2026 audit retains source-to-grid processing, exact hashes, coordinate definitions, residual tables, height-reference issues, A* assumptions, reproducible checks and every unresolved limitation.</p>
      <p className="helper">REDLINE is an independent decision-support prototype, not a NASA-endorsed product or certified human-safety system. Distance-only hypothetical route. Terrain and human safety are not validated.</p>
      <div className="source-links"><a href={scientificAuditUrl} download="REDLINE-scientific-audit.md">Download full scientific audit</a></div>
    </details>
  </section>
}
