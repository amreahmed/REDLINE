# Scientific status UX cleanup — 15 November 2026

This presentation milestone starts from `bcc94265e3cd48df641b123526232ccacbf457f3`. The source of truth is the unchanged [scientific and existing A* audit](science-routing-audit.md). Scientific validation remains **Partial**. No unresolved property has been promoted to verified.

## Result and scope

The footer provides a compact **Scientific validation: Partial** button that opens Sources and focuses its scientific heading. Terrain-load and route-computation statuses appear during planning. Exploration no longer repeats height-reference and registration paragraphs globally.

Terrain, approximate references, imagery and route results retain short contextual qualifications. Scientific and source disclosures retain detailed evidence, coordinate definitions, height-reference conflicts, residuals, missing coverage, algorithm assumptions and attribution. Informational copy uses the existing neutral palette; relevant unverified labels and actual failures retain amber. No red error styling was introduced.

Opening scientific details exits active map picking. Closing the drawer restores focus to its opener; changing to another navigation section resets that return target. A mobile layout rule reserves room for the route qualification while an informational map notice is visible, and footer planning statuses use full rows to avoid unnecessary wrapping.

The original audit is downloadable as `REDLINE-scientific-audit.md`, with byte-for-byte verification against the original file. **There was no existing mission export component.** This adds access to the complete scientific audit, not a new per-mission export workflow. Route source identifiers and source/grid hashes are available in the existing model details. No historical evidence or report was changed.

## Independent capability statuses

| Capability | Status retained | Scope |
| --- | --- | --- |
| Source-to-grid preservation | Verified | All 65,536 native source cells; not stereo quality or traversability. |
| Reference-sphere distances | Verified | Declared sphere geometry; not absolute ground accuracy. |
| Existing A* mathematical search | Verified | Documented nonnegative costs and admissible heuristic. |
| Hypothetical distance-only paths | Verified | Graph lengths and waypoint comparison under hypothetical connectivity. |
| Requested HiRISE height definition | Verified | Separate nonoverlapping product only. |
| Live CTX vertical height reference | Unverified | Final equation, model, sign and order unresolved. |
| Absolute feature-to-DEM registration | Unverified | Relative ties and rounded centers do not provide independent absolute control. |
| Real-Mars physical slopes | Unverified | Remain unavailable. |
| Physical terrain costs | Unverified | Physical inputs/calibration remain gated. |
| Precise named-feature routing | Unverified | Approximate references remain separate from hypothetical native cells. |
| Scientific globe orientation | Unverified | Visual model and scripted approach; no validated geographic picking. |

Visible distance-only routes retain the exact qualification:

> Distance-only hypothetical route. Terrain and human safety are not validated.

## Complete warning disposition

Each row identifies the prior occurrence, including duplicates. Removal here means removal of an occurrence, not removal of the scientific limitation.

