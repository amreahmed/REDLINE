# Native HRSC terrain model and route comparison

This milestone adds a functioning route-cost model derived from actual native Mars Express HRSC DEM samples. It preserves all 65,536 CTX cells and the existing CTX distance planner. **Scientific validation remains Partial.** HRSC derivatives and route scores are explicitly qualified provider DEM model outputs; physical Mars slope accuracy, actual traversability, precise named-feature routing and safety remain unverified.

## Original route appearance

The existing CTX graph assigns only reference-sphere distance to each eight-neighbor edge. Its shortest path therefore generally follows a direct grid direction. It was never a terrain-aware search. The existing renderer already draws every returned grid center; it does not replace the path with a direct segment. Neither historical route geometry nor the tested distance A* was rewritten.

## Source authorization and preservation

The new source is `HMC_13E10_DT5`, the ESA/DLR/FU Berlin HRSC HMC-30 Level-5 native DTM. The independently inspected provider contract names positive-up metre heights above a 3,396,000 m sphere, with a matching zero-origin equirectangular projection and 50 m projected posts. The cached 103 × 103 subset contains 10,609 original int16 samples with 1 m quantization and a separate validity mask. Float32 API conversion is exact; there is no interpolation, resampling or height correction.

Source and scientific authorization, exact native coordinates, provider terms and hashes are documented in [source-authorization.md](evidence/terrain-model/source-authorization.md). `sourceHash` binds the saved source-evidence manifest; the complete 638 MB TIFF was not downloaded or hashed. Full-TIFF checksum, scientific release version and acquisition contributors remain null. The source-derived subset retains CC BY-SA 3.0 IGO attribution and change notice.

The CTX binary remains SHA-256 `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8`; its manifest remains `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9`. The original CTX scientific gate, samples, transforms, numerical math, grid adapters, distance routing and historical evidence are unchanged.

## Metrics and model assumptions

- **Local gradient:** central east/west and north/south native-height differences divided by their individual source-sphere arc baselines; gradient magnitude converted to degrees. East/west projected spacing is not treated as equal to ground spacing. Unsupported cross-neighbors retain NaN.
- **Roughness:** population standard deviation of native heights inside a physical circular neighborhood, configurable from 1 to 250 m radius. At least three samples and complete in-bounds valid support are required. A tiny radius can yield unknown support. Roughness includes broad terrain grade and does not identify rock-scale irregularity.
- **Relief and shape:** neighborhood maximum minus minimum, and center minus neighborhood mean. The latter is a coarse local shape indicator, not curvature or obstacle detection.
- **Directional movement:** exact source-sphere horizontal baseline and DT5 height change give uphill/downhill grade. Model statistics retain edge grade separately from local two-axis gradient.
- **Classification:** UNKNOWN, TRAVERSABLE, HIGH_COST or BLOCKED. Any known gradient or roughness breach blocks the cell even when other metrics are unsupported. Edge grade limits remain directional. High cost marks a configured fraction of the limits, not a observed safety threshold.

The default hypothetical profile uses uphill 12°, downhill 18°, roughness 12 m, neighborhood radius 100 m, high-cost fraction 0.7, and uphill/downhill/gradient/roughness weights 4/2/2/3. Every numeric assumption is editable. NoData/nonfinite heights are always excluded. Incomplete derivative support is blocked by default; an explicit permissive policy assigns distance times the configured unknown multiplier (default 10), while retaining null route terrain statistics. Any known hard restriction remains enforced.

Step-height restrictions, boulder/rock/sand detection, terrain hazards, physical energy and travel-time predictions are unsupported and are not implemented or fabricated.

## Search, geometry and comparison

Supported edge cost is:

```text
C = d × (1
  + uphillWeight × max(0, gradeDeg) / maxUphillDeg
  + downhillWeight × max(0, -gradeDeg) / maxDownhillDeg
  + slopeWeight × maxEndpointGradient / max(maxUphillDeg, maxDownhillDeg)
  + roughnessWeight × maxEndpointRoughness / maxRoughnessM)
```

`d` is horizontal source-sphere distance. Costs are nonnegative and at least distance; their unit is **cost-equivalent metres**, a hypothetical preference score. A contracted source-sphere arc is an admissible lower bound. The existing A* kernel optimizes either distance or accumulated model cost on the same permitted eight-neighbor graph. Diagonals require both flank cells and their directional movements to be admitted. An optional waypoint concatenates two independently optimized legs and may revisit cells.

The renderer preserves every returned native center and rejects jumps or restricted edges. HRSC endpoints are the containing native HRSC centers selected from the original CTX endpoint coordinates. That snap is disclosed and does not establish empirical imagery/DEM co-registration. No named feature becomes a precise route endpoint.

The real-data browser case, CTX endpoints row/column (662, 598) to (762, 698), produced:

| Objective, default profile | Horizontal length | Model cost |
| --- | ---: | ---: |
| Shortest permitted distance | 2,756.46 m | 5,215.76 cost-m |
| Lower terrain cost | 3,013.08 m | 5,035.38 cost-m |

