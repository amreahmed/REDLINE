# Global geographic Mars explorer implementation plan

> For agentic workers: use this session's native collaboration tools for independent source, POI and renderer tasks, with root integration and whole-change verification. The user explicitly requested a concise plan followed by implementation.

**Goal:** A real tiled Mars imagery globe, space environment, sourced interactive POIs and coordinate-preserving regional exploration.

**Architecture:** Retain the current NASA GLB controller as a separate qualified visual-model option. A new geographic sphere implements its navigation controller contract and adds explicit planetocentric/east-positive coordinate, imagery and POI APIs. Both share the existing explorer surface and only one globe controller is mounted at a time; OpenLayers and terrain/routing stay intact.

**Tech stack:** Existing React, TypeScript, Three.js, OrbitControls, OpenLayers, Vite and Vitest. No new app dependency.

**Spec:** User's NASA-Based Global CTX Mars Globe, Space Environment & Interactive POIs request, attached at `C:/Users/LOQ/.codex/attachments/70aae5e7-28ce-4da0-9abf-3ecc08c35ae4/Pasted text.txt`.

## Global constraints

- Preserve all 65,536 terrain cells, coordinate/DEM processing, costs, A*, gates and historical scientific reports.
- Imagery, synthetic visual stars/lighting/atmosphere and the unit graphics sphere are not terrain measurements.
- The live CTX candidate is an uncontrolled beta product; do not claim V01 coverage or absolute registration for it.
- Respect each verified tile contract, including global 512 px versus regional 256 px tiles.
- Retain NASA/USGS/Caltech provenance, gaps, preliminary/controlled distinctions and explicit failure/retry states.
- No personal browser, security bypass, remote push or unrelated redesign.

## Design

Keep space `#080d13`, panel `#101923`, ink `#edf3f6`, muted `#a9bac6`, Mars accent `#ed956c` and interaction cyan `#83d7df`. Existing Segoe UI/Bahnschrift typography and contextual drawers remain. The verified current Mars Trek Viking color mosaic is the default, with global CTX grayscale imagery available separately; lighting and a restrained buffered star field provide depth without inventing surface color or telemetry.

Explore hosts location search, POI category filters and sourced results. Layers hosts a compact globe basemap selector; the viewport shows active source/loading/coverage and hovered POI. Sources hosts selected POI details and full layer qualifications. The viewport remains primary.

## Review focus

- Dateline/poles: continuous angular geometry, correct north/east, no opposite-hemisphere markers.
- Rapid zoom/layer changes: bounded requests, canceled obsolete work, no stale dataset presented as active.
- Partial/transparent tiles: preserve masks and report missing coverage; no substitute observations.
- GLB fallback: no geographic POI or calibrated handoff claims from the old unregistered asset.
- Handoff/return during loading: preserve coordinates and explicit selected source, with honest unavailable states and existing mission interactions.

## Task 1: Verified source and POI contracts

Files: create `src/data/globeLayers.ts`, `src/data/marsPois.ts`, associated tests and `docs/evidence/global-globe/{sources,pois}`.

Interfaces: `GlobeImageryLayer` contains exact `TileContract`, coverage, source, registration and resolution metadata. `MarsPoi` carries coordinates, convention/accuracy/confidence, references and only supported optional fields.

- [x] Retrieve current WMTS/ArcGIS/Caltech/PDS documentation and actual tile responses; preserve timestamps, formats, CORS, matrices and failure receipts.
- [x] Build registry only from inspected contracts; include MOLA, controlled/regional CTX and HiRISE imagery only when verified.
- [x] Verify authoritative mission/landmark coordinates; exclude ambiguous, outdated or unsupported records.
- [x] Test registry matrices, source identity and qualified POI records. No existing scientific source changes.

## Task 2: Geographic renderer and streaming LOD

Files: create `src/features/globe/geographicMath.ts`, `globeTileLod.ts`, `createGeographicMarsGlobe.ts` and focused tests.

Interfaces: `createGeographicMarsGlobe(host,onStatus,onDistance?,options)` extends `GlobeController` with layer/POI setters, `flyTo`, `getView`, `setGeographicView`, imagery retry and view/POI callbacks. Unit mapping: longitude 0 at +Z, 90°E at +X, north at +Y.

- [x] Test cardinal/polar/reference positions, wrapping and front-side visibility against fixed independent expected vectors.
- [x] Implement tile geometry and screen/visible-region LOD driven by actual contract, not a stretched overview raster.
- [x] Bound requests/cache, deduplicate, cancel obsolete work, retain same-source parents through refinement and dispose resources.
- [x] Test missing coverage/failures, stale tile cancellation, cache eviction and lifecycle.
- [x] Implement buffered stars, directional lighting, visual atmosphere, POI picking/hover and actual-coordinate camera flights.

## Task 3: Existing explorer integration and geographic map bridge

Files: modify `App.tsx`, `MarsExplorer.tsx`, `MissionControl.tsx`, `InformationPanel.tsx`, add focused globe UI and a map imagery bridge; add only display-level methods to `createMarsMap.ts`.

Interfaces: app stores globe layer/mode, selected POI/category, camera summary and fly/handoff requests. A coordinate bridge uses `[longitude,latitude]` degrees in the existing Trek display grid, preserving selected dataset where available. The old controller and existing planning crop workflow remain.

- [x] Implement real layer selection, search, filters, info and Fly To controls with keyboard/mobile access.
- [x] Connect the new globe without rerendering React per animation frame; preserve old GLB mode explicitly.
- [x] Transfer geographic view into the regional map and back; test arbitrary supported coordinates and Jezero.
- [x] Preserve current grid picking, controlled CTX, route rendering and source panels; scientific status remains qualified.

## Task 4: Verification and checkpoint

Files: new `docs/global-globe-verification.md`, browser replay/screenshots under `docs/evidence/global-globe/browser`, README.

- [x] Run lint, typecheck, complete tests and production build; resolve failures.
- [x] Check protected numerical/routing files and source/grid hashes against the prior checkpoint.
- [x] Verify real globe imagery, LOD, layer continuity, POIs, coordinate handoff, failures, cleanup and responsive/keyboard behavior in isolated Chromium.
- [x] Inspect screenshots and report actual performance/resource/request observations, datasets unavailable and remaining scientific limitations.
- [x] Review the full diff, stage only milestone files and create a verified checkpoint commit. Do not push.
