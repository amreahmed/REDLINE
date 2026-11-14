# Distance-only hypothetical routing — 14 November 2026

This checkpoint implements the deadline delivery's first routing milestone. Further scientific investigation is closed for this delivery with documented limitations; scientific verification is not reclassified as complete. Named-feature registration and the exact CTX height-reference equation/model/version/sign remain unresolved. The app retains **Scientific validation: Partial**, and height-dependent slopes, terrain costs, hazards and safety outputs remain unavailable.

## Implemented behavior and model

- Plan retains native row/column, map and keyboard endpoint selection, swap/clear, the entire 256 × 256 crop, and all existing mission/reference interactions.
- A dedicated module worker finds a shortest hypothetical eight-neighbor grid path. An optional user-selected waypoint adds the shortest origin-to-waypoint and waypoint-to-destination legs for a distance comparison. Both waypoint legs must succeed; no shortest-only fallback conceals a failed waypoint.
- Each edge costs the existing shortest-arc distance between native source cell centers on the **3,396,190 m Mars reference sphere**. A* uses a sphere-arc lower bound contracted by `1 - 1e-9` for conservative floating-point rounding, a deterministic heap, and node reopening. No source height enters edge costs or the heuristic.
- Missing/nonfinite/NoData cells are excluded. Diagonal connections require both flank cells. These are coverage rules; valid numerical coverage does not demonstrate traversability or stereo support. Connectivity is a simulation assumption.
- Worker results must preserve source/grid provenance, native coordinates, adjacent edges, valid diagonal flanks and requested controls. The client independently sums accepted edge lengths, with a maximum tolerance of `max(1e-6 m, length × 1e-10)` for ordinary accumulation differences. Waypoint routes cannot be shorter than the returned shortest route beyond that numerical tolerance.
- Results bind to the loaded grid instance and control indices. Changed inputs suppress old results immediately and terminate obsolete workers. Cancel, timeout, startup, malformed-result and calculation failures produce explicit idle/error/retry states. The original terrain buffer is never transferred or detached.
- Solid cyan shortest paths, dashed amber waypoint paths and the W marker are separate OpenLayers features below existing endpoints. Selected paths are emphasized. Geometry hides with the overview or hidden controlled CTX and returns with planning context. Approximate named references stay independent of grid endpoints.
- Route lengths are computed model outputs, not recorded rover traverses or terrain-following lengths. Cell visits count path entries; a waypoint path can revisit cells. No lower-risk, safer, balanced or science-score alternative is fabricated.
- The row and column inputs now share a baseline even when one label wraps. Both native endpoint and waypoint field groups use the shared layout rule. Full labels, keyboard focus and minimum 44 px input height are preserved.

## Source preservation

No numerical asset, DEM processing, coordinate transformation, scientific calculation, globe engine or image service contract was changed. The existing source-frame geometry, NASA visual GLB, MOLA, preliminary CTX, controlled CTX, source attribution, coverage handling and retries are retained.

| Asset | SHA256 before and after |
| --- | --- |
| `public/data/jezero-terrain-grid.f32` | `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8` |
| `public/data/jezero-terrain-grid.json` | `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9` |

All **65,536 cells** remain at native rows 586–841 and columns 522–777. Source coordinates remain planetocentric/east-positive in the provider's spherical equirectangular geometry. The [existing source/crop audit](evidence/controlled-jezero-grid/source-registration/audit.md) supplies the detailed contract; the [scientific investigation](scientific-gate-resolution-verification.md) retains the unresolved evidence.

## Fresh automated verification

| Command | Observed result |
| --- | --- |
| `npm test` | Exit 0: **480 tests passed across 38 files**, zero failures. |
| `npm run lint` | Exit 0, zero ESLint warnings/errors. |
| `npm run typecheck` | Exit 0. |
| `npm run build` | Exit 0: 262 modules; separate 11.68 kB routing-worker bundle. |
| `git diff --check` | Exit 0. |
| `Get-FileHash` for both terrain assets | Both match the original pinned hashes above. |