The terrain-cost route is about 256.63 m longer and 180.38 cost-m cheaper in this particular hypothetical model. Its geometry differs because it optimizes real DEM-derived penalties. No deviations or artificial obstacles are inserted. This comparison is not a claim of physical mission efficiency or safety.

## UI and report

Plan retains original grid selection, map picking, swapping, clearing, waypoint and CTX distance-route interactions. A contextual HRSC section adds load/retry, applied rover assumptions, source-relative elevation, gradient, roughness, shape, model classification and actual expanded-cell overlays with numeric legends. Alternative paths use distinct line patterns and preserve exact vertices. Source credit stays visible on the map and in details.

Route results show horizontal length, accumulated cost, maximum/mean local gradient, maximum/mean absolute movement grade, roughness, visits, expanded cells, full-grid blocked/unknown counts and unknown-support segments. **Blocked search cells** is not a fabricated count of proven obstacles avoided. The worker is cancelled on changed inputs, accepts only validated numerical arrays and adjacent paths, and rejects added safety claims. The original **Show paths on map** and new **Show terrain on map** explicitly restore their respective display models.

Exported JSON retains exact nodes/points, assumptions, full provider contract, source URL, licence, native encoding/NoData, checksum scopes, null dates/version, mathematical formula, unresolved scientific limits and references to unchanged historical audits. Computed routes remain qualified. Synthetic fixtures are restricted to automated tests; no synthetic terrain is shown in the application.

## Verification and visual acceptance

Final verification: `npm run lint` and `npm run typecheck` passed; `npm test` passed **762 tests across 55 files**; `npm run build` passed. The production build retains the pre-existing large-chunk advisory. No dependency or lockfile changed. **18 isolated Chromium acceptance groups passed**, with no page exceptions, 50 successful NASA tile responses and all 9 model workers terminated. The only console error was the intentionally injected HTTP 503. Commands and results are retained in `evidence/terrain-model/verification.json`.

`node scripts/prepare-hrsc-model.mjs --verify-saved` verified all three pinned HRSC assets and the unchanged CTX grid. `node docs/evidence/terrain-model/verify-preservation.mjs` verified **644 baseline files byte-for-byte** against checkpoint `7143d2c`, covering existing source/terrain/routing/globe modules and historical scientific evidence. The independent `verify-provenance.mjs --verify-saved` compared every CTX cell with its original TIFF and found **zero differing float32 bytes**.

The [isolated Chromium replay](evidence/terrain-model/browser/acceptance.mjs) uses a fresh browser/context, without personal browser state or security bypasses. Its [results](evidence/terrain-model/browser/results.json) record actual NASA tiles, source loading, model routes, failures and screenshots. The first attempt stopped on a test-only misspelling of the close-button accessible name; `attempt-1-results.json` preserves that outcome. The corrected replay passed. The only expected console error is the intentionally injected HTTP 503. No page exception occurred; all model workers terminated.

Manual acceptance checklist, exercised in the isolated browser and inspected in screenshots:

- [x] Desktop: spacious map, contextual route controls, actual paths and source attribution.
- [x] Tablet: one drawer, usable inputs and overlays, no horizontal overflow.
- [x] Mobile: scrollable bottom sheet, readable aligned controls, visible scientific status and source credit.
- [x] Existing globe/map controls and all CTX mission selections remain functional.
- [x] HRSC load, failed delivery and retry; source metadata/sample/mask verification.
- [x] Profile changes invalidate results; invalid values are rejected and original results are not relabelled.
- [x] Real longer-but-cheaper route, all overlays, alternative selection and exact exported vertices.
- [x] Optional waypoint result survives rerenders; cancelled/stale/failed workers do not display results.
- [x] Unknown boundary support blocks by default; explicit unknown policy preserves null statistics.
- [x] Keyboard focus, named controls, scientific drawer and responsive field alignment.
- [x] Original distance routes and qualified HRSC routes can each be restored.
- [x] CTX vertical/registration and physical-terrain scientific statuses remain unverified.

## Files and remaining scientific work

New terrain modules: `modelTypes`, `terrainModel`, `hrscModel`, `loadHrscModel` and tests; checksum-pinned `public/data/hrsc-terrain-model.*`; reproducible `scripts/prepare-hrsc-model.mjs`.

New route modules: `terrainRoutes`, `terrainRouteTask`, `terrainRouteWorker`, `useTerrainRouting`, `terrainModelReport` and tests. New map/UI modules: `terrainModelOverlay`, `TerrainRoutePlanner` and tests. Scoped integration changes: App, MarsExplorer, createMarsMap/tests, MissionStatusBar/tests, contextual scientific copy, styles, README and asset attributes. No core CTX scientific calculation or gate changed.

This implements actual DEM-based **qualified model** analysis and optimization. It does not complete independent physical validation. The final CTX height equation, independent absolute feature registration, local DEM uncertainty/stereo support, calibrated rover behavior and human safety remain unresolved. Higher-resolution and validated obstacle data would be required for rover-scale step/hazard constraints. Subsequent scientific work must establish those prerequisites rather than promote this model to a safety system.
