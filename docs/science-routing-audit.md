# REDLINE scientific foundation and existing A* audit — 15 November 2026

Baseline: `main`, `3dcfa5075d9f04e4e826991094f95b0c39aa6c06` (`feat(routes): add distance-only hypothetical path comparison`). The audit began with a clean tracked tree. Existing implementation, commit history, all 65,536 cells, scientific warnings, interactions and routing were preserved. Changes are diagnostic tests, reproducible evidence and documentation. No production defect was demonstrated that justified changing a scientific calculation or A*.

The accessible `mars-data-integrity` and `verification-before-completion` skills were applied after reading AGENTS.md, the project specification, existing reports, preprocessing, manifests, coordinate/terrain/routing modules and tests. This is an evidence checkpoint, **not successful completion of all scientific validation**. Historical reports retain their original dates and results; the fresh checks below supersede historical test counts for this audit.

## A. Executive summary

**The current source-to-grid extraction, reference-sphere distance calculations and existing A* mathematical contract are verified within their stated scope. The scientific foundation remains PARTIALLY VERIFIED.** Precise feature registration, the final CTX height reference and physical terrain derivatives remain unresolved.

- All **65,536 native float32 samples** match the original CTX TIFF bytes, with zero differences. The crop contains zero native NoData/nonfinite samples. This does not establish original stereo/fill quality or traversability.
- Independent PROJ checks cover all cell centers and **260,610 unique neighbor edges**. Maximum edge arithmetic difference is **1.2461e-9 m**, or **4.8009e-9%**. This is agreement on the declared sphere, not nanometre Mars positional accuracy.
- Existing A* agrees with independent Dijkstra across **4,120 synthetic endpoint/weight comparisons**, including **360 disconnected pairs**. The native heuristic passes **2,606,100 directed-edge/goal inequalities** for five goals, alongside a general exact-arithmetic metric proof.
- The requested HiRISE product has a product-specific **Mars 2000 equipotential height definition**, but **does not overlap the live CTX crop**. It cannot validate or relabel the live grid.
- Relative image matching reproduces **97 fit / 62 held-out texture ties**. Held-out RMS is **2.0196 projected m / 1.9451 sphere m / 0.3366 CTX pixels**. These are relative diagnostics with shared control and incomplete coverage, not independent absolute registration.
- Fresh lint, typecheck, **492 tests in 39 files**, build and **16 isolated Chromium acceptance groups** pass. No personal browser profile or native device was controlled.

The application can demonstrate source-backed exploration, hypothetical native endpoints, reference-sphere separation and distance-only grid-path comparison. Real DEM slopes, terrain costs, precise named-site routing and safety outputs remain gated.

## B. Terrain data provenance

The actual source is `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0`, USGS/NASA/MRO/CTX, [DOI 10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8). It is **not** `DTEEC_023524_1985_023379_1985_U01`.

| Stage | Exact artifact / implementation | Operation and evidence |
| --- | --- | --- |
| Original release | `docs/evidence/terrain-validation/source-audit/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif`; adjacent saved ISIS/PDS3/FGDC metadata | 9,662,387 bytes; 1596 columns × 1512 rows; single-band little-endian float32; 20 m projected posts. Source and version history are distinct: exact bytes are pinned, complete scientific processing version is unresolved. |
| Upstream generation | Provider FGDCs and production publications, retained in the existing source and vertical audits | Stereo extraction, editing, alignment, mosaicking/blending and HRSC fill are described. Per-cell stereo/fill quality and the final signed height equation are not supplied. |
| Native crop | `scripts/prepare-terrain-grid.py` | Rows **586–841**, columns **522–777**, inclusive; no application resampling, interpolation, datum conversion or synthetic values. Preparation was inspected, not rerun over production assets. |
| Encoded grid | `public/data/jezero-terrain-grid.f32`, `.json` | 256 × 256; 262,144-byte row-major little-endian float32 binary; scale 1, offset 0. Manifest retains source/encoding hashes, mask convention, geometry and unvalidated height declaration. |
| Coordinates / decoding | `src/features/terrain/{sampling,terrainGrid}.ts`, `src/features/mission/coordinates.ts` | Native cell center uses index + 0.5; inverse spherical Eqc establishes lon/lat. No heights are transformed by this operation. |
| Terrain arithmetic | `src/features/terrain/{terrainMath,terrainMetrics}.ts`, `src/data/terrainScience.ts` | Distance is independently enabled. Height-dependent edge inspection fails closed on the unresolved exact source contract. |
| Routing input | `src/features/routing/distanceRoutes.ts` | Valid native centers and finite/NoData coverage enter the eight-neighbor graph. **Elevations do not enter costs or the heuristic.** |

