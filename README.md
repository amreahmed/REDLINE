# REDLINE

REDLINE is an independent Mars exploration and hypothetical surface-route planning prototype. **One explorer viewport begins with NASA's visual 3D Mars overview, then uses zoom to enter real Mars Trek MOLA context and reveal Jezero CTX detail.** The handoff is explicitly guided: the model's geographic orientation is unvalidated, so no globe surface coordinate is transferred. All six unified explorer browser acceptance checks passed according to the user's manual report. No terrain measurements or routing are implemented.

## Setup and run

Use Node.js **20.19+ in the 20.x line, or 22.12+**, with npm. This milestone was developed with Node 26.3.1 and npm 11.16.0. Keep the supplied npm lockfile; no other package manager is required.

```powershell
npm ci
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The server binds to loopback and reports an error if its port is occupied. Choose another port with `npm run dev -- --port 5174` if needed. No credentials or environment variables are required.

## Checks and production preview

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

The production build is written to `dist/`. Open [http://127.0.0.1:4173](http://127.0.0.1:4173) for the local preview. Use Ctrl+C to stop either server.

ESLint treats warnings as failures. Type checking covers the application, tests, and Vite configuration. Vitest exercises saved real capabilities XML, matrix/axis/coverage validation, the configured OpenLayers tile URL, and request/error/timeout/cancellation behavior. An XML DOM package is used only by tests. Tests do not fetch live data. No browser test runner is configured.

### Unified Mars explorer

The app opens on NASA's official textured overview. Drag to rotate and scroll/pinch to approach the globe, or use the same directional and zoom controls throughout exploration. Zooming in crosses a view-distance threshold and fades into the real map in the same viewport. The sidebar and source panel remain in place; there are no top-level globe/map tabs. With focus in the viewport, arrows rotate or pan, + / − zoom, and Home resets the overview or centers Jezero detail. There is no automatic rotation.

**The initial zoom handoff enters Jezero context, regardless of the visible globe hemisphere.** Later handoffs resume the existing map center at a context zoom or closer. The explicit Jezero action always selects that documented map area. This is a navigation policy, not a surface-target picker or geographically registered fly-to. [Mesh/UV investigation and calibration requirements](docs/globe-alignment.md) explain why no surface pin or geographic transform is introduced.

MOLA provides wider map context within its service bounds. Selected CTX appears only at local detail zoom and within its real Jezero coverage; panning outside leaves selected MOLA visible if available. Neither a disabled layer nor an unavailable service is silently replaced. Zooming out far enough returns to the overview when the model is ready. Different entry/rearm thresholds and a 360 ms input-locked fade prevent immediate switching back; reduced motion removes the fade. A failed globe leaves the real map available via **Explore map context**.

Both renderers are retained within one viewport to preserve map choices and avoid reloading the model on each handoff. Only the active renderer receives input; tile layers stop rendering after the overview return settles. Resources are disposed on unmount/retry. The GLB loader still reports received bytes, validates the container, prepares embedded textures, and exposes timeout/error/retry states.

The model is credited to **NASA/JPL-Caltech**, used under [NASA's published media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/). [Source documentation](docs/globe-source.md) records the official URL, actual HTTP/CORS results, embedded textures, attribution and limits. The model streams directly from NASA; no model or texture copy is bundled. Display lighting and mesh units are not scientific measurements.

**Browser acceptance: PASS, based on the user's report of all six checks.** The [unified explorer verification record](docs/unified-explorer-verification.md) separates these manual results from automated checks. Browser automation remains blocked and was not bypassed; no agent-observed browser run is claimed. The passed display workflow does not establish geographic alignment. WebGL 2 is required only for the globe. The [earlier separate-view record](docs/globe-verification.md) is preserved as history.

### Phase 2 browser acceptance checklist (checkpoint `9a66249`)

1. Open the app and wait for real Jezero CTX imagery. Check the Network panel for the two NASA capabilities and successful tile requests; inspect the console for fatal errors.
2. Hide CTX to reveal MOLA color hillshade, then toggle MOLA. With both hidden, the map must explain that no layers are selected.
3. Drag and zoom the map; focus it and test arrow-key panning and + / − zoom. Use Reset view to return to the documented CTX extent. Verify controls and attribution remain visible while the map is focused.
4. Leave only CTX visible and pan outside its footprint. Confirm an outside-coverage message and no fabricated imagery. The code's actual configured URL is tested against the independently probed level 9 / row 203 / column 732 tile.
5. In browser developer tools, block the NASA tile origin or switch offline, then use Retry. Verify failure messages, readable source details, and recovery after restoring access. Also test MOLA unavailable while CTX is outside coverage. A browser network/CORS error must not be called a confirmed 404.
6. Test panel visibility, About/Escape, keyboard focus, and desktop/tablet/phone layouts. Repeat the map journey against the production preview where possible.

### Verification status — 25 October 2026

Lint, typecheck, tests, and the production build were rerun successfully on 25 October 2026 immediately before preparing the Phase 2 checkpoint. The installation and server-start results below are retained from the earlier implementation run with Node 26.3.1 and npm 11.16.0.

| Check | Observed result |
| --- | --- |
| `npm ci` | Exit 0; 233 packages installed, 234 audited, 0 vulnerabilities. The existing ESLint 9 dependency emits an upstream deprecation warning. The first attempt hit a Windows Vite file lock; stopping the local servers resolved it. |
| `npm run lint` | Fresh checkpoint run: exit 0; no errors or warnings from ESLint. |
| `npm run typecheck` | Fresh checkpoint run: exit 0. |
| `npm test` | Fresh checkpoint run: exit 0; 32 tests passed across 5 files, 0 failures. |
| `npm run build` | Final build exit 0; 180 modules, 27.62 kB CSS and 473.72 kB JavaScript (6.64 / 144.12 kB gzip). |
| `npm run dev` | Restarted at `http://127.0.0.1:5173/`; Vite reported ready. Earlier HTTP probes returned 200 for the app and new map/controller modules. |
| `npm run preview` | Started at `http://127.0.0.1:4173/`; Vite reported the preview URL. The user's report does not separately identify a production-preview browser run. |
| Source HTTP probes | Both capabilities and sample imagery returned 200; an outside-coverage CTX tile returned 404. See the saved source evidence. |
| Phase 2 browser acceptance | **PASS — user-reported manual verification of all six checks above.** See the results below. |