| Component / prior occurrence | Disposition | Current presentation |
| --- | --- | --- |
| MissionStatusBar global height/registration text and repeated assistive text | Consolidated | Working compact Partial details button. Planning-only load/route status. Full terrain issues remain in scientific details. |
| MarsExplorer overview stage orientation warning | Relocated | Stage says Visual model; orientation status and full qualification are in the model source and capability details. |
| MarsExplorer navigation geographic-picking paragraph | Duplicate removed | Full lack of calibrated geographic picking remains in model/science details. |
| MarsExplorer scripted handoff / no location transfer / geometry paragraph | Relocated | Complete model source expansion; viewport instructions direct users to scientific details. |
| MarsExplorer unconditional map registration banner | Made contextual | Selected approximate reference gets its registration qualification. Visible paths get the exact distance-only qualification. Neither context creates a global banner when absent. |
| MissionControl Explore repeated globe paragraph | Consolidated | Approximate crater navigation label; scripted approach and unvalidated orientation remain in source details. |
| MissionControl generic MOLA / CTX description | Clarified | Rendered MOLA shaded-relief versus numerical elevation; preliminary versus controlled CTX. Exact product IDs appear next to switches. |
| MissionControl permanent coverage footnote | Relocated | Complete coverage-box / missing-tile / no-simulated-replacement text in How the layers work. |
| InformationPanel model overview paragraph | Consolidated / relocated | Compact visual-model orientation status plus full model details, lighting, scripted/no-location-transfer and nonnumerical qualifications. |
| InformationPanel per-layer scientific paragraphs | Restyled / clarified | Short neutral qualifications; native coordinates, latitude issues, fine registration, resolution limits and attribution remain in source metadata. |
| InformationPanel collapsed product identifiers | Promoted | Actual identifiers now visible in source overviews and layer controls. Values unchanged. |
| InformationPanel footer sphere/slope/cost/safety paragraph | Duplicate removed | Sphere/terrain/route/science details retain those limits. Imagery and numerical terrain remain explicitly separate. |
| GridPlanner combined feature/cost paragraph | Consolidated | Hypothetical native-cell endpoints / distance-only planning; selection details retain source-frame and absolute-landmark limitations. |
| GridMetrics height blocker paragraph | Relocated | Height gate is still invoked; warning remains in Distance model & calculation limits. |
| GridMetrics stale claim that comparison still needs pathfinding | Corrected | Removed obsolete fallback copy; implemented distance-only search remains separate from unavailable terrain-aware results. |
| RoutePlanner recorded-rover-traverse paragraph | Relocated | How this model works retains the simulation versus recorded-traverse distinction. |
| RoutePlanner repeated traversability/terrain/named/safety paragraph | Consolidated | Exact required qualification visible beside results and on map. Full limitations, formula, connectivity, waypoint policy and provenance remain in model details. |
| PlanningTerrainDetails broad Verified native crop label | Clarified | Source-to-grid preservation: Verified. Does not imply complete scientific validation. |
| PlanningTerrainDetails combined registration/height/cost paragraph | Relocated | Compact live CTX height Unverified label; full height and registration limitations remain in Height-reference evidence. |
| TerrainInspection broad Validated source windows label | Clarified | Checked source windows loaded, without implying physical-height validation. |
| TerrainInspection repeated height/registration/slope/cost/safety paragraph | Relocated | Compact provider-value interpretation qualification plus the full original paragraph in numerical source metadata. |
| FeatureDetails preliminary-only registration warning | Clarified | Approximate published center / absolute feature-to-DEM registration unverified. All individual target limitations and citations retained. |
| FeaturePlanner combined reference warning | Consolidated | Concise approximate-center / absolute-registration qualification next to working references. |
| FeaturePlanner image-colors/elevation statement | Duplicate removed | Retained with layers, numerical terrain and source details; reference/grid distinction remains here. |
| AboutDialog long scientific scope paragraph | Consolidated | Scope/Partial summary and working details button. Independent-product and uncertified-human-safety statement retained. |
| ScientificValidation generic findings | Expanded accurately | Eleven distinct capability statuses, preserving mathematical versus scientific scope. |
| ScientificValidation next-requirement warning paragraphs | Restyled | Neutral expanded requirements, without removing evidence or validation conditions. |

Preserved operational states are not collapsed into scientific status:

- GridPlanner: numerical loading, load failure/retry, unavailable imagery/picking guidance and invalid-selection notices.
- RoutePlanner: blockers, calculation progress, cancellation, startup/protocol/timeout errors, retries and invalid-waypoint feedback.
- GridMetrics: unavailable or mismatched-source distance results.
- TerrainInspection: loading, failed numerical requests/retry and absent native window coverage.
- FeaturePlanner: empty search and invalid reference-selection alerts.
- MissionControl: globe loading/failure, layer service/coverage/failure/missing-tile status and retry controls.
- InformationPanel: service details and missing-tile qualifications.
- MarsExplorer: model/map loading, errors, retries, picking, transition/cancellation and navigation notices.

Also preserved: expanded marker legend's approximate-reference/hypothetical-connectivity qualifications; NASA attribution and source links; coordinate definitions; unknown acquisition dates and effective resolution; all original target limitations. Inactive legacy `GlobePanels`, `MarsGlobe`, `MarsMap` and `MapPlaceholder` retain their visual-only, nonnumerical, unregistered or placeholder qualifications and are not mounted by the current App.

Scientific details expose the audit's relative texture residuals, omitted northern PLACES strip, shared-control limitation, separate HiRISE datum/nonoverlap, unresolved varying vertical correction and absent original quality mask. These are existing findings, not new validation results.

## Files and preserved calculations

Refactored UI: App, MarsExplorer, AboutDialog, InformationPanel, MissionControl, MissionStatusBar, FeatureDetails, FeaturePlanner, GridMetrics, GridPlanner, PlanningTerrainDetails, RoutePlanner, ScientificValidation, TerrainInspection and existing CSS. Added `scientificCopy.ts` for consistent presentation-only copy. Updated three presentation test files, README and this verification record; added a replay in a new evidence folder.