Provenance chain: **original CTX TIFF → upstream provider processing → unchanged native crop → float32 grid → native center transformation → separately gated terrain arithmetic / distance-only routing**.

The independent [raw-byte verifier and findings](evidence/science-routing-audit/provenance-height/findings.md) compare every four-byte crop sample directly with original TIFF row strips, without Rasterio or application extraction helpers. It also confirms no vertical GeoKeys, extra mask band or final equation in the inspected TIFF. Original NoData is **−3.4028226550889045e38**; finite values are not a measurement-quality mask.

| Preserved artifact | SHA-256 |
| --- | --- |
| Original TIFF | `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b` |
| 65,536-cell binary | `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8` |
| Grid manifest | `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9` |

The crop outer-edge bounds are **77.33659457394239–77.42297207081594°E**, **18.437093496062143–18.523470992935692°N**. Retained provider values range from **−2560.28857421875 to −2363.345703125 m**; this is a source-value range, not independently verified altitude.

## C. Vertical reference findings

**Live CTX: unresolved.** Exact-product FGDC metadata declares IAU-sphere metre heights, while matching-source numerical diagnostics conflict with that interpretation. The horizontal mapping radius alone cannot settle the vertical reference. Earlier input `GEOID=mola` metadata does not recover the final correction model, grid/version, sign or order.

Fresh saved-evidence checks reproduce 20 height-investigation bodies, 42 public vertical response bodies, both HRSC raster contracts and 18 native heights / nine paired probes. The nine HRSC comparisons yield CTX minus areoid-height values **−65.2798 to +3.4546 m**, versus CTX minus height above the app sphere **+1621.7202 to +1695.4214 m**. Different resolution/support and shared control lineage prevent calling these CTX error bounds or an independent datum identification. The retained 2021 exact-product paper reports an approximately **0.09° inter-product tilt**; it supplies no crop-specific correction.

**Requested HiRISE label: established for that separate product.** [The complete attached label](evidence/science-routing-audit/provenance-height/hirise-dtm-complete.lbl) identifies:

- Dataset `MRO-M-HIRISE-5-DTM-V1.0`, product `DTEEC_023524_1985_023379_1985_U01`, version **1**, stereo pair `ESP_023524_1985` / `ESP_023379_1985`.
- Elevations in **metres above the Mars 2000 equipotential surface**, Smith et al. (2001); scale **1**, offset **0**, PC_REAL 32-bit, missing pattern **FF7FFFFB**.
- Horizontal equirectangular sphere **3,394,839.8133163 m**, standard parallel **15°**, central meridian **77.53°**, actual projected sample **1.0096633268711 m**. The nominal webpage resolution is not the exact sample spacing.
- Western edge **77.45290261°**, east of the live crop's eastern edge **77.42297207081594°**: no common coverage.

The official page returned HTTP 200 and the exact image's first 65,536 bytes returned HTTP 206. The entire **4,305-byte attached label** was recovered; the 700,271,460-byte image was not downloaded or integrated. HiRISE SIS §5.4 documents general MOLA-controlled stereo triangulation and DTM-derived orthophotos, not this product's independent control residuals. Normal HTTPS/TLS was used. [Receipts and detailed findings](evidence/science-routing-audit/provenance-height/findings.md) preserve exact source links and hashes.

