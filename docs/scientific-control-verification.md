# Scientific controls and remaining validation gates — 14 November 2026

This bounded milestone extends checkpoint `9d70fac`. It completes new control-source discovery, reproducible numerical diagnostics and their qualified presentation. **Precise named-feature registration and the exact CTX height reference remain unresolved; physical DEM grades/costs and route comparison are still unavailable.** No A*, DEM correction, source replacement or new scientific algorithm was implemented.

## Accepted findings

- [Registration audit](evidence/scientific-resolution-2026-11-14/registration/audit.md): two checksum-verified NAIF/JPL kernels supply 41 archived fixed rover-site definitions; 21 map inside the unchanged crop. CSPICE reproduces Gaussian-to-planetocentric landing conversion; the landing lies outside the crop. Coordinates, kernel provenance and native cell mappings are real. No image-space landmark residuals, compatible MDIM transformation or per-site uncertainty have been established.
- [Height audit](evidence/scientific-resolution-2026-11-14/height/findings.md): paired HRSC `HMC_13E10_dt5` and `HMC_13E10_da5` explicitly identify metre heights above a 3,396,000 m sphere and GMM3 equipotential surface. Their identical 50 m grids have bounding coverage across this crop; nine sampled pairs are valid. Complete native mask coverage is not established.
- Across all nine samples, CTX minus HRSC areoid heights is **−65.27978515625 to +3.45458984375 m**; CTX minus HRSC heights above the app's 3,396,190 m sphere is **+1621.72021484375 to +1695.42138671875 m**. The comparison uses `DT5 − 190 m`, without changing CTX or HRSC samples. UI ranges round outward to **−66 to +4 m** and **+1,621 to +1,696 m**.
- HRSC has different cell support and shares CTX alignment lineage. These are diagnostics, not independent ground truth, accuracy estimates, a validated datum conversion or physical slope validation. Three same-lineage CTX inputs contain `GEOID=mola`, but that flag does not establish operation direction/version. Exact final TIFF history/sidecar requests returned 404.
- [Method review](evidence/scientific-resolution-2026-11-14/method-review.md): a separate 2017 Jezero West provider slope product is a metadata-only candidate. Its envelope overlaps the crop, but units, masks, numerical support and registration are not validated. It was not integrated.

## Application changes and preservation

`scientificEvidence.ts` records a small typed diagnostic summary. `ScientificValidation.tsx` replaces the previous Sources scientific block with the same visible unresolved status and two keyboard-accessible disclosures: registration evidence/requirements and height evidence/requirements. Links go to actual retrieved authoritative documentation. `terrainScience.ts` updates limitations only; its scientific statuses and fail-closed height blocker are unchanged. Two CSS rules preserve established spacing and readable source-link styling.

Six new tests bind source hashes, counts, ranges and disclosure semantics to the saved audit and retain unresolved gates. Existing origin/destination forms, reference selections, source inspection, layers, globe/map engines, geometry transforms and arithmetic are preserved. No app dependency or lockfile changed. Build-time evidence tools remain outside the production bundle.

The scoped `.gitattributes` rule preserves exact audit bytes across Windows checkouts, following the existing evidence-directory convention. Provider whitespace is intentionally retained; it is part of the hashed response, not application formatting. Staged blobs were compared with every working audit file before committing.

Preserved hashes:

| Asset | SHA-256 |
| --- | --- |
| Native 65,536-cell binary | `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8` |
| Native manifest | `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9` |
| Original provider TIFF | `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b` |

## Fresh automated verification

| Check | Observed result |
| --- | --- |
| `npm run lint` | Exit 0; no lint warnings/errors |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; **421 tests in 33 files** |
| `npm run build` | Exit 0; existing >500 kB chunk warning remains |
| Registration source and PLACES saved-receipt verifiers | Exit 0; authoritative bodies/checksums, unavailable responses retained as unavailable |
| SpiceyPy/Rasterio control reconstruction | Exit 0; Gaussian conversion, 41 sites, 21 crop mappings, unchanged source hashes |
| Height saved-source verifier | Exit 0; 20 source bodies |
| HRSC header and TIFF-directory verifiers | Exit 0; two bounded headers and receipt-backed native contracts |
| HRSC sample verifier | Exit 0; 18 native sample ranges, nine paired comparisons |
| Rasterio alternative-contract verifier | Exit 0; three CTX inputs and seven fixture comparisons per input |
| Method verifier | Exit 0; nine receipts/seven accepted responses, HRSC reference algebra and unchanged 65,536-cell assets |
| `git diff --check` | Exit 0 |

The two new test suites failed on missing modules before implementation and passed afterward. A final small refactor formats the same signed ranges directly from the typed evidence registry; its rendered strings passed the focused tests. Existing mathematical and mission regression tests remain intact.

## Agent-observed production browser acceptance

Used a temporary **hidden isolated in-app browser** at production preview `http://127.0.0.1:4183/`. No personal tabs, native device controls, cookie import, browser security bypass or external messaging were used. The temporary viewport override was reset and tab closed afterward; the owned preview process was stopped. Screenshots were displayed during verification; no persistent browser screenshot file is bundled in this checkpoint.

- [x] Desktop 1600 × 1000: actual NASA model loaded, regional controlled CTX rendered, and 65,536 native cells loaded. Scientific status and data provenance remain separate.
- [x] Registration and height disclosures: Enter opens/closes; content matches accepted findings and source links. Candidate controls create no planning endpoints. No physical slope/cost/route result is shown.
- [x] Native mission journey: row 714/column 650 origin and row 714/column 651 destination yield **19.0 m** reference-sphere separation. Drawer changes retain endpoints/data; swapping retains magnitude; clearing removes the value.
- [x] Tablet 900 × 1100: one active drawer and no horizontal overflow.
- [x] Mobile 320 × 900: readable bottom sheet, one active drawer, no horizontal overflow, persistent terrain/scientific/route status. Tab reaches the HRSC source link with visible focus; Escape closes Sources and Plan retains selections.
- [x] Routes remain disabled. Sampled production console errors/warnings were empty.

This is targeted acceptance for the changed disclosures and preserved terrain workflow. The full earlier transition, layer-failure/retry and keyboard-map-picking matrices remain historical evidence in the prior checkpoints; they were not all repeated here. The final range-formatting refactor preserves the browser-observed text and was verified by rendered-component tests.

## Concrete remaining scientific work

1. **Registration:** obtain matching PLACES localized `best_tactical` pixel controls, native map/DEM labels and orbital metadata. Verify lineage/projection conventions, identify spatially distributed stable image landmarks, measure independent residuals/selection uncertainty, and justify an acceptance criterion. Site coordinate mappings alone do not validate named features.
2. **Vertical reference:** establish the exact current CTX final vertical surface, geoid model/version/sign and processing equation. Then compare compatible same-reference, matching-support controls with explicit registration limits. Alternatively audit a separate versioned numerical DEM with complete metadata/coverage; preserve and disclose the current crop independently.
3. **Terrain/routing:** only after the required source interpretation is supported, validate real DEM grades/costs and then implement/test A* or Dijkstra and route comparison. Synthetic formulas, all-valid samples and candidate sources do not satisfy those prerequisites.

No request was sent to a data producer. If the processing equation is unavailable publicly, producer clarification needs explicit user authorization; this milestone does not invent that clarification or require it to complete the accepted diagnostics.