There is no diff in `src/data`, `src/features`, `public`, preparation scripts or `docs/science-routing-audit.md`. DEM values, coordinate transformations, grid selection calculations, A*, worker behavior, route costs and scientific gates are unchanged. The saved independent provenance verifier compares **65,536 float32 cells with zero differing bytes**, confirms the original source/grid/manifest hashes and reaffirms the separate HiRISE does not overlap.

## Fresh verification

| Check | Result |
| --- | --- |
| `npm run lint` | Exit 0; zero ESLint errors/warnings. |
| `npm run typecheck` | Exit 0. |
| `npm test` | Exit 0; **498 tests / 39 files**, zero failures. |
| `npm run build` | Exit 0; 264 modules, unchanged 11.68 kB worker. Existing map/globe chunks above 500 kB produce a nonfatal warning. |
| Saved independent provenance verifier | Exit 0; 65,536 byte-identical float32 samples. |
| Isolated production browser replay | Exit 0; **23 acceptance groups**, **61 actual NASA PNG responses**, zero page/console errors. Eight workers created and terminated; zero active. |
| Working/staged whitespace and protected-path review | Exit 0; protected scientific/data/routing paths and the historical audit are unchanged. |

The browser received a 34,551-byte audit download with SHA-256 `7cc767388a3a5013947c9b920147a9343659391db582e93e1674eab39d44d0f1`, identical to the original. Waypoint input tops match and inputs remain 44 px high at every checked viewport. Calculated paths retain the prior 4.15 km / 161-cell and 4.89 km / 226-cell labels for the same native endpoint/waypoint fixtures.

Initial lint/typecheck found an unused removed-copy import and an incomplete test fixture; both were fixed before final checks. An initial browser replay stopped on an outdated case-sensitive copy assertion, corrected in the replay. Screenshot review found a narrow-mobile notice/qualification overlap; the final CSS and replay explicitly check its resolution. These runs were not reported as final passes.

The [initial copy-assertion screenshot](evidence/scientific-status-ux/browser/initial-copy-assertion.png) is retained as a diagnostic capture, separate from final acceptance screenshots.

The browser replay uses a fresh **headless Chromium** context and the production preview at `http://127.0.0.1:4174/`. It uses no personal profile or native-app control, and does not bypass browser security. Fault injections exercise only test worker lifecycle/protocol behavior; source terrain and NASA imagery remain real. Responsive checks emulate viewports, not physical devices.

### Visual and interaction acceptance checklist

- [x] Desktop: map/globe remains primary; compact status, docked context and readable neutral science details.
- [x] Tablet (768 × 1024): one active drawer, field alignment, controls/attribution accessible, no horizontal overflow.
- [x] Mobile (390 × 844) and narrow mobile (320 × 800): readable bottom sheets, footer/details access, no horizontal overflow or notice/route-qualification overlap.
- [x] Drawers: footer and About open/focus science; Escape returns to opener; switching context restores the current rail trigger; opening science exits active map picking.
- [x] Layers: MOLA rendered-image distinction, actual preliminary/controlled CTX identities, functional switches, route-caption visibility tracks controlled imagery.
- [x] Sources: full capability, residual, coordinate, datum, product, attribution and limitation disclosures; immutable audit download.
- [x] Globe/map: real NASA GLB rotation/reset, actual map imagery, native grid endpoint selection and route rendering.
- [x] Routes: shortest and waypoint paths, exact qualification, accessible selection, clear/reset/cancel and failures/retries.
- [x] Keyboard: science heading focus, details expansion, route selection, Escape behavior and visible focus.

Screenshots were manually inspected for desktop overview/routes/science details, tablet routes and narrow-mobile science. Transient NASA tile-loading notices and incomplete outer imagery can appear in evidence; they remain honest loading/coverage states. No broad live-service availability or geographic globe calibration is claimed by these UI checks.

Replay: run `npm run preview -- --host 127.0.0.1 --port 4174 --strictPort` and, in a separate terminal:

```powershell
$env:REDLINE_BROWSER_MODULES='C:\Users\LOQ\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node docs/evidence/scientific-status-ux/browser/browser-check.mjs
node docs/evidence/science-routing-audit/provenance-height/verify-provenance.mjs --verify-saved
```

See [browser receipts](evidence/scientific-status-ux/browser/browser-results.json), [desktop overview](evidence/scientific-status-ux/browser/desktop-overview.png), [route viewport](evidence/scientific-status-ux/browser/desktop-routes.png), [science details](evidence/scientific-status-ux/browser/desktop-scientific-details.png), and mobile/tablet screenshots beside them.

This milestone stops at presentation refinement. Scientific blockers, terrain-aware routing and per-mission export remain separate work. No push or next feature is authorized by this checkpoint.
