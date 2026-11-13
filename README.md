# REDLINE

REDLINE is an independent Mars exploration and hypothetical surface-route planning prototype. **One explorer viewport combines NASA's visual Mars globe, real Mars Trek MOLA/CTX imagery, and three sourced Jezero-area feature references.** Search and inspect Jezero, Belva and Neretva, then assign distinct hypothetical origin/destination references. Sources & status now loads verified native numerical cells from a separate USGS CTX terrain product and shows coordinate-neighborhood ranges. Feature/imagery registration remains unverified; precise site elevations, slope and routing are unavailable.

Agent testing on 13 November 2026 used a background, isolated in-app browser for development, controlled failure tests and production preview. The current [numerical terrain verification record](docs/terrain-validation.md) separates verified source inspection from unresolved registration and routing. Earlier [feature/endpoints](docs/feature-endpoints-verification.md) and [cinematic](docs/cinematic-jezero-verification.md) records remain as checkpoint history.

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

ESLint treats warnings as failures. Type checking covers the application, tests, and Vite configuration. Vitest exercises saved real capabilities XML, matrix/axis/coverage validation, tile requests, explorer transitions, reference-coordinate validation, endpoint invariants, actual OpenLayers marker geometry and native terrain sampling/integrity checks. An XML DOM package is used only by tests. Tests do not fetch live data. No browser test runner is configured; agent browser checks are recorded separately.

### Numerical terrain inspection — current milestone

1. In **Sources & status**, choose **Load numerical terrain**. The app verifies a local 52,868-byte source-derived asset's SHA-256 and schema before using its values. It does not download the full TIFF at runtime.
2. Inspect **Jezero**, **Belva** or **Neretva**. The panel shows native valid/missing counts and an outward-rounded metre range for intersecting cells around the published coordinates (±0.005° in longitude/latitude).
3. Read the source links, credit, 20 m projected spacing, qualified vertical reference and registration limits. This neighborhood illustrates decimal coordinate precision; it is not an accuracy bound or a measurement at the named feature.
4. Failed requests or altered bytes produce a clear error and **Retry numerical terrain**. Loaded values persist across reference changes and panel hiding; a page reload resets the on-demand state.

The product is `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0`, credited to Fergason, Galuszka, Hare, Mayer, Redding and Smith (2020), USGS Astrogeology, NASA/MRO/CTX; [DOI 10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8). Its metre heights are provider-declared relative to the IAU sphere, with the vertical reference not independently validated. The three small windows do not form an endpoint-to-endpoint grid. No resampling, interpolation, slope, hazard or route scoring is applied.

