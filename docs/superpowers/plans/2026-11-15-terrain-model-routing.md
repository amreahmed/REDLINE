# Qualified DEM Terrain Model Implementation Plan

> **For agentic workers:** Execute the scoped tasks with the current collaboration tools; preserve the existing CTX implementation and review the integrated diff.

**Goal:** Add actual, native HRSC DEM analysis and hypothetical terrain-cost A* comparison without unlocking unsupported CTX physical-terrain routing.

**Architecture:** Keep the exact 256 × 256 CTX pipeline, distance planner and scientific gates intact. A separately pinned 103 × 103 HRSC DT5 contract supplies sphere-relative DEM metrics to a pure analysis module and a weighted graph using the existing tested A* kernel. Separate worker, UI, overlay and report contracts retain model qualifications.

**Tech Stack:** React, TypeScript, Vite, OpenLayers, existing Vitest and isolated Playwright Chromium; no new dependencies.

**Spec:** User attachment `C:/Users/LOQ/.codex/attachments/5b99dd10-a397-4407-bf5d-fd8205d4c890/Pasted text.txt`.

## Global Constraints

- Preserve all 65,536 CTX cells, checksums, source definitions, existing interactions and historical evidence.
- Do not bypass existing scientific gates. Physical slopes, costs, named-feature routing and safety remain unverified.
- Native HRSC provider DEM gradients are separate qualified model outputs, not independent physical accuracy evidence.
- No synthetic terrain in the application, fake obstacles, artificial route bends, new dependencies or remote push.
- Every route retains every returned cell. NoData is excluded; incomplete metric support follows an explicit conservative-default policy.
- Use isolated Chromium; retain the user's existing development servers and personal browser state.

## Review Focus

- Incorrectly labelled provider source must fail closed; pin source, raster, mask, projection and vertical definition.
- Stale worker output after profile/endpoints/source changes must be cancelled and hidden.
- Projected east-west spacing differs from ground spacing; use the dataset radius and sphere distances.
- Unknown boundaries and diagonal flanks must never quietly become low-cost connections.
- Route qualifications, provenance and exact geometry must survive selection, overlays and exports.

### Task 1: Separate native source contract

**Files:** `src/features/terrain/hrscModel.ts`, `loadHrscModel.ts`, corresponding tests; `public/data/hrsc-terrain-model.*`; `scripts/prepare-hrsc-model.mjs`; new source-authorization evidence.

**Interfaces:** `loadHrscModel(options?: {signal?: AbortSignal}): Promise<TerrainModelGrid>`; source-specific validation pins actual native int16 DT5 samples and validity bytes.

- [ ] Verify saved reader/projection/sample evidence and document allowed model scope.
- [ ] Reproduce the subset without resampling and reject modified hashes/masks/contracts in tests.
- [ ] Confirm original CTX bytes and gates remain unchanged.

### Task 2: Metric and movement model

**Files:** `src/features/terrain/modelTypes.ts`, `terrainModel.ts`, `terrainModel.test.ts`.

**Interfaces:** `analyzeTerrainModel(grid, profile): TerrainAnalysis`; `modelPoint`, `modelNodeForCoordinate`, `modelDistance`; `terrainMovement(analysis, from, to): TerrainMovement`.

- [ ] Test flat/analytical slopes, directional grades, physically sized circular roughness, grid edges and NoData.
- [ ] Derive central gradient, height standard deviation, relief, and center-minus-local-mean shape indicator. Retain NaN for unsupported metrics.
- [ ] Validate configurable up/down grade, roughness, high-cost and penalty assumptions; exclude hard limits and conservative diagonal flanks.
- [ ] Disclose roughness includes broad grade, shape is not curvature, and step-height/obstacle detection is unsupported.

### Task 3: Terrain-cost graph and search

**Files:** `src/features/routing/terrainRoutes.ts`, `terrainRoutes.test.ts`.

**Interfaces:** `calculateTerrainComparison(analysis, origin, destination, waypoint?): TerrainComparisonResult` returns distance and terrain routes on the same traversability graph, with exact nodes/points and separate distance/cost statistics.

- [ ] Test a wall/opening, disconnected goal, longer cheaper route, directional restrictions, unknown policy and diagonal corner cutting.
- [ ] Compare A* with an independent linear-scan Dijkstra oracle under actual model costs.
- [ ] Reuse the existing search kernel; collect actual expanded nodes. Use contracted sphere arc heuristic because every admissible edge cost is at least distance.
- [ ] Report blocked search cells rather than inventing a count of obstacles avoided.

### Task 4: Worker, mission UI, overlays and report

**Files:** separate terrain worker/task/hook; `TerrainRoutePlanner.tsx`; new `terrainModelOverlay.ts`; scoped additions to `App.tsx`, `MarsExplorer.tsx`, `createMarsMap.ts`, styles and tests.

- [ ] Load only the documented HRSC subset; map the existing hypothetical endpoints to containing HRSC native centers with a visible snap qualification.
- [ ] Run analysis/search off the main thread, validate returned arrays/paths/metrics, cancel stale requests and expose loading/error/retry states.
- [ ] Offer elevation, gradient, roughness, model classification and expanded-cell overlays with legends and exact routes; keep attribution visible.
- [ ] Display separate horizontal distance, cost-equivalent metres, model grades, roughness, profile, source and scientific limits. Export full JSON evidence without modifying historical reports.
- [ ] Test route geometry, raster alignment, stale/faulty worker responses, scientific labels and responsive controls.

### Task 5: Integrated acceptance and checkpoint

**Files:** README and new `docs/terrain-model-routing.md`, new evidence directory.

- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and inspect actual results.
- [ ] Isolated Chromium: desktop/tablet/mobile; real source loading; endpoints; profile changes; comparison; overlay switching; exact route; keyboard; failures/retries; export; preserved globe/map behavior.
- [ ] Review the diff, verify CTX hashes and raw evidence bytes, stage only milestone files and create a local checkpoint commit. Do not push.

UI direction: retain the existing dark Mars identity and readable type. Left-aligned profile fields and one comparison group fit the current contextual plan drawer; map remains the primary surface. Use restrained cyan for distance paths and warm amber for terrain paths, with patterns/text distinguishing them independently of color. Avoid new permanent panels.
