# Scientific registration and terrain metrics implementation plan

> **For agentic workers:** Execute task by task with independent source-audit and review lanes in this session. The user authorized implementation; proceed within these two milestones.

**Goal:** Establish evidence-based registration/height statuses and validate terrain arithmetic without enabling unsupported heights, routes or safety claims.

**Architecture:** Preserve every native cell and pinned terrain asset. A separate scientific-review registry records what source evidence establishes and what remains unresolved. Pure sphere-distance, grade and nonnegative cost helpers are tested independently; native-cell adapters re-read support and block height-dependent output unless the vertical audit authorizes it. The existing mission UI exposes endpoint separation and concise review status.

**Tech Stack:** Existing React, TypeScript, Vite, Vitest; Node audit scripts; no additional runtime dependencies.

**Spec:** `REDLINE_AI_Agent_Project_Spec.md` sections 6–7, `AGENTS.md`, user request for scientific validation and terrain calculations.

## Global constraints

- Preserve 65,536 cells, all manifest/binary checksums, grid transforms, map/globe interactions, approximate O/D and hypothetical G-O/G-D selections.
- No A*, Dijkstra, route comparison, hazard inference, datum conversion, interpolation or synthetic application terrain.
- Native projection: planetocentric/east-positive Eqc, lat_ts=lon_0=0, reference sphere radius 3,396,190 m. Do not use Earth units or projected x spacing as ground separation.
- Scientific status is evidence-specific: source geometry, named-feature registration, vertical reference and arithmetic validation must remain distinct.
- NoData, outside support, nonfinite values and invalid contracts produce unavailable results, never zero substitution.

## Review focus

- Source geometry agreement does not establish absolute landmark residuals or named-feature heights.
- Sphere horizontal metadata does not independently define band vertical datum; discrepancies block dependent calculations.
- Nonadjacent endpoint separation is geometric distance, never a traverse, terrain profile or maximum slope.
- Eight-connected edges require valid diagonal flank cells; no missing-cell corner cutting.
- Cost weights are hypothetical preferences; no negative costs, energy claims or safety thresholds.

### Task 1: Scientific evidence audit and review registry

Files: new `docs/evidence/scientific-validation/feature-registration/`, `height-reference/`, their audit reports; new `src/data/terrainScience.ts` and tests; `.gitattributes`.

- [x] Refresh authoritative exact product/feature sources with normal TLS and preserve HTTP receipts/hashes, including failures.
- [x] Independently verify corners/native centers and feature convention; distinguish covered reference coordinates from measured feature registration.
- [x] Inspect exact DEM vertical declaration against independent product documentation. Record conflicts; never infer datum from filename alone.
- [x] Implement `TERRAIN_SCIENTIFIC_REVIEW` with separate source-geometry, feature-registration and height-reference/difference status. Keep original manifest qualification unchanged.
- [x] Test review status against saved primary-source evidence and pin source identity/hash.

### Task 2: Terrain arithmetic and source-support adapters

Files: new `src/features/terrain/terrainMath.ts`, `terrainMath.test.ts`, `terrainMetrics.ts`, `terrainMetrics.test.ts`; independent calculation evidence script/results.

Interfaces: `MetricResult<T>` available/value or unavailable/reason; `marsSurfaceDistance(a: MarsCoordinate, b: MarsCoordinate)` in metres; `calculateGrade(riseM, runM)` signed degrees, absolute degrees and percent; `calculateTerrainCost(distanceM, gradeRatio, slopeWeight)` distance and slope penalty in cost-equivalent metres. `measureGridSeparation(grid, fromIndices, toIndices)` re-reads valid native cells. `inspectTerrainEdge(grid, fromIndices, toIndices, slopeWeight)` requires distinct adjacent cells, valid diagonal flanks and scientific height authorization.

- [x] Write failing tests with independent analytic constants: 1° meridian=59,274.69752330622 m; 60° latitude 90° longitude separation=2,454,542.8250814443 m; native row714 E-W step=18.968674590506335 m, N-S=20 m. Cover wrap, poles, antipodes, nonfinite/range/CRS rejection.
- [x] Verify 0°, ±45°, 100% grade synthetic fixtures, positive/invalid weights, reversal symmetry and cost bounds. Label synthetic fixtures test-only.
- [x] Implement fixed reference-sphere distance with stable unit-vector cross/dot atan2 (including near-antipodes), atan2 grade, cost `distance * (1 + slopeWeight * gradeRatio²)`; overflow becomes unavailable.
- [x] Re-read source cells and reject invalid/nonneighbor/outside/NoData/flank gaps. Gate real DEM grade/cost behind the audited vertical interpretation.
- [x] Independently compare actual grid distances to a separate geodesic implementation. Do not present math fixtures as observations.

### Task 3: Truthful working UI and checkpoint

Files: `GridPlanner.tsx`, new `GridMetrics.tsx` and tests; source/status/help components, README, new `docs/scientific-metrics-verification.md`.

- [x] Show selected G-O/G-D reference-sphere separation with provenance and explicit geometric-distance meaning. Show height-dependent outputs only if evidence permits them.
- [x] Replace blanket pending status with concise separate findings and visible unresolved limitations; preserve disabled route comparison and existing interactions.
- [x] Run lint, typecheck, all automated tests, build and source-evidence verification. Inspect desktop/tablet/mobile and endpoint/status/error behavior in an isolated hidden browser.
- [x] Review scoped changes and data hashes; update docs with actual outcomes and unresolved gates. The verified state is ready for a local recovery checkpoint; do not push.

## Execution note

Source audits and independent arithmetic review run in parallel. Root integrates and verifies their evidence. If exact height-reference or landmark-control evidence is unavailable, finish the independently supported work and report those gates as unresolved; do not declare full scientific validation.
