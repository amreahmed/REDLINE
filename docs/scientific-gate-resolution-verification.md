# Scientific gate investigation — 14 November 2026

This milestone extends `e79448a` with actual localization records, native image registration diagnostics, complete paired HRSC support, and an exact-product processing audit. It completes the bounded public-source investigation and reproducible comparison tooling. **It does not complete absolute named-feature registration or establish the exact CTX final height reference.** Physical DEM slopes, terrain costs and routing remain blocked.

## Decision record

| Question | Evidence-supported result | Remaining requirement |
| --- | --- | --- |
| Original CTX source/grid geometry | Previously verified; all 65,536 samples and manifest bytes preserved | Absolute accuracy is a separate question |
| Actual rover localization records | Released PLACES records and matching map labels retrieved; frame/pixel conventions audited using actual cutout labels instead of inconsistent orbital dimensions | These are localized positions, not independent surveyed landmarks |
| Relative PLACES imagery to controlled CTX | Ties measured in nine sampled overlap patches; actual cutout omits the northern 903.14 m | Named MDIM centers, absolute registration error and an acceptance criterion remain unvalidated |
| Separate HRSC native numerical contract | DT5/DA5 encoding, distinct vertical references, geometry and complete 103 × 103 paired masks verified | Acquisition/contributor list, scientific version, effective resolution and local uncertainty remain unknown |
| CTX final vertical definition | Public records continue to declare sphere heights while numerical comparisons conflict | Exact final sample equation, correction model/grid/version/sign/order or revised product metadata |
| DEM grades/costs/routes | Arithmetic and missing-data tests preserved; no capability enabled | Supported numerical source interpretation, measurement validation, then pathfinding |

## Registration findings and coverage

The [registration audit](evidence/scientific-gate-resolution/registration/audit.md) resolves the pixel/frame ambiguity for actual **release 16.0 PLACES records**. It checks 666 CSV records, including 21 localized SITE definitions (21–41) inside the crop and 50 localized ROVER records. Provider MD5s and local receipt hashes are retained. SITE serialization agrees with the earlier SPK, but that agreement is not independent positional accuracy.

The actual map cutout has a consistent 59,200 × 21,920 grid at 0.25 m, radius 3,396,190 m and standard parallel 18.4663°. Its pixels use corner-origin coordinates; array centers add 0.5. The separate orbital metadata contains duplicated keyword blocks and inconsistent dimensions versus extents, so it cannot override the real matching cutout label. The actual cutout omits the northern **903.140188 m** of the CTX crop. Empirical comparisons cover nine spatial patches inside the overlap, not that omitted strip or all unsampled terrain.

Native-image correlation retained 159 distinctive nominal ties, with five preselected fit patches and four held-out patches. A descriptive translation fit has **2.01962 m held-out RMS**, maximum **5.22291 m** across 62 ties. One broad-set match changes by **47.79205 m** when template size changes; retaining this failure makes the sensitivity visible rather than hiding it.

A traceable subset selects one tie per patch by maximum minimum correlation across three template sizes, without using residual or displacement thresholds. Eight patches provide such a tie; one provides none. Its three held-out ties have RMS **1.97195 m**, maximum **2.19346 m**, and selected template sensitivity reaches **2.39224 m**. These are conditional matching diagnostics, not uncertainty bounds or certified image accuracy. The [visual board](evidence/scientific-gate-resolution/registration/selected-spatial-ties.png) shows the actual paired texture anchors, including the patch with no multiscale tie.

No fitted translation, scale or correction is applied. Source projection conversion, empirical image agreement, absolute geodetic accuracy and registration of rounded MDIM named-feature centers remain distinct. The SIS's expected 0.5 m map-relative localization figure is not a confidence interval and cannot be combined with these diagnostics into a fabricated accuracy bound. The mission imagery shares control lineage; no independent absolute landmark or MDIM transformation was established.

## Complete native height comparison

