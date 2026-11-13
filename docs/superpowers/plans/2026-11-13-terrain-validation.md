# Jezero numerical terrain validation implementation plan

**Goal:** Validate a real numerical Jezero DEM and expose bounded, source-derived coordinate-neighborhood inspection without enabling unvalidated routing.

**Architecture:** Preserve the current explorer and feature state. A reproducible Rasterio script verifies the downloaded USGS native float32 GeoTIFF and extracts small native-resolution windows around published reference-coordinate neighborhoods. Typed browser code loads and validates the derived JSON on demand, projects only this product's planetocentric/east-positive coordinates into its documented spherical equirectangular grid, and reports explicit valid/NoData/outside results. Sources & status reports source-value ranges rather than a precise elevation at a named feature.

**Tech Stack:** Existing React/TypeScript/Vite/Vitest; build-time Python/Rasterio/NumPy via a temporary uv environment. No new client dependency.

**Spec:** `REDLINE_AI_Agent_Project_Spec.md`, sections 6, 7, 12 and 15; `AGENTS.md`; source and registration audits in `docs/evidence/terrain-validation/`.

## Constraints and review focus

- Product `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0`, source SHA-256 `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b`.
- Native grid is 1596 columns × 1512 rows, float32, scale 1/offset 0, NoData `-3.4028226550889045e38`; geotransform `[4573663.250853,20,0,1109693.140188,0,-20]` in metres.
- Projection is equirectangular, standard parallel 0, central meridian 0, no false offsets, R=3,396,190m, planetocentric latitude/east-positive longitude. Do not generalize this formula to the other science DEM with latitude of true scale 18.4663°.
- Preserve raw evidence hashes and provider attribution. Provider-declared metre heights refer to the IAU sphere; that vertical reference is not independently validated. Filename alone does not establish an areoid correction. Document actual versus stale metadata min/max.
- Two-decimal feature centers are approximate MDIM 2.1 geometry. Neighborhood ±0.005° illustrates decimal quantization, not an accuracy bound or a precise landing/rover site. Native cell values do not validate feature-to-DEM or preliminary-image registration.
- No resampling, interpolating, slope, physical route distance, hazard, science weighting or routing in this milestone. Missing data remains missing; no zero substitution. The full TIFF stays out of the client.
- Unknown source/hash/projection, malformed data, NoData, non-finite values, outside windows and failed/aborted requests need explicit results. Test north-down rows and pixel-center/edge conventions against independently read Rasterio fixtures, not round trips alone.

## Tasks

### 1. Source and registration discovery

- [x] Save authoritative product/labels/metadata and actual HTTP receipts; verify TIFF byte hash, native sample encoding, geotransform, NoData, range access, browser CORS terms, source credit and coverage.
- [x] Record registration evidence and unresolved MDIM 2.1/preliminary-CTX and vertical-reference gates. Use provider corner/VRT checks independently of app code.

### 2. Reproducible native windows

Files: `scripts/prepare-terrain-windows.py`, `public/data/jezero-terrain-windows.json`, `docs/evidence/terrain-validation/raster-inspection.json`.

- [x] Verify source hash/contract using Rasterio; decode actual source valid/NoData counts and bounds without trusting catalog ranges.
- [x] Extract native cells intersecting ±0.005° display neighborhoods around the three existing published centers, with source row/column offsets, no resampling and explicit null NoData.
- [x] Write deterministic JSON retaining source identity/hash, projection, grid, height qualification, native windows and independent selected-cell fixtures. Confirm reference windows lie within numeric support; preserve edge/outside tests.

### 3. Typed validation and sampling

Files: `src/features/terrain/types.ts`, `sampling.ts`, `sampling.test.ts`, `loadTerrain.ts`, `loadTerrain.test.ts`.

Interfaces: `parseTerrainWindows(input: unknown): TerrainWindows`; `sampleTerrain(windows, coordinate): TerrainSample` discriminated by valid/nodata/outside/invalid; `summarizeWindow(window): {validCount,missingCount,min,max}`; `loadTerrainWindows(signal?: AbortSignal): Promise<TerrainWindows>`.

- [x] Tests pin actual Rasterio samples and provider native corner/pixel centers, longitude conventions, invalid inputs, bounds, NoData propagation, malformed contracts and failed/aborted/timed-out loading.
- [x] Implement only the audited projection and cell/window contract. Validate downloaded JSON before using values; retain native float32 values and provenance.

### 4. Working source inspection

Files: `src/components/mission/TerrainInspection.tsx`, `src/components/layout/InformationPanel.tsx`, `src/styles/index.css`.

- [x] Add on-demand Load numerical terrain / Retry controls with loading, valid, missing/error states; cancel stale/unmounted requests.
- [x] Show selected coordinate-neighborhood native valid-cell count and rounded source range, exact dataset/source/attribution, 20m grid spacing and vertical/registration limits. Do not display a precise height at a feature center or imply this is a map layer.
- [x] Retain existing route-disabled reason and imagery panels; adjust source footer wording to distinguish map imagery from the numerical inspection.
- [x] Smoke-test in the isolated in-app browser, including selected-reference changes, load/retry/error, panel hide/show, keyboard and 320px layout; production preview uses actual data asset.

### 5. Verify and checkpoint

- [x] Independent review resolves actionable data, sampling, UI and claim defects.
- [x] Update README and `docs/terrain-validation.md` with exact commands, browser results, evidence, limitations and next registration/terrain-cost milestone.
- [x] Run lint, typecheck, tests and production build; review diffs, source hashes and Git state; commit only this verified milestone. No push.

## Execution

The user explicitly asked to start this next phase and previously requested autonomous verification. Root coordinates source/registration audits and focused implementation agents, then verifies browser behavior and the final diff before the local checkpoint. No extra plan approval is required within this scope.