For `z'(p)=z(p)+C`, a common constant cancels in height differences, directional grades and this squared-grade cost. Absolute elevations, radius comparisons and altitude thresholds still require the datum. For spatially varying `C(p)`, each difference gains `C(q)−C(p)` and gradients change. No evidence proves the CTX conflict is constant; no arbitrary radius subtraction, offset, tilt or reclassification was applied. Cross-product comparison requires both the correct horizontal transform and a documented vertical conversion on matching support.

## D. Feature registration findings

The controlled image `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0` and CTX DEM share a documented source sphere, Eqc origin and orthorectification lineage. Image pixels are **6 projected m**, DEM posts **20 projected m**; the image extends **12 m** farther east. Shared geometry is verified; independent absolute physical accuracy is not.

The actual PLACES `m20_orbital_map`, release **16.0**, has 59,200 × 21,920 pixels at **0.25 projected m**, planetocentric/+East and the same sphere, with standard parallel **18.4663°**. The contract conversion is `x_CTX=x_PLACES/cos(18.4663°)`, `y_CTX=y_PLACES`. This is a projection conversion, not a fitted image correction. Corner-origin pixels add 0.5 for centers.

Original matching, source-geometry and PLACES-frame calculations reproduce byte-identically. A predetermined nine-patch grid assigned five patches to fitting and four to holdout. Native PLACES texture was area-averaged to the image's 6 m cells for diagnostics; **the DEM was not resampled**.

| Texture set | Fit / held-out counts | Held-out RMS projected m | Held-out RMS sphere m | Held-out RMS CTX pixels |
| --- | --- | --- | --- | --- |
| Broad | 97 / 62 | 2.019619400 | 1.945117168 | 0.336603233 |
| Multiscale quality subset | 5 / 3 | 1.971947323 | 1.932658433 | 0.328657887 |

Broad held-out maxima: **5.222908398 projected m**, **4.961710333 sphere m**, **0.870484733 CTX pixels**. Angular-plane RMS / maximum: **0.0000340722008638° / 0.0000881136237961°**. The diagnostic translations are **[−0.6119473675, +0.4750237959] m** (broad) and **[+0.0869525296, −1.0664313582] m** (subset); neither is applied. Scale/rotation remain fixed by source contracts, not independently estimated local distortions.

These are relative texture residuals, **not surveyed control errors**. Ties span approximately 77.3424–77.4174°E / 18.4407–18.5022°N. The actual PLACES cutout misses the crop's northern **903.140188 m**; unsampled terrain remains unvalidated. Broad template-size sensitivity reaches **47.7921 m**, versus **2.3922 m** in the selected subset, with no invented confidence interval or absolute acceptance threshold.

[The full registration report](evidence/science-routing-audit/registration/findings.md) separates DTM/ortho association, CTX/DEM physical alignment, MOLA vertical control, MDIM alignment and named-site placement. [The 167-row residual table](evidence/science-routing-audit/registration/relative-image-residuals.csv) contains angular, physical and pixel components; [the diagnostic plot](evidence/science-routing-audit/registration/relative-registration-diagnostic.png) shows sampling and coverage.

Jezero, Belva and Neretva Gazetteer centers retain MDIM 2.1 and two-decimal precision. Only Belva's arithmetic row 714 / column 650 lies in this crop; arithmetic containment is not landmark registration. Requested HiRISE ortho links are documented, but exact quantitative internal controls are unavailable and that DTM has no live-crop overlap. Preliminary CTX and MDIM-to-local quantitative alignment remain unverified. Rendered MOLA colors supply neither numerical elevation nor independent controls.

## E. Horizontal distance findings

The live frame is planetocentric latitude, east-positive longitude, signed-180 display domain (explicit conversion from declared 0–360 where supported), longitude/latitude axis order, degrees at the API boundary. Source Eqc uses **R=3,396,190 m**, standard parallel / central meridian / latitude origin **0°**, projected metres.

For native row `r`, column `c`, `x=4573663.250853+(c+0.5)*20`, `y=1109693.140188−(r+0.5)*20`. Inverse coordinates are `λ=x/R`, `φ=y/R` in radians. West/north crop edges are inclusive and east/south exclusive; existing tests cover boundaries and invalid indices.