### Manual browser results — 25 October 2026

The user reported: “I manually verified the Phase 2 browser acceptance checklist. All six checks passed in my browser.” Each result below records that report; none is an agent-observed browser test.

| Checklist check | Reported result |
| --- | --- |
| 1. App loads real Jezero CTX imagery; NASA capabilities/tile requests succeed; no fatal console errors | **PASS — user-reported** |
| 2. CTX and MOLA visibility controls work; MOLA is visible beneath CTX; both hidden produces the empty-layer message | **PASS — user-reported** |
| 3. Drag/zoom, keyboard navigation, reset to Jezero coverage, and visible controls/attribution while focused | **PASS — user-reported** |
| 4. CTX-only view outside its footprint shows the outside-coverage message without fabricated imagery | **PASS — user-reported** |
| 5. Network failure, retry/recovery, readable source details, mixed unavailable/outside-coverage states, and honest network/CORS errors | **PASS — user-reported** |
| 6. Panel visibility, About/Escape, keyboard focus, and desktop/tablet/phone layouts | **PASS — user-reported** |

The browser automation tool remained blocked by a saved permission or managed policy. The manual report satisfies the Phase 2 browser acceptance gate; HTTP responses and unit tests are separate evidence. No browser version, precise viewport sizes, request trace, screenshots, or separate production-preview run were supplied, so those details are not inferred. Native CTX coordinate convention and fine registration remain unverified despite the browser PASS results.