The [HRSC source audit](evidence/scientific-gate-resolution/hrsc/README.md) retains **10,609 paired original int16 samples per product**, with zero NoData, from **206 exact HTTP 206 row intervals**. Every stored sample and validity bit agrees with an independent Rasterio/GDAL read using original TIFF offsets. PROJ and GDAL independently check horizontal edges and the radius difference. The reference retains ESA/DLR/FU Berlin attribution and CC BY-SA 3.0 IGO terms. It is evidence outside the application, not a terrain replacement.

The [support comparison](evidence/scientific-gate-resolution/comparison/audit.json) accepts **10,201** complete HRSC footprints and rejects **408** border-overhang cells. No missing CTX support or reference pairs occur among accepted cells. Their footprints cover approximately **97.30%** of the original crop surface area; the narrow remainder is excluded from this comparison, not deleted from the application.

CTX samples are explicitly modelled as constant within their native cells, with spherical surface-area weights over each reference footprint. This is an aggregation assumption, not a claim that the raster posts are measured footprint averages. Radius-ratio mapping preserves geographic edges between the 3,396,000 m HRSC and 3,396,190 m CTX spheres. `DT5 − 190 m` changes only the separately documented HRSC reference radius for this diagnostic.

| Diagnostic, metres | Minimum | Maximum | Mean |
| --- | ---: | ---: | ---: |
| CTX model aggregate minus HRSC DA5 areoid height | −68.675588 | +29.251285 | −10.390558 |
| CTX model aggregate minus HRSC DT5 expressed above 3,396,190 m sphere | +1618.463108 | +1710.251285 | +1676.685807 |

The full per-cell CSV is retained with a checksum. An independent Python degree-domain overlap calculation and eight-node Gauss–Legendre quadrature checked six real cells, including both extrema: maximum scalar discrepancy **3.05 × 10⁻¹¹ m**, area discrepancy **4.88 × 10⁻⁸ m²**. These establish implementation agreement under the chosen support model, not observational precision.

HRSC shares CTX control lineage. Different reconstruction support, resolution and unmeasured registration errors prevent interpreting these ranges as independent accuracy bounds. Similarity to DA5 cannot supply CTX's missing height equation or authorize a datum conversion.

## Exact-product public record and remaining action

The [vertical investigation](evidence/scientific-gate-resolution/vertical/findings.md) checks **42 saved HTTP bodies**, complete current CTX/TRN inventories (35/92 objects), DOI/catalogue records, component FGDCs, processing publications and pinned historical TRN code. Unavailable version/revision endpoints are retained with their actual 403/404 outcomes. The final record does not establish the exact `DeltaGeoid` model/version/sign/order.

Kirk et al. 2021 cites the exact public CTX product and reports an approximately **0.09° east–west tilt** relative to HRSC. That published inter-product finding is not a correction measured for this crop. It further prevents assuming a constant offset is sufficient for physical-grade validation. The 12 m orthographic flight map has a different elevation definition and cannot be used to relabel this 20 m equirectangular TIFF.

A [specific unsent clarification draft](evidence/scientific-gate-resolution/vertical/unsent-provider-clarification.md) identifies the exact TIFF/hash, contradictory metadata, diagnostic values, and the requested final equation, correction identity/sign/order and any revised/support-quality record. It is addressed in the local document to the official product contact. No email-service draft, external message or producer contact was created. Sending needs explicit user authorization under the assistant's external-messaging instruction.

Independent MOLA PEDR radial controls and a separate qualified HRSC measurement pipeline can progress without pretending to resolve the CTX contract. Neither campaign was implemented here. Named science-target routing additionally needs independent absolute landmark evidence and a justified use-specific acceptance criterion; relative ties cannot provide that by themselves.

## Changes and preservation

New tools are `scripts/native-support.mjs`, `scripts/test-native-support.mjs`, and `scripts/compare-ctx-hrsc-support.mjs`. They operate outside the production bundle, fail closed on incomplete support, and produce auditable evidence only. New evidence lives under `docs/evidence/scientific-gate-resolution/`; source-specific tools are documented in each lane. README, this verification record, the implementation plan and the scoped `.gitattributes` evidence rule provide the handoff.