The application computes `R*atan2(||u×v||,u·v)` on sphere unit vectors. This is a stable shortest arc, not Euclidean pixels, terrain-following distance or an ellipsoidal/areoid altitude calculation. Independent **pyproj 3.8.0 / PROJ 9.8.1** inverse Eqc and spherical Geod use the identical documented reference surface.

| Fresh independent comparison | Count | Maximum absolute arithmetic difference |
| --- | --- | --- |
| Native cell centers | 65,536 | 2.842170943e-14°; equivalent 1.694720802e-9 m |
| Unique adjacent edges | 260,610 | 1.246085901e-9 m; 4.800898582e-9% |
| Analytical/global/native fixtures | 16 | All within 1e-6 m acceptance |
| Invalid coordinate contracts | 5 | All rejected |

Edges comprise 65,280 E–W, 65,280 N–S and 65,025 in each diagonal direction. E–W physical spacing is **18.963890568–18.973410586 m**; N–S approximately **20 m**, diagonals **27.561383402–27.567908925 m**. Treating all projected cells as 20 surface metres would overstate E–W distance by **5.4107–5.4636%**. Existing production code already uses sphere distances, so no correction is required.

Fixtures include one-degree/quarter-circumference, antipodal/near-antipodal, high latitude, both longitude-domain wraps, equivalent positions, poles, boundaries and long regional baselines. Native row 650/column 580 to row 800/column 730 yields **4134.7416614 m**. The approximately 56-micrometre synthetic fixture has an **8.47e-11 m / 0.0001507%** arithmetic difference; the neighbor-relative percentage above does not summarize that tiny fixture.

[Actual application capture](evidence/science-routing-audit/horizontal/capture-app.mjs) imports the unchanged TypeScript modules; [independent comparator](evidence/science-routing-audit/horizontal/compare-proj.py) checks their captured output. [Raw results](evidence/science-routing-audit/horizontal/results.json) include module hashes, fixtures and units. No independent surveyed geographic reference point establishes absolute cell placement in this audit.

## F. Slope findings

Current API: **directional adjacent-edge grade**, not a 2D maximum-slope raster. `g=rise/run`, signed degrees `atan2(rise,run)*180/pi`, percent `100*g`. The native adapter requires distinct adjacent cells, valid endpoints, both diagonal flanks and the exact height-difference authorization before subtracting provider values.

Existing and new tests exercise flat/analytical planes, cardinal/diagonal/reverse directions, finite units, boundary neighbors, absent/NoData support and numerical failures. The synthetic plane `z=0.25*x−0.5*y+C` gives east grade **0.25 / 14.03624°** and `(20,20)` diagonal grade **−0.1767767 / −10.02499°**. Exactly represented common shifts 0, 1024 and 3,396,190 retain identical differences/costs; this is algebraic test data, not authorization to alter Mars elevations. A varying synthetic correction `N=0.02*x` changes east grade 0.25 to 0.27.

NoData is never replaced with zero. No truncated stencil, inferred flat boundary or hidden interpolation is implemented. A 2D finite-difference stencil is **NOT APPLICABLE to the current API** and would require a separate method/neighbor/boundary policy. Original interpolated/fill-cell identities remain unknown. **Real-Mars physical slopes remain UNVERIFIED and disabled.**

## G. Terrain-cost findings

The retained model helper uses **`c=d*(1+w*g²)=d+w*rise²/d`**. Distance/penalty/total are **cost-equivalent metres**; `w` is finite, nonnegative and dimensionless. It is an uncalibrated REDLINE preference, not a NASA measurement or human-effort/safety prediction. Squaring makes reverse-edge penalties symmetric. The generic A* can handle directional nonnegative costs with an appropriate heuristic; no directional human-traversal calibration exists here.

