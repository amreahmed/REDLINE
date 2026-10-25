# REDLINE Phase 2 Mars Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Those executor packages are absent. The user has authorized direct implementation; use native tools and independent research/review agents without another planning approval gate.

**Goal:** Replace the placeholder with two verified Mars Trek image layers in a working OpenLayers regional map.

**Architecture:** Keep React display state and the existing layout. A typed dataset registry carries provenance; a strict WMTS parser validates the live contract; an isolated OpenLayers controller owns image requests, viewport navigation, and layer status. An explicit angular Mars display grid avoids Earth projection defaults and inconsistent provider scale denominators.

**Tech Stack:** Existing React/TypeScript/Vite/Tailwind/npm; OpenLayers; Vitest and an XML DOM implementation for actual capabilities-fixture tests.

**Spec:** `REDLINE_AI_Agent_Project_Spec.md`, narrowed by the user's Phase 2 request.

## Global Constraints

- Do not implement routing, DEM processing, slope calculations, hazard scoring, or a globe.
- Rendered hillshade and imagery are display products, never numerical elevation.
- Preserve existing files and unrelated changes; no remote push.
- No claims of browser rendering based only on HTTP success.
- Stop after Phase 2; no Phase 3 work.

## Prerequisite evidence

Phase 1 is committed as `a8c1d27`; the working tree was clean. Fresh lint, typecheck, and production build exited 0. The user reported manual PASS for layout, button/dialog interactions, keyboard navigation, console, and responsiveness. No additional browser checks are inferred.

## Design review

Retain space `#0B0F14`, panel `#121922`, elevated `#18222D`, text `#F2F5F7`, rust `#E06B45`, and cyan `#58C7D8`. Keep Segoe UI/system sans-serif, existing panel radii, and left-aligned labels. Spend visual emphasis on actual imagery; keep controls quiet. Replace the placeholder copy with a compact map toolbar; convert empty information to source metadata. Never add invented telemetry or illustrative terrain.

```text
REDLINE / Mars mission workspace                       About
Workspace / Jezero                        Panel visibility
Layer switches | Regional image map       | Sources & status
Coverage notes | Zoom / reset / keyboard  | Credits / limits
Planning limit | Display position         | Service metadata
```

## Review Focus

- Inconsistent CRS authority strings and scale denominators: derive degrees/pixel from validated matrix dimensions, not Earth unit conversions.
- Missing, malformed, or changed capabilities: fail the affected layer independently with a retry action.
- HTTP 404 without CORS versus network failure: browser failures cannot reliably distinguish these; never label an opaque failure as confirmed missing coverage.
- No visible layers or outside regional coverage: show explicit empty/coverage state, never substitute fabricated imagery.
- Toggling, resizing, retrying, and unmounting during requests: preserve visibility, abort requests, and prevent stale status updates.

### Task 1: Evidence and data contract

**Files:** `docs/evidence/phase-2/`, `docs/data-sources.md`, `src/data/marsLayers.ts`, `src/features/map/{types,capabilities,grid,requests}.ts`, corresponding `*.test.ts` files.

**Interfaces:** `readCapabilities(xml, definition, parseXml?)` returns a validated `TileContract`; the registry contains the two exact requested layer IDs and cited metadata. Request helpers return success, missing, or error explicitly. Grid helpers operate only on longitude/latitude display units.

- [x] Preserve exact current XML, selected catalog records, HTTP evidence, and projection documentation.
- [x] Resolve the display-grid contract from identical origins, extents, matrix dimensions, and image locations; explain limits of external coordinates and metrics.
- [x] Test actual XML fixtures, axis reversal, bad matrix IDs/dimensions, changed coverage, resource URLs, boundaries, 404, HTTP errors, content type, network failure, cancellation, and timeout.

### Task 2: Regional map and existing panels

**Files:** `src/features/map/createMarsMap.ts`, `src/components/map/MarsMap.tsx`, existing app/layout components and stylesheet, package/lockfile.

**Interfaces:** The map controller exposes visibility, retry, zoom, reset, and dispose operations; React receives typed layer status and view status. No scientific measurement API is introduced.

- [x] Add OpenLayers and the minimal test dependencies with npm.
- [x] Implement a custom Mars angular projection and explicit WMTS grids; clip each layer to its verified coverage and retain source attribution.
- [x] Add independent layer visibility/retry, keyboard and pointer navigation, zoom, reset to Jezero coverage, and honest loading/empty/error states. Browser acceptance is supported by the user's six manual PASS results below.
- [x] Show names, source links, nominal resolution with caveats, coverage, and no-DEM limitation in the existing panels.

### Task 3: Verification and checkpoint

**Files:** `README.md`, source documentation and this checklist.

- [x] Rerun lint, typecheck, unit tests, and production build before the checkpoint. All four commands exited 0 on 25 October 2026; 32 tests across five files passed with no failures. Final production build: 180 modules, 27.62 kB CSS and 473.72 kB JavaScript before gzip.
- [x] Verify actual app-origin requests and rendering, real CTX coverage, MOLA toggling, navigation, empty layers, missing tiles, and network failure in the browser. All six README checks passed according to the user's manual report on 25 October 2026. Browser automation remained denied; no agent browser run is claimed.
- [x] Record actual evidence and limits; review tracked diff, new files, and Git status. Source review fixes cover focus-overlay ordering and combined unavailable/outside-coverage states; the manual report covers those interactions.
- [x] Satisfy the Phase 2 checkpoint gate with fresh automated results and all six user-reported browser PASS results. Use `feat(map): add verified Jezero Mars map workspace` for the separate checkpoint; Git history records its hash. Do not push.

## Handoff state

Phase 2 acceptance passed: the user reported all six manual browser checks PASS, and fresh lint, typecheck, tests, and production build all exited 0. Browser automation is still unavailable; the browser report is manual evidence, not agent observation. Development and production-preview servers previously started on loopback ports 5173 and 4173. A separate production-preview browser run was not explicitly identified in the report. A transient HMR error during earlier edits is retained as historical context; the final App supplies the required props and the user now reports the app/console check PASS.

## Manual acceptance evidence — 25 October 2026

User statement: “I manually verified the Phase 2 browser acceptance checklist. All six checks passed in my browser.”

- [x] **PASS (user-reported):** Real Jezero CTX imagery, NASA capabilities/tile requests, app startup, and no fatal console errors.
- [x] **PASS (user-reported):** CTX/MOLA toggles, MOLA visibility, and the both-hidden empty state.
- [x] **PASS (user-reported):** Pointer/keyboard pan and zoom, reset to Jezero coverage, and controls/attribution visibility while focused.
- [x] **PASS (user-reported):** CTX-only out-of-coverage behavior without invented imagery.
- [x] **PASS (user-reported):** Network failures, retry/recovery, readable source details, mixed unavailable/outside coverage, and network/CORS classification.
- [x] **PASS (user-reported):** Panel visibility, About/Escape, focus, and desktop/tablet/phone layouts.

No raw browser trace, browser version, exact viewport sizes, or separate production-preview run were supplied. The manual report does not validate native CTX coordinates or fine registration; the scientific limitations in `docs/data-sources.md` remain in effect. No Phase 3 work is authorized in this checkpoint.