No `src/` or `public/` code/data changed. No dependency, lockfile, globe/map engine, scientific production transform, mission interaction or algorithm changed. The application continues to display Partial scientific validation and unavailable slopes/costs/routes. Earlier UI disclosures retain their historical nine-probe evidence; this investigation does not silently replace those figures with the different support model.

| Preserved asset | SHA-256 |
| --- | --- |
| Original TIFF | `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b` |
| 65,536-cell binary | `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8` |
| Native manifest | `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9` |

## Fresh automated verification

| Command/check | Observed result |
| --- | --- |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 421 tests in 33 files |
| `npm run build` | Exit 0; existing >500 kB chunk warning remains |
| `node --test scripts/test-native-support.mjs` | Exit 0; 8 mathematical/coverage/missing-data tests |
| Native support saved-output verifier | Exit 0; 10,201 comparisons reproduced and original hashes matched |
| HRSC native/source-documentation/review verifiers | Exit 0; all native samples/masks, 6 response/encoding tests, independent projections and quadrature |
| Vertical saved-response/analysis verifiers | Exit 0; 42 bodies, inventories and unchanged CTX source/crop |
| PLACES record/frame/native-byte verifiers | Exit 0; released records/provider hashes, 21 matched SITE definitions, two CTX ranges and nine lossless PLACES patches |
| Pinned offline native-image measurement | Exit 0; 159 nominal ties/62 held-out ties and 8 selected multiscale ties reproduced |
| `git diff --cached --check` | Exit 0 |
| Staged evidence byte comparison | Exit 0; all 346 evidence files / 76,391,013 bytes equal working copies exactly |

The new support test command first failed on the missing implementation module, then passed after implementation. The first exact-pinned image replay failed because the documentation confused OpenCV's internal library version 5.0.0 with the installable distribution version 5.0.0.93. The documented pin was corrected and the replay passed with unchanged measurements; thresholds and source samples were not altered. No claim that the application test count increased is made; build-time support tests are a separate command.

Reproduce root support tests and deterministic output:

```powershell
node --test scripts/test-native-support.mjs
node scripts/compare-ctx-hrsc-support.mjs --verify-saved
```

Exact source-specific reproduction commands are in the [HRSC audit](evidence/scientific-gate-resolution/hrsc/README.md), [vertical audit](evidence/scientific-gate-resolution/vertical/findings.md), and [registration audit](evidence/scientific-gate-resolution/registration/audit.md). Saved-source modes do not fetch missing provider data; they validate recorded evidence. Optional Python tools use isolated pinned runtimes, without application dependency changes. Lossless compressed native image evidence retains restored octet hashes/range records; its approximately 59.5 MB size stays outside the production bundle.

## Fresh isolated-browser smoke acceptance

Used a temporary hidden in-app browser at production preview `http://127.0.0.1:4183/`, with its normal **1280 × 720** viewport. No personal browser tab, native device control, cookie import or security bypass was used. The temporary tab was closed and the owned preview process stopped afterward.

- [x] Official NASA Mars model loaded; planning navigation entered the actual regional map.
- [x] Controlled CTX imagery rendered; MOLA, preliminary CTX and controlled CTX reported received tiles with visible attribution.
- [x] Plan loaded all 65,536 cells, zero missing; row 714/column 650 origin and column 651 destination produced 19.0 m reference-sphere separation.
- [x] Keyboard Enter opened Sources; source geometry remained Verified, named-feature and height-reference status remained unresolved, and route comparison stayed unavailable.
- [x] Sampled production warning/error logs were empty. Screenshot was displayed during observation; no persistent UI screenshot is bundled.

This is a targeted preservation smoke check. Desktop/tablet/mobile matrices, full layer failure/retry checks and complete keyboard-map-picking tests from earlier checkpoints are historical and were not all repeated for an evidence-only change.

## Completion boundary

This is a verified evidence/tooling checkpoint, **not completion of the scientific-validation phase**. The concrete external requirement is producer clarification or a fully documented alternative source plus appropriate independent controls. No A* or next terrain/routing milestone begins here.