Balanced arithmetic and tests cover nonnegative costs, zero penalty, monotonicity, extreme factors and true overflow/underflow rejection. Coverage/NoData rejection occurs before source-derived edge costs; the pure helper cannot infer a mask from an isolated numeric input. Finite filled values still need quality provenance before physical interpretation. The production distance-only adapter does **not** call this helper.

Synthetic sensitivity: one 20 m hill cell on a 3 × 5 planar grid, 20 m test spacing. Direct cost is `80+40w`; flat detour is `40+40*sqrt(2)=96.568542495`. The preference changes at `w=sqrt(2)−1≈0.4142135624`.

| Synthetic weight | Optimal cost-equivalent m | Visits test hill |
| --- | --- | --- |
| 0 | 80 | Yes |
| 0.25 | 90 | Yes |
| 0.5, 1, 4, 16 | 96.568542495 | No |

A* and Dijkstra agree. These arbitrary weights are illustrative tests, not recommended scientific settings. No hazard threshold, effort calibration or physical slope input is validated. **Real-Mars terrain costs remain gated.**

## H. Existing A* audit

The preserved implementation is in `src/features/routing/{distanceRoutes,routeWorker,routeTask,useDistanceRouting}.ts`. It uses a deterministic binary min-heap, lazy stale-entry removal, best-score updates and reopening; the visited array counts distinct expanded nodes and does not close them permanently. The goal is accepted when its best queued score is popped. Bounded predecessors reconstruct the connected origin-to-destination path. Finite nonnegative edge costs, graph indices and arithmetic are checked; unreachable regions return unavailable.

Native edges are eight-neighbor sphere-center arcs; NoData/nonfinite cells and diagonals with an invalid flank are excluded. The kernel returns a one-node zero-cost same-node path; the product deliberately rejects duplicate endpoint cells. Optional waypoint comparison requires both independently optimal legs; failed waypoint routing does not silently return a successful comparison.

`h(u)=(1−1e-9)*d(u,goal)` is admissible and consistent in exact arithmetic: triangle inequality gives `h(u)≤alpha*d(u,v)+h(v)≤d(u,v)+h(v)`. It is zero at the goal, in metres. The contraction is a floating-point margin, not a scientific uncertainty. Fresh native checks cover every directed edge for four corners and a central goal: **2,606,100 inequalities**, minimum slack **1.892988166e-8 m**, no negatives. This is not a formal numerical bound for every possible input.

For the proposed nonnegative squared-grade model `c≥d`, the same lower bound would remain valid if scientific inputs were authorized. Arbitrary nonnegative discounted costs do not inherit that property. A deliberate synthetic invalid-heuristic counterexample returns cost 3 instead of the true 2, documenting the caller contract; it is not a production defect.

New [12 diagnostic tests](../src/features/routing/routingAudit.test.ts) use an independent linear-scan Dijkstra and closed-form cost oracle: five grids (open, obstacles, NoData, disconnected, analytical plane), five weights, **4,120 comparisons / 360 disconnected pairs**, independent path-edge sums, deterministic alternatives, directed costs, endpoint policies, sensitivity and offset tests. Existing tests additionally cover reopening, invalid edges/indices, native masked oracles, full-crop routes and worker lifecycle/protocol failures. Synthetic tests establish mathematical correctness within the documented contract, not real-Mars traversability.

Worker/client checks preserve source/grid provenance, requested controls, adjacent points, diagonal flanks and independently summed lengths. Obsolete input/grid results are suppressed and workers terminate on settlement, cancel, error, timeout, input changes or unmount. Original terrain buffers remain attached. Browser tests freshly exercise actual production calculations and clearly identified test-only worker faults. [Detailed algorithm audit and generated results](evidence/science-routing-audit/algorithm-cost/audit.md) document scope and formulae.

No A* rewrite, competing implementation, weight/heuristic change or production correction was made.

## I. Capability status matrix

**VERIFIED** means sufficient evidence for the explicitly stated property; **PARTIALLY VERIFIED** means important confirmed properties still have validation gaps; **UNVERIFIED** means insufficient evidence; **NOT APPLICABLE** means the property does not affect that capability. These classifications do not merge mathematical correctness with scientific validity.