Phase 1 was verified and committed as `a8c1d27`; its earlier five shell-only PASS results are distinct from this Phase 2 report. An earlier transient missing-props HMR error occurred during interdependent edits. The final App supplies those props, and the user now reports the app/console check as PASS.

**Phase 2 acceptance: PASS**, based on the fresh automated results and the six user-reported browser checks. The checkpoint message is `feat(map): add verified Jezero Mars map workspace`; its commit hash is available in Git history. No remote push or Phase 3 work is part of this milestone.

## Implemented

- Existing React/TypeScript/Vite/Tailwind dark workspace and independent panel controls.
- OpenLayers map controller, two layer switches, zoom, pointer/keyboard navigation, and reset to Jezero's advertised mosaic extent.
- Live capabilities validation, independent requests/retry, timeouts/cancellation, coverage clipping, and explicit loading/empty/error states.
- Source links, instrument and nominal-resolution context, credits, service bounds, and request counts labeled since load/retry.
- An explicit angular service grid, with no Earth projection or scale-denominator conversion. The center readout is an image-grid position, not a validated science-target coordinate.

## Structure

```text
src/app/App.tsx                  Workspace, layer visibility, status
src/components/layout/          Mission control, sources, About
src/components/map/MarsMap.tsx   Preserved standalone map component (not mounted)
src/components/explorer/        Current single-viewport globe/map orchestration
src/components/globe/           Preserved earlier standalone components (not mounted)
src/data/marsLayers.ts           Two sourced image-layer definitions
src/data/marsGlobe.ts            Official NASA visual-asset reference
src/features/map/               Capabilities, angular grid, requests, controller, tests
src/features/globe/             Lazy Three.js viewer and validated asset download
src/features/explorer/          Transition state machine and layer presentation rules
src/styles/index.css            Existing design plus map/source styles
docs/data-sources.md             Exact service contracts and CRS qualification
docs/evidence/phase-2/           Raw metadata and HTTP probe evidence (no image assets)
```

Vite, TypeScript, and ESLint configuration remain at the repository root. The Phase 2 checklist is in `docs/superpowers/plans/2026-10-25-phase-2-mars-map.md`. The original placeholder component is preserved but is no longer mounted. The detailed specification remains in `REDLINE_AI_Agent_Project_Spec.md`; working rules remain in `AGENTS.md`.

## Data, attribution, and limitations

**Real source data, HTTP-verified:** NASA Mars Trek's `Mars_MGS_MOLA_ClrShade_merge_global_463m` and `Jezero_CTX_BlockAdj_dd` capabilities and representative image tiles. Browser rendering and interactions passed the user's manual acceptance test. See [source evidence and CRS resolution](docs/data-sources.md).

Both layers use identical inspected angular tile geometry. Trek's inconsistent `EPSG::104905` / `IAU2000::104905` labels and Earth-sized scale denominators are not passed to generic projection conversion. The app uses a custom service display grid. Precise native CTX latitude convention, fine cross-layer registration, and alignment with future targets or DEMs remain unverified. Quantitative overlays and measurements remain unavailable.

These are rendered image products, not numerical elevation. No DEM processing, slope, hazards, routing or science targets are included. The separate 3D model is visual only and is never an input to calculations. No synthetic terrain or substitute map tiles are used. Zoom enlargement does not add source detail. Browser CORS can hide missing-tile HTTP status; opaque failures are explicitly reported as network/CORS failures. A bounding box does not guarantee complete interior coverage.

Map images stream directly from NASA Mars Trek; no persistent tile cache or republished imagery is bundled. Product-specific credit is shown in the source panel and service attribution on the map. The original local wordmark, favicon, and interface icons are preserved. Dependencies and resolved versions are in `package-lock.json`. Dataset redistribution rights are not inferred from public service access.

REDLINE is not an official NASA product, is not NASA-endorsed, and is not a certified human-safety system. Re-check official challenge rules before submission-related work. Further features require separate user approval.