The reproducible extraction is optional for development; normal setup needs only npm. With [uv](https://docs.astral.sh/uv/) installed, run:

```powershell
uv run --with rasterio --with numpy python scripts/prepare-terrain-windows.py
node docs/evidence/terrain-validation/verify-evidence.mjs
```

The script verifies the saved raw GeoTIFF, decodes its mask/grid and writes native windows as canonical UTF-8/LF. The full 9.66 MB source is audit evidence under `docs/evidence/terrain-validation/source-audit/`, excluded from `dist/`. See [source and registration evidence](docs/terrain-validation.md) for exact hashes and metadata discrepancies.

### Feature references and hypothetical endpoints

1. Search **Jezero**, **Belva** or **Neretva** in Mission control. Choose **Inspect** to enter the map directly, center that approximate reference and open its sourced details.
2. Choose distinct **Origin reference** and **Destination reference** values. The map uses an **O** circle, **D** square and reference diamond with names labeled approximate. **Swap endpoints** and **Clear endpoints** work; duplicate assignments preserve the prior selection and explain the error.
3. Toggle layers or return to the overview and inspect another feature. Reference selection persists across these actions and layer retries. It is held in memory and resets on a page reload.
4. Read the source links, planetocentric/east-positive convention, MDIM 2.1 control network and per-feature limitations in Sources & status. Feature coordinates retain their published two-decimal precision.

The three records are approximate geographic centers, not landing sites, observation locations or rover samples. Local search covers only these three records. Markers are visible at regional/detail zoom, independently of image-layer visibility. **Calculate routes** remains disabled pending registration, valid continuous grid endpoints and physical distance/slope calculations. No route line, distance, slope or safety score is inferred from the selected endpoints. See [source receipts and verification](docs/evidence/phase-3-targets/README.md).

### Cinematic Jezero approach — current implementation

Choose **Explore Jezero** or the map's **Jezero detail** action. With the NASA globe ready, the sequence establishes a full-globe view, performs an eased scripted orbit and camera approach, fades to selected real map imagery, then zooms to the published approximate crater center **77.69°E, 18.41°N** at map zoom **10**. Further zoom uses the existing CTX levels 11–12. An action from the map first reveals the full overview before approaching again. The camera angles are display choices; they are not geographic coordinates or a validated Jezero orientation.

The map fade waits for an actual rendered tile at the current matrix, rather than relying on accumulated download counts or cached lower-level parents. There are bounded context/detail waits with explicit fallback messages. This checks some visible source imagery, not complete coverage or positional accuracy. A final CTX wait can expire while leaving the centered map usable. The source panel retains independent loading, missing-tile, failure and retry information.

The same MOLA and preliminary CTX sources, custom Mars grid and layer preferences are preserved. MOLA supplies context when selected and available; CTX gradually appears at local zoom inside its own footprint. CTX-only exploration skips the unavailable/hidden MOLA step; both-hidden stays an honest empty state. Gray imagery remains gray. Neither imagery nor the visual mesh becomes numerical elevation.

**Skip animation** opens the destination directly. **Cancel** or Escape ends the approach and restores the overview when available; cancelling a return keeps the map. Reduced motion opens Jezero directly, and enabling it during animation finishes the transition without continued movement. Home remains a direct Jezero framing control while on the map. Zoom-out and **Return to overview** use a short reverse camera/fade sequence. Ordinary navigation is locked during transitions; layer choices and retry remain usable.

The Jezero approach waits for the overview to finish preparing; direct map context remains available during loading. A failed model permits direct map navigation. The cinematic checkpoint introduced no precise globe picking, Jezero surface pin, DEM processing or routing. See [orientation decision](docs/globe-flight-orientation.md), [source audit](docs/terrain-detail-audit.md), and [its verification record and six manual checks](docs/cinematic-jezero-verification.md).

### Earlier unified explorer checkpoint (`d6da376`)

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
- Three source-backed feature references, local search, inspection/details, selectable map markers and distinct hypothetical endpoints with swap/clear.
- On-demand native numerical terrain windows with response-byte integrity verification, source ranges, valid/missing counts and explicit limits.

## Structure

```text
src/app/App.tsx                  Workspace, layer visibility, status
src/components/layout/          Mission control, sources, About
src/components/map/MarsMap.tsx   Preserved standalone map component (not mounted)
src/components/explorer/        Current single-viewport globe/map orchestration
src/components/globe/           Preserved earlier standalone components (not mounted)
src/data/marsLayers.ts           Two sourced image-layer definitions
src/data/marsGlobe.ts            Official NASA visual-asset reference
src/data/scienceTargets.ts       Published feature centers and NASA science citations
src/components/mission/         Search, endpoint controls and source-backed details
src/features/mission/           Coordinate validation, endpoint state and tests
src/features/terrain/           Native numerical contract, sampling, loader and tests
src/features/map/               Capabilities, angular grid, requests, controller, tests
src/features/globe/             Lazy Three.js viewer and validated asset download
src/features/explorer/          Transition state machine and layer presentation rules
src/styles/index.css            Existing design plus map/source styles
docs/data-sources.md             Exact service contracts and CRS qualification
docs/evidence/phase-2/           Raw metadata and HTTP probe evidence (no image assets)
docs/evidence/phase-3-targets/   Feature/science source snapshots and request receipts
public/data/                    Bounded source-derived native terrain windows
scripts/prepare-terrain-windows.py Reproducible build-time Rasterio extraction
docs/evidence/terrain-validation/ Source TIFF/labels, extraction and browser evidence
```

Vite, TypeScript, and ESLint configuration remain at the repository root. The Phase 2 checklist is in `docs/superpowers/plans/2026-10-25-phase-2-mars-map.md`. The original placeholder component is preserved but is no longer mounted. The detailed specification remains in `REDLINE_AI_Agent_Project_Spec.md`; working rules remain in `AGENTS.md`.

## Data, attribution, and limitations

**Real source data, HTTP-verified:** NASA Mars Trek's `Mars_MGS_MOLA_ClrShade_merge_global_463m` and `Jezero_CTX_BlockAdj_dd` capabilities and representative image tiles. Browser rendering and interactions passed the user's manual acceptance test. See [source evidence and CRS resolution](docs/data-sources.md).

Both layers use identical inspected angular tile geometry. Trek's inconsistent `EPSG::104905` / `IAU2000::104905` labels and Earth-sized scale denominators are not passed to generic projection conversion. The app uses a custom service display grid. Precise native CTX latitude convention, fine cross-layer registration, and alignment with future targets or DEMs remain unverified. Quantitative overlays and measurements remain unavailable.

The Mars Trek layers are rendered image products, not numerical elevation. A separate source-derived numerical asset now supports qualified neighborhood inspection only. The three sourced feature centers remain approximate and unregistered to the imagery/DEM; slope, hazards and routing remain unavailable. The separate 3D model is visual only and is never an input to calculations. No synthetic terrain or substitute map tiles are used. Zoom enlargement does not add source detail. Browser CORS can hide missing-tile HTTP status; opaque failures are explicitly reported as network/CORS failures. A bounding box does not guarantee complete interior coverage.

Map images stream directly from NASA Mars Trek; no persistent tile cache or republished imagery is bundled. Product-specific credit is shown in the source panel and service attribution on the map. The original local wordmark, favicon, and interface icons are preserved. Dependencies and resolved versions are in `package-lock.json`. Dataset redistribution rights are not inferred from public service access.

REDLINE is not an official NASA product, is not NASA-endorsed, and is not a certified human-safety system. Re-check official challenge rules before submission-related work.

The next milestone is controlled-imagery/DEM registration and valid grid endpoint selection. Verify shared geometry/lineage and browser rendering, then physical Mars distance and slope math over valid continuous source support before routing. Route objectives/comparison and report export remain incomplete. Controlled CTX/HiRISE sources have been audited but are not integrated as additional map layers.

The updated NASA resource list is assessed in [resource strategy and completion priorities](docs/challenge-resource-strategy.md). Its main next use is controlled Mars Trek imagery; Jezero geology and curated Perseverance observations can strengthen science context after placement/route validation. The geology product's documented offsets and viewing terms remain explicit. Worldview supplies Earth data, and Curiosity's Mount Sharp path belongs to a separate Gale example.