| Capability / property | Status | Evidence and reason |
| --- | --- | --- |
| All 65,536 terrain-cell source preservation | VERIFIED | Independent raw TIFF byte equality and immutable hashes. |
| DEM exact source / full processing version | PARTIALLY VERIFIED | Exact product and bytes verified; final scientific version/history/equation absent. |
| Live CTX vertical height reference | UNVERIFIED | Source declaration conflicts with diagnostics; final model/sign/order unknown. |
| Requested HiRISE label height definition | VERIFIED | Complete exact-product label; separate nonoverlapping candidate, not integrated. |
| Horizontal coordinate model | VERIFIED | Native labels, center/edge rules and independent PROJ inverse checks on declared sphere. |
| Feature-to-DEM fine registration | UNVERIFIED | Rounded MDIM centers and coordinate arithmetic provide no independent landmark control. |
| CTX-to-DEM alignment | PARTIALLY VERIFIED | Shared source frame/lineage and bounded relative diagnostics; absolute controls/accuracy criteria absent. |
| MOLA vertical relationship | PARTIALLY VERIFIED | Provider control lineage and reproducible paired diagnostics; exact final conversion remains unknown. |
| MDIM 2.1 registration | UNVERIFIED | No compatible local control-network transform or independently precise landmarks. |
| Preliminary CTX-to-local alignment | UNVERIFIED | Quantitative native-frame/registration evidence remains unresolved. |
| Named-site placement | UNVERIFIED | Published centers are approximate references, retained with warnings. |
| Scientific globe orientation | UNVERIFIED | Visual NASA GLB and scripted display camera; no calibrated geographic picking. |
| Reference-sphere distance calculation | VERIFIED | All centers/edges and global/native fixtures agree with independent PROJ. |
| Distance as actual terrain-following traverse | NOT APPLICABLE | Current metric explicitly measures reference-sphere graph arcs. |
| Slope arithmetic | VERIFIED | Authorized synthetic directional rise/run fixtures, units and numerical checks. |
| Real-Mars physical slopes | UNVERIFIED | Local height meaning and varying datum effects unresolved; gated. |
| 2D maximum-slope / partial stencil | NOT APPLICABLE | No such derivative feature is implemented; current API is an edge grade. |
| NoData/invalid coverage handling | VERIFIED | Sentinel/nonfinite/boundary exclusion and diagonal-flank tests. |
| Per-cell measured versus edited/fill quality | UNVERIFIED | No complete original quality/provenance mask. |
| Terrain-cost arithmetic | VERIFIED | Nonnegative finite model, synthetic sensitivity and independent closed-form checks. |
| Physical terrain-cost calibration | UNVERIFIED | Unvalidated height input and uncalibrated preferences; gated. |
| Existing A* mathematical search | VERIFIED | Independent synthetic/native oracles under documented nonnegative-cost/admissible-heuristic contract. |
| Current heuristic admissibility / consistency | VERIFIED | Sphere-metric proof plus native five-goal numerical audit; no blanket arbitrary-cost guarantee. |
| Route reconstruction | VERIFIED | Independent path edge sums, endpoint/adjacency checks and bounded predecessors. |
| Hypothetical endpoint selection | VERIFIED | Native selection tests, preserved interactions and actual isolated-browser workflow. |
| Hypothetical distance-only route comparison | VERIFIED | Actual worker paths and waypoint legs with independent lengths/provenance guards. |
| Reproducibility of displayed distance metrics | VERIFIED | Source hashes, unchanged formulas, independent edge sums, browser labels and fixtures. |
| Precise named-feature / terrain-aware routes | UNVERIFIED | Registration/height prerequisites unresolved; unavailable. |
| Safety or survival prediction | NOT APPLICABLE | No validated human-safety model is implemented or claimed. |

## J. Remaining blockers

