# Next implementation milestone: controlled Jezero imagery and continuous terrain

**Goal:** Make a bounded numerical terrain grid and hypothetical grid-cell endpoints usable over deliberately selected, source-controlled Jezero imagery. This is the placement/support milestone before route comparison.

**Starting checkpoint:** `7b4137a feat(terrain): validate Jezero numerical source windows`.

**Product basis:** `REDLINE_AI_Agent_Project_Spec.md` and `AGENTS.md`. The user requested autonomous continuation and supplied updated NASA resources. The source assessment is recorded separately in `docs/challenge-resource-strategy.md`; this plan is an implementation queue, not a claim that its work is complete.

## Scope and affected areas

- Extend the current layer registry/adapters/controller and explorer presentation (`src/data/marsLayers.ts`, `src/features/map/`, `src/features/explorer/`). Preserve MOLA and preliminary CTX choices and their provenance; distinguish the newly controlled source.
- Extend build-time native processing and terrain modules (`scripts/`, `src/features/terrain/`, `public/data/`) with a continuous bounded crop and verified mask/manifest. Keep the existing inspection windows reproducible.
- Add explicit hypothetical grid endpoint selection to mission controls and map markers (`src/components/mission/`, `src/features/mission/`, `src/components/explorer/`). Named feature references remain approximate context.
- Update source/status details, route-disabled explanation, README and verification/evidence. No package migration or new dependency without a demonstrated requirement.

## Acceptance gates

### 1. Controlled imagery contract

- [ ] Recheck exact Mars Trek layer `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0`, capabilities, geographic bounds, matrix/axis geometry, maximum usable detail, tile format and CORS in the isolated browser.
- [ ] Validate the provider's native projected corner, pixel spacing and geographic transform against the independently saved labels/VRT and DEM grid. Retain the distinct image/DEM outer bounds and documented photogrammetric lineage.
- [ ] Implement the controlled layer with its own attribution, source ID and loading/error/coverage states. Explicitly explain image resampling, source resolution and bounds. No source may silently replace a failed layer.
- [ ] Verify map pixel/corner placement and displayed coverage independently. Shared lineage supports relative source placement; do not claim new absolute landmark accuracy or MDIM 2.1 registration.

### 2. Continuous native support

- [ ] Select a bounded demonstration area inside the verified numerical product after inspecting actual support. It must contain a connected, valid terrain region suitable for later alternative routes.
- [ ] Extract native float32 elevations/mask with deterministic bytes, pinned source/derived hashes, origin/dimensions and metadata. Measure payload/build impact before choosing an encoding; avoid importing the full TIFF into JavaScript.
- [ ] Verify every extracted cell independently, test NoData/outside/edge cases, and make unavailable support visible. No interpolation or silent nearest-valid snapping.
- [ ] Document provider-declared sphere heights and unresolved vertical-reference interpretation; no mixed-datum calculation.

### 3. Endpoint fitness and user journey

- [ ] Let the user choose two distinct **hypothetical valid grid cells**. Display selected coordinates, source row/column, coverage and snapping/precision policy. Reject unavailable support explicitly.
- [ ] Keep Jezero/Belva/Neretva reference centers separate from precise grid endpoint identity. Choosing a named reference must not silently certify its location or snap it into a traversable source pixel.
- [ ] Clear/swap and keyboard selection must work. Source changes, panel changes and retries must preserve state or explicitly invalidate incompatible endpoints.
- [ ] Update route-disabled text to the actual remaining gates: physical metric/cost validation and route computation. No invented route line, slope, hazard or safety score.

### 4. Verify and checkpoint

- [ ] Run source/evidence verification and independent contract/registration review.
- [ ] Run lint, typecheck, relevant tests and production build.
- [ ] Smoke-test imagery, valid/outside/missing support, endpoint changes, retry, keyboard and 320 px layout in a background isolated in-app browser; verify production preview and save evidence.
- [ ] Review staged diff/hashes, update README and handoff, and make a local milestone commit. No push/deploy/submission without the user's applicable authorization.

## Following milestones

1. **Physical metrics and route comparison:** calculate Mars sphere distances between native cell centers (including latitude distortion), slope from valid height differences, and explicit missing-support rules. Validate independent fixtures. Implement A* or Dijkstra with nonnegative documented costs; compare shortest and lower terrain cost, then a transparent balanced preference if supported. Scores remain model outputs with limits.
2. **Science context and mission report:** add a small number of citation-backed Perseverance observations and geologic interpretation cards. The newly audited geology map has material registration/viewing limitations; do not use it as precise hazard or route-cost evidence. Export/print endpoints, route geometry, actual metrics, weights, product IDs, provenance and limits.
3. **Submission readiness:** verify current official challenge/rules and required formats, then finish deployment, attribution/license record and a concise live demonstration. Treat local engineering completion and competition eligibility/submission as separate evidence gates.

NASA Worldview supplies Earth imagery and can inform interface patterns. Curiosity's Mount Sharp proposed route illustrates route communication in Gale crater. Neither is an interchangeable Jezero DEM or traverse input. More resource integrations are optional until the core evidence-based planning journey works.