The build reports a nonfatal warning about existing map/globe chunks above 500 kB. No dependency or lockfile change was introduced. Algorithm checks include independent Floyd–Warshall graph oracles, native masked-subgraph Dijkstra comparisons, node reopening, full-crop corner-to-corner routing, independently summed edge distances, boundary/NoData cases, waypoint failures and height independence. Synthetic graph/mask fixtures are tests only.

## Browser and visual acceptance

Two independent, isolated environments were used. No personal browser profile or native device controls were used.

1. Background in-app browser at `http://127.0.0.1:5173/`: real CTX imagery; the preserved adjacent-cell example returned **19 m**. The longer example used origin row 650/column 575, destination row 780/column 735 and waypoint row 740/column 600, returning **4.15 km** shortest, **4.89 km** via waypoint, and **741.4 m** additional distance. Keyboard route selection, stale-result clearing, invalid waypoint retention, exclusive sources/layers, controlled-layer hiding and restoration, and return to the loaded NASA globe were observed. The viewport override was reset and the temporary test tab closed.
2. Fresh isolated headless Chromium on the final production preview at `http://127.0.0.1:4173/`, with reduced motion: **16 acceptance groups passed**, 56 actual NASA PNG responses, zero page/console errors, and all 8 created workers terminated. Test-only worker faults exercise held responses, startup failure, malformed results, cancellation, timeout and retry without changing terrain or NASA responses. The [raw result](evidence/distance-routing/browser-results.json) and [replay script](evidence/distance-routing/browser-check.mjs) distinguish these test faults from provider observations.

A transient development hot-reload hook-order error occurred while an integration edit changed the custom hook's structure during testing. Reloading restored the page; the final production run has no page/console errors. Production results, rather than that interrupted development state, establish the final acceptance.

| Manual visual checklist | Observed result |
| --- | --- |
| Desktop, 1440 px | Paths, active route, actual distance comparison, simulation qualification and scientific status visible. |
| Tablet, 768 px | One active drawer, readable controls, aligned inputs, no horizontal overflow. |
| Mobile, 390 px; narrow mobile, 320 px | Bottom-sheet controls, persistent status/attribution, usable close/navigation actions, aligned inputs, no horizontal overflow. |
| Sidebar interactions | Plan, Sources and Layers remain exclusive; switching panels retains mission inputs and results. |
| Layer controls | Controlled CTX toggle hides contextual routes and crop without altering calculated results; planning view restores it. |
| Source details | Source metadata, coordinate disclosure, height conflict and named-feature limits remain accessible. |
| Globe and map navigation | Existing NASA globe loads; map planning opens and overview return works. Geographic globe alignment is still unvalidated. |
| Keyboard accessibility | Route selection works with Enter and visible focus; accessible pressed state changes. Existing keyboard endpoint/map controls are preserved. |
| Worker failures and retries | Startup, malformed-response and timeout messages are actionable; retry uses the real worker and cancel/input changes leave no active workers. |

Field-alignment receipts report identical input tops and 44 px heights at all four production viewport widths. [The field screenshot](evidence/distance-routing/waypoint-alignment.png) shows the wrapped-label case. [Production route evidence](evidence/distance-routing/desktop-routes.png) includes real imagery still loading at its outer edges; [the settled development view](evidence/distance-routing/desktop-final.jpg) shows the same computed routes. Loading notices and MOLA context in screenshots are not synthetic terrain.

Replay with a separately available Playwright installation; it is not an application dependency:

```powershell
npm run build
npm run preview
# In another terminal, set REDLINE_BROWSER_MODULES to that installation's node_modules if needed.
node docs/evidence/distance-routing/browser-check.mjs
```

## Files and next milestone

New routing modules hold types, A*, worker protocol, lifecycle validation and input-bound state. `RoutePlanner` adds waypoint/comparison controls; `routeOverlay` adds display geometry. App, MarsExplorer, map controller, mission status/help/source copy and the shared field styles are extended. Tests, README, this report, the plan and browser evidence document the change.

The next delivery milestone is concise citation-backed science context, followed by mission report/print export and final deployment/demo preparation. Terrain-aware routing requires a separately resolved scientific height contract; precise named-feature routing requires registration evidence. These are disclosed exclusions from this distance-only prototype, not completed scientific validations. No remote push is authorized or performed.