1. **Final CTX vertical contract:** checksum-linked final positive-up sample equation, reference surface/model/grid/version, signed/order-specific DeltaGeoid and alignment operations, and any correction/tilt record. Generic methods, a filename and a fitted offset cannot substitute for this.
2. **Independent absolute registration:** compatible MDIM-to-local transformation or precise identifiable landmarks with documented coordinates/uncertainty; geographically distributed held-out controls and a justified positional acceptance criterion. Shared-map rover serialization and texture matches are not independent surveyed truth.
3. **Local terrain support / uncertainty:** per-cell original stereo/edited/fill/quality information and a defensible policy for derivatives. Finite coverage cannot classify hazards or human traversability.
4. **Preliminary/HiRISE quantitative alignment:** exact preliminary source model and measured cross-product controls; exact HiRISE DTM/ortho residuals. The requested HiRISE cannot be a direct live-crop control because there is no overlap.
5. **Physical cost interpretation:** once real grades are supported, document/calibrate any desired effort objective and uncertainty. Preference weights and synthetic optimality do not certify safety.

No producer was contacted. Saved source checks preserve documented HTTP failures rather than treating them as successes. No warning or gate was removed to meet a deadline.

## K. Enabled and gated features; fresh verification

**Enabled with existing qualifications:** NASA visual globe / map exploration, MOLA and both CTX display integrations, sources/attribution/retries, approximate feature inspection, all native grid endpoint interactions, numerical provider-value inspection, reference-sphere separation, distance-only hypothetical shortest path and optional waypoint comparison.

**Remain unavailable:** physical CTX slopes and terrain costs, terrain-aware/safer route objectives, precise named-feature endpoint routing, hazard/survival outputs. The NASA GLB remains visual/orientation use with geographic alignment unverified. Pure grade/cost helpers remain testable with labelled authorized inputs, not exposed as verified Mars measurements.

| Fresh root command | Observed result |
| --- | --- |
| `npm run lint` | Exit 0, zero ESLint errors/warnings. |
| `npm run typecheck` | Exit 0. |
| `npm test` with `REDLINE_WRITE_ROUTING_AUDIT=1` | Exit 0, **492 tests / 39 files**, zero failures; regenerated algorithm evidence. |
| `npm run build` | Exit 0, 262 modules; preserved 11.68 kB worker. Existing map/globe chunks above 500 kB produce a nonfatal warning. |
| Horizontal capture + independent PROJ | Exit 0, 65,536 centers / 260,610 edges / 16 fixtures / 5 invalid inputs. |
| Exact HiRISE collector `--verify-saved` + provenance verifier | Exit 0, complete label/receipts and 65,536 byte-identical samples; no crop overlap. |
| Saved CTX/public vertical/HRSC verifiers | Exit 0, 20 + 42 response bodies and 18 native heights / 9 pairs. |
| Registration source/frame/matching/residual verifiers | Exit 0, byte-identical prior measurements / 167 residual rows / relationship checks. |
| Isolated Chromium production replay | Exit 0, **16 acceptance groups**, 56 actual NASA PNG responses, zero page/console errors; 8 workers created / 8 terminated / zero active. |
| `git diff --cached --check` | Exit 0 after recognizing preserved CRLF evidence; source/scientific/routing production modules are unchanged. |

The replay uses a fresh headless Chromium context with reduced motion and the final production preview at `http://127.0.0.1:4174/`. It reuses the prior acceptance script in a **new evidence directory**, preserving historical receipts/screenshots. Worker faults are test-only lifecycle/protocol injections; terrain data and NASA responses remain real. Field tops match and inputs are 44 px high at desktop 1440, tablet 768, mobile 390 and narrow mobile 320. These viewport emulations do not claim physical-device testing.

[Browser receipts](evidence/science-routing-audit/browser/browser-results.json), [desktop screenshot](evidence/science-routing-audit/browser/desktop-routes.png) and mobile/tablet screenshots preserve observed results. The screenshot includes a transient imagery-loading notice and incomplete outer tiles; that loading state is not fabricated terrain. Fresh browser scope covers planning, real imagery loading, sources, keyboard route selection, cancellation, retries and responsive drawers. Layer-switch and globe-navigation behavior was preserved in code and covered by existing tests/historical browser evidence, but was not separately repeated by this replay. Geographic globe orientation remains outside its scientific validation scope.

