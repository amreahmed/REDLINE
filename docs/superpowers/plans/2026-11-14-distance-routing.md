# Distance-only hypothetical routing implementation plan

> Execute in this session with delegated algorithm/map work and independent review. The user authorized this phase and asked for the site to be running first; the dev server is running on port 5173.

**Goal:** Compute and compare a shortest hypothetical grid path with an optional user-selected waypoint path over the preserved native cell coverage.

**Architecture:** A worker searches an eight-neighbor grid with nonnegative reference-sphere edge lengths. Cells with missing/nonfinite coverage and diagonals with missing flanks are excluded. The graph's connectivity is an explicit hypothetical assumption, not measured traversability. The existing CTX height blocker remains intact; elevations never enter costs. Map overlays display the computed native-center coordinates in the existing display projection.

**Tech stack:** Existing React/TypeScript/Vite/OpenLayers; browser Worker; no new dependencies.

**Spec:** REDLINE_AI_Agent_Project_Spec.md sections 7, 9, 12 and user-approved distance-only delivery scope.

## Constraints and review focus

- Preserve all 65,536 CTX cells, original source hashes, scientific findings, existing endpoints, layers and globe transitions.
- No physical slope/cost, safety, hazard or precise named-feature routing claims. Further scientific investigation is closed for the deadline with documented limitations.
- Current source/geometry contracts must match before searching; missing/nonfinite cells and diagonal flanks block edges.
- Cancel/stale-isolate searches on endpoint/waypoint changes, unmount and retries. Substantial search runs in a worker.
- Comparison shows actual lengths for distinct inputs; no fabricated safer/balanced/science objectives.
- Map overlays do not affect engine, coordinates or imagery; hidden imagery/map states retain data but hide contextual paths.
- Keyboard controls, readable responsive panels, honest idle/error/loading states and qualified route labels.
- Fresh algorithm/control tests, lint, typecheck, full tests, build and isolated browser acceptance before scoped local commit. Do not push.

## Tasks

- [x] Algorithm lane: create `src/features/routing/{types,distanceRoutes,routeWorker}.ts` and meaningful optimality/missing-data/contract tests. Generic synthetic graph fixtures establish shortest-path correctness independently; production adapter uses existing native geometry and distance helpers.
- [x] Map lane: create `src/features/map/routeOverlay.ts` and tests; extend `createMarsMap.ts` and `MarsExplorer.tsx` with route/waypoint overlay API. Keep routes separate from original endpoint overlays.
- [x] Root: create worker client/hook with stale-result/error/cancel handling; create accessible `RoutePlanner.tsx`, optional waypoint controls, result selection and length comparison. Integrate App and truthful route status/source/help copy.
- [x] Root/reviewer: inspect all work, retain source/data hashes, run required checks and hidden isolated browser desktop/mobile/keyboard/worker/map flows.
- [x] Document implemented versus hypothetical/unavailable behavior. Fresh checks and 16 production browser acceptance groups passed; see `docs/distance-routing-verification.md`.
- [x] Prepare the scoped local checkpoint after final staged review. Do not push.
