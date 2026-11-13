# Controlled Jezero grid milestone — 13 November 2026

Implemented and verified: controlled CTX image context, a continuous native numerical crop, and two distinct hypothetical source-cell endpoints. Distance, slope, terrain costs and route computation remain disabled. This is the placement/support milestone in [the approved plan](superpowers/plans/2026-11-13-controlled-jezero-grid.md).

## Data and implementation

- Controlled imagery: `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0`, native 6 m projected pixels, WMTS PNG matrices 0–13, distinct [image citation](https://doi.org/10.5066/P9GV1ND3). It starts unselected; opening planning terrain enables it while retaining the other layer preferences.
- Numerical data: source rows 586–841 and columns 522–777 from `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0`. All 65,536 cells are valid in this chosen crop. The boundary is a prototype choice, not a feature accuracy or traverse boundary.
- Browser payload: 3,147-byte manifest plus 262,144-byte native little-endian float32 binary, 265,291 bytes total before transport compression. The original 9.66 MB TIFF stays out of the runtime bundle. Both assets have exact size and SHA-256 checks before use.
- Endpoint identity includes the numerical source ID and global row/column. Map selection chooses the containing cell and reports its native center. No interpolation, datum conversion, nearest-valid snapping, route line or safety score is introduced.
- New modules separate extraction, typed loading/sampling, endpoint state, planner UI and map overlay. Named references retain their separate approximate O/D identity; hypothetical grid endpoints use G-O/G-D.

The [independent source audit](evidence/controlled-jezero-grid/source-registration/audit.md) records fresh normal-TLS source responses and compares every crop sample directly to raw pinned TIFF strip bytes. Root reran its saved-evidence verifier: 65,536 matching values, zero differing float32 bytes, four matching outer corners and seven matching center fixtures. Source and derived hashes remained unchanged.

## Commands and observed results

| Command | Result |
| --- | --- |
| `npm run lint` | Exit 0; no ESLint errors or warnings |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 311 tests across 25 files |
| `npm run build` | Exit 0; 250 modules, 40.48 kB CSS, 625.82 kB main JS, 637.33 kB lazy globe JS |
| `node docs/evidence/controlled-jezero-grid/source-registration/audit-source-grid.mjs --verify-saved` | Exit 0; all source receipts, geometry, tile-alpha and raw-cell checks passed |
| `npm run dev -- --host 127.0.0.1` | Vite ready on port 5173; isolated browser exercised development build |
| `npm run preview -- --port 4175 --host 127.0.0.1` | Vite ready; final production build exercised in isolated browser |
| `git diff --check` | Exit 0 |

The default preview port 4173 was occupied; a separate loopback preview used 4175. The production build retains the existing warning about chunks above 500 kB. No dependency or lockfile change was needed. `npm ci` was not rerun for this milestone.

## Agent-observed browser checks

Tests used a temporary background in-app browser. No personal Chrome tabs or native applications were controlled. Production preview and development were both tested; screenshot evidence is under [browser/](evidence/controlled-jezero-grid/browser/desktop.jpg).

| Journey | Observed result |
| --- | --- |
| Open planning terrain | Pinned crop loaded, controlled imagery selected, crop outline and source details shown |
| Real imagery access | Controlled CTX rendered with received-tile status; no observed console errors in normal final production journeys |
| Native forms | Origin row 714/column 650 and destination row 800/column 730 selected and displayed at their source centers |
| Rejection | Duplicate, outside row 585, and empty row rejected; prior endpoints retained |
| Map picking | Outside click rejected; inside click selected row 667/column 591; map-center action selected row 714/column 650 |
| Keyboard picking | Arrow-right followed by Enter selected destination row 714/column 721 |
| Named feature precedence | Clicking the approximate Belva marker while grid picking inspected Belva and retained grid endpoints |
| State | Swap, clear, panel hide/show and source toggle worked; source hiding and overview disabled picking while preserving cells |
| Overview | Return to overview worked; showing planning terrain restored the crop |
| Responsive | 1600×1000, 768×1024 and 320×800 checked; no horizontal document overflow; no controls beyond the 320 px viewport; narrow-layout endpoint assignment worked |

Saved images: [desktop](evidence/controlled-jezero-grid/browser/desktop.jpg), [tablet](evidence/controlled-jezero-grid/browser/tablet.jpg), [mobile](evidence/controlled-jezero-grid/browser/mobile.jpg), [failed controlled tiles](evidence/controlled-jezero-grid/browser/controlled-tiles-failed.jpg).

## Failure injection and fixes

The [local QA server](evidence/controlled-jezero-grid/browser/qa-server.mjs) serves the production build on loopback port 4174 and labels injected failures conspicuously. Its mode file is ignored under `node_modules`; this harness is not part of the deployed app.

- Manifest HTTP 503 produced the unavailable-asset message and retry action. A changed binary byte at the same length failed SHA-256 validation. Restoring normal bytes and retrying loaded the original valid grid.
- Controlled capabilities HTTP 503 left numerical terrain loaded while disabling picking. Controlled tile failures at a newly requested zoom disabled picking despite successful earlier tile loads; restoring requests and retrying restored the ready state and picking.
- A five-second delayed manifest load followed by Jezero feature inspection preserved that later action: the grid became available without enabling controlled CTX or moving away from the inspected 77.690°, 18.410° approximate reference center.
- Vite's actual empty `Content-Type` for `.f32` exposed an integration failure. The loader now accepts absent/empty binary MIME while retaining exact size/hash verification; nonempty incorrect MIME and untyped JSON still reject. Dedicated tests exercise these cases.
- Current controlled-image frame readiness now gates map picking, replacing accumulated load counts. The callback checks active-map, source/frame/zoom and nontransparent displayed-image support. This is display readiness, not a complete valid-pixel coverage or landmark-accuracy certificate.
- Grid labels moved above their symbols so a grid center near Belva does not overlap the approximate reference label below it. Browser verification confirmed the distinction.

The actual crop contains no NoData cells. Synthetic test-only NoData/nonfinite cells exercise sampler and selection rejection in unit tests; no synthetic cells were displayed as Mars observations. Injected altered runtime assets were rejected before selection.

## Limits and next milestone

Shared controlled-image/DEM geometry and photogrammetric lineage establish relative source placement, not absolute landmark accuracy or registration to MDIM 2.1 named centers. Image and DEM outer extents differ slightly, and their 6 m/20 m boundaries are distinct. Rendered image values were not matched pixel by pixel to the native image TIFF. Heights remain provider-declared IAU-sphere metres with independently unvalidated vertical-reference interpretation.

The next milestone is independently validated Mars physical distance, slope, missing-support edge policy and nonnegative terrain costs, followed by A* or Dijkstra and reproducible route comparison. Mission report/science context and current official challenge/rule/submission checks follow that work. This checkpoint does not complete the project or establish competition eligibility, NASA endorsement, hazard detection or astronaut safety.

Local commit: `feat(planning): add controlled Jezero grid endpoints`. The hash is reported at handoff and available in Git history. No push, deployment or submission was performed.