### Reproduction commands

From the repository root, use the existing npm installation; the evidence Python/Playwright runtimes are separate from application dependencies. Native TS capture requires `node:module.registerHooks` and native TS stripping (observed Node **26.3.1**); it is not supported by every older Node version accepted for normal Vite use.

```powershell
npm run lint
npm run typecheck
$env:REDLINE_WRITE_ROUTING_AUDIT='1'
npm test
Remove-Item Env:REDLINE_WRITE_ROUTING_AUDIT
npm run build

node docs/evidence/science-routing-audit/horizontal/capture-app.mjs
uv run --offline --with numpy==2.5.3 --with pyproj==3.8.0 python docs/evidence/science-routing-audit/horizontal/compare-proj.py
node docs/evidence/science-routing-audit/provenance-height/collect-hirise.mjs --verify-saved
node docs/evidence/science-routing-audit/provenance-height/verify-provenance.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/fetch-new-evidence.mjs --verify-saved
node docs/evidence/scientific-gate-resolution/vertical/analyze-public-evidence.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/inspect-hrsc-ranges.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/sample-hrsc-controls.mjs --verify-saved

node docs/evidence/scientific-gate-resolution/registration/fetch-places-records.mjs --verify-saved
node docs/evidence/scientific-gate-resolution/registration/fetch-native-imagery.mjs --verify-saved
node docs/evidence/scientific-gate-resolution/registration/fetch-native-patches.mjs --verify-saved
uv run --offline python docs/evidence/science-routing-audit/registration/reproduce-frame-check.py
node docs/evidence/science-routing-audit/registration/reproduce-source-geometry.mjs
uv run --offline --with rasterio==1.5.2 --with opencv-python-headless==5.0.0.93 --with matplotlib==3.11.2 --with numpy==2.5.3 python docs/evidence/science-routing-audit/registration/reproduce-native-matching.py
uv run --offline python docs/evidence/science-routing-audit/registration/independent-residuals.py
uv run --offline python docs/evidence/science-routing-audit/registration/dataset-relationships.py
```

Browser reproduction in two terminals:

```powershell
npm run preview -- --host 127.0.0.1 --port 4174 --strictPort
# In a separate terminal, use a separately available Playwright installation:
$env:REDLINE_BROWSER_MODULES='C:\Users\LOQ\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:REDLINE_QA_URL='http://127.0.0.1:4174/'
node docs/evidence/science-routing-audit/browser/browser-check.mjs
```

The horizontal binary capture is generated/ignored, not shipped. Saved source evidence is checked offline without re-fetching; the original HiRISE HTTP retrieval is separately timestamped. Corrected diagnostic-only serialization and quoted-version parsing failures are recorded in the registration report, with diagnostic logs included through a scoped ignore exception. The first staged whitespace check flagged preserved CRLF evidence as trailing whitespace; scoped Git attributes now recognize CR-at-EOL while keeping the exact hashed bytes. Provider HTML whitespace and original stdout endings are retained. The cached uv evidence runtime does not change package.json or the lockfile. The unrelated untracked `.http-forge/` folder is preserved and excluded from the audit checkpoint.

## L. Next recommended milestone

For the existing deadline prototype, the smallest independent product task is a **mission report/print export** containing native endpoint/waypoint indices, source hashes, the distance-only formula and actual metrics, with persistent hypothetical labels and explicit unresolved scientific status. It can improve demonstration reproducibility without relying on unknown heights or fine feature registration.

To unlock physical terrain routing, first obtain the checksum-linked CTX final height contract and matching independent horizontal/vertical controls, then validate derivatives and model assumptions. A separate explicit-datum reference dataset could be investigated in another milestone while preserving CTX; it must not be described as resolving CTX by replacement.

**This task stops at the audit and evidence checkpoint. No next milestone, submission/deployment, A* rewrite or remote push was started.**
