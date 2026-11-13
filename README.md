# REDLINE

REDLINE is an independent Mars exploration and hypothetical surface-route planning prototype. **One explorer viewport combines NASA's visual Mars globe, real Mars Trek MOLA/preliminary CTX/controlled CTX imagery, and three sourced Jezero-area feature references.** The terrain planning workspace preserves all 65,536 native numerical cells and distinct hypothetical grid endpoints over controlled imagery. Plan now calculates reference-sphere separation between G-O and G-D. Search, approximate reference endpoints and numerical coordinate-neighborhood inspection remain available. Named-feature registration remains unresolved; an independent height audit found a vertical-reference conflict, so real DEM slopes, terrain costs and routing remain unavailable.

### Exploration workspace

The interface opens with the map/globe as the primary view. **Explore**, **Layers**, **Plan** and **Sources** in the navigation rail open one contextual drawer at a time; activating its navigation entry again or its close button restores the full viewport. The drawer displays the selected section without repeating the rail's navigation tabs. Large screens dock the drawer beside the map, tablets reserve space for a narrower drawer, and phones use a bottom sheet with navigation below the map. Mission forms, selections and loaded terrain remain mounted when sections or drawers change.

- **Explore** explains the Jezero destination and mission journey. The viewport's single **Fly to Jezero** action starts the existing cinematic approach; the destination panel points to that action.
- **Layers** contains the existing MOLA, preliminary CTX and controlled CTX switches, coverage/loading messages and retry actions.
- **Plan** loads the native terrain crop and retains all grid endpoint controls. On phones, starting a map pick closes the sheet and focuses the map; rejection feedback and **Cancel map picking** remain visible there. Expand **Explore approximate feature references** for the separate reference search and endpoint selectors. Choosing a reference endpoint keeps Plan open; choosing **Inspect** opens its sourced details.
- **Sources** shows availability, nominal resolution, coverage and scientific qualifications first. Expand each source's metadata for full coordinate information, limitations and citation links. Numerical terrain inspection remains available here.
- **Navigation & limitations** in the viewport groups keyboard instructions, marker meanings and globe handoff qualifications. NASA attribution remains visible; zoom/rotation/pan controls, **Reset view** and **Return to overview** remain available. Zooming toward the globe still enters the real map, and **Open map directly** remains available during model loading or failure.

The footer separates **Terrain data**, **Scientific validation** and **Route comparison**. Terrain status reflects actual loading; scientific validation is **Partial**, with native geometry verified and named-feature/height-reference gates unresolved. **Compare routes — unavailable** stays disabled until source-supported terrain costs and pathfinding are verified. Precisely routing to named science features additionally requires feature registration. See [current scientific/terrain verification](docs/scientific-metrics-verification.md). The [UI polish](docs/ui-polish-verification.md) and [UI redesign](docs/ui-redesign-verification.md) records retain the presentation checkpoints.

### Scientific review and terrain arithmetic

The 14 November [scientific-control milestone](docs/scientific-control-verification.md) adds reproducible archived rover-site controls and paired HRSC height comparisons. **21 of 41 fixed rover-site definitions map into the preserved crop**, but no image-space residuals or per-site uncertainty validate named-feature registration. The landing kernel's Gaussian latitude was correctly converted to planetocentric latitude; its landing position falls outside this crop. Fixed-site kernel coverage is not a visit date.

Nine native comparisons against separately documented **50 m HRSC sphere/areoid products** reinforce the unresolved CTX height-reference conflict. CTX-minus-HRSC differences range from **−65.28 to +3.45 m** against areoid heights and **+1621.72 to +1695.42 m** against sphere heights expressed relative to the app's sphere. These are diagnostic comparisons across different source cells and processing, not accuracy bounds or a justified correction. HRSC shares the CTX control lineage. Sources now provides expandable **Registration evidence & next requirement** and **Height evidence & next requirement** with authoritative links; scientific status stays Partial and real DEM slopes/costs/routes remain unavailable. No production terrain asset, coordinate transform or algorithm was changed.

Reproduce the new evidence without fetching provider data:

```powershell
node docs/evidence/scientific-resolution-2026-11-14/registration/fetch-control-sources.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/registration/fetch-places-sis.mjs --verify-saved
uv run --offline --with spiceypy==8.4.0 --with rasterio python docs/evidence/scientific-resolution-2026-11-14/registration/inspect-spice-controls.py
node docs/evidence/scientific-resolution-2026-11-14/height/fetch-new-evidence.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/probe-hrsc-headers.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/inspect-hrsc-ranges.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/sample-hrsc-controls.mjs --verify-saved
uv run --offline --with rasterio --with numpy python docs/evidence/scientific-resolution-2026-11-14/height/inspect-alternatives.py --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/verify-method-evidence.mjs
```

The Node saved-evidence commands validate receipts/results without provider requests. The SPICE command regenerates deterministic audit JSON/comments and checks source hashes; it never modifies application terrain. Python evidence runtimes are optional build-time tools, and `--offline` requires those packages already cached (omit it for initial dependency installation). Normal app setup still requires only npm. Registration/height findings and their concrete remaining evidence requirements live under `docs/evidence/scientific-resolution-2026-11-14/`.

Fresh authoritative feature records and native metadata validate coordinate conventions, source corners and cell-center mapping. They provide no independent landmark residuals or compatible MDIM 2.1 transformation. [The feature audit](docs/evidence/scientific-validation/feature-registration-audit.md) keeps that boundary explicit.

The exact DEM metadata declares metre heights relative to the 3,396,190 m IAU sphere. Nine coarse numerical PDS MOLA probes disagree with that interpretation by **1.626–1.699 km**, while lying much closer to MOLA areoid topography. Different resolution, interpolation and statistical definitions prevent treating these probes as exact accuracy measurements or a validated conversion. [The height audit](docs/evidence/scientific-validation/height-reference-audit.md) records the conflict. No sample, datum label, crop or pinned asset hash was changed.

Distance uses the shortest arc on the documented **3,396,190 m reference sphere**, calculated with stable unit-vector cross/dot `atan2`. East-west adjacent centers near row 714 are **18.96867459 m** apart despite 20 m projected spacing; north-south centers are 20 m apart. Arbitrary endpoint separation checks only the endpoints and is not route length, a terrain profile or a terrain-following surface distance.

Tested directional grade is `atan2(rise, horizontal run)` in degrees and `100 × rise/run` in percent. The hypothetical cost model is `distance × (1 + weight × (rise/run)²)`: distance and penalty are reported in **cost-equivalent metres**, with a finite nonnegative dimensionless preference weight. This is not calibrated effort, energy, risk or safety. Balanced multiplication avoids intermediate numeric overflow/underflow; genuinely unrepresentable results are unavailable. Synthetic grade/cost fixtures are tests only. Native edge adapters re-read valid neighboring cells, require both diagonal flanks and propagate NoData/outside/nonfinite support, but **do not emit real DEM grades/costs while height authorization is blocked**. No pathfinding was implemented.

Reproduce the new independent audit checks (optional build-time tools; not browser dependencies):

```powershell
node docs/evidence/scientific-validation/feature-registration/audit-feature-registration.mjs --verify-saved
node docs/evidence/scientific-validation/height-reference/audit-height-reference.mjs --verify-saved
node docs/evidence/scientific-validation/height-reference/compare-mola-reference.mjs --verify-saved
uv run --with rasterio python docs/evidence/scientific-validation/height-reference/verify-native-probes.py
uv run --with pyproj==3.7.2 python docs/evidence/scientific-validation/verify-distances.py
```

The PROJ fixtures independently check six analytic and five native-grid pairs plus latitude-dependent spacing across 256 east-west and 255 north-south row intervals. Normal application setup still needs only npm. Omit `--verify-saved` from Node source audits to refresh normal-HTTPS receipts, including recorded unavailable response formats.

The [controlled source/crop audit](docs/evidence/controlled-jezero-grid/source-registration/audit.md) records fresh source access, geometry checks and independent comparison of every extracted elevation to the original TIFF. The [milestone verification](docs/controlled-jezero-grid-verification.md) records 311 passing tests, lint/typecheck/build, and agent-observed isolated-browser checks of the production journey, failure/retry states, keyboard selection and 320 px layout. Earlier agent testing on 13 November 2026 used a background, isolated in-app browser for the numerical inspection checkpoint, controlled failure tests and production preview. Its [verification record](docs/terrain-validation.md), and earlier [feature/endpoints](docs/feature-endpoints-verification.md) and [cinematic](docs/cinematic-jezero-verification.md) records, remain checkpoint history.

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

ESLint treats warnings as failures. Type checking covers the application, tests, and Vite configuration. Vitest exercises saved real capabilities XML, matrix/axis/coverage validation, tile requests, explorer transitions, reference-coordinate validation, reference/grid endpoint invariants, actual OpenLayers marker/crop geometry, and native terrain sampling/integrity/NoData/boundary checks. An XML DOM package is used by tests and source audits. Tests do not fetch live data. No browser test runner is configured; agent browser checks are recorded separately.

### Controlled imagery and native grid endpoints

1. Open **Plan**, then in **Terrain planning workspace** choose **Open planning terrain**. This verifies a local 3,147-byte manifest and 262,144-byte little-endian float32 asset using pinned SHA-256 hashes and the native source contract. It enables **Controlled Jezero CTX imagery** and opens the crop directly on the regional map. No full TIFF is downloaded by the browser.
2. Wait for controlled imagery at local zoom. The outline marks a deliberately selected **256 × 256-cell prototype crop**, with source rows **586–841** and columns **522–777**, all currently valid. Enter an integer native row/column and choose **Set grid origin** or **Set grid destination**. For a reproducible pair, use row 650/column 580 and row 800/column 730.
3. Alternatively, choose **Pick origin on map** or **Pick destination on map** and click inside the outline. For keyboard selection, focus the map, pan with arrow keys and press Enter to select its center; **Use map center** provides the same action. The containing native cell is selected and its center is reported. This is not free-form site positioning, interpolation, or nearest-valid-cell snapping.
4. Distinct **G-O** and **G-D** markers identify hypothetical grid endpoints. Their native row/column and six-decimal center coordinates are shown in Mission control; decimal display precision does not establish landmark accuracy. Duplicate, fractional, missing, nonfinite or outside-crop choices are rejected with an explanation while retaining prior endpoints. West/north outer edges are inclusive and east/south outer edges exclusive.
5. **Swap grid endpoints**, **Clear grid endpoints** and **Cancel grid picking** operate independently of approximate reference endpoints. Layer toggles, reference/overview/Jezero navigation and leaving local zoom cancel active picking; panning at local zoom remains available for center selection. Selections remain in memory across these changes, panel hiding and imagery retries, and reset on page reload. Hidden/unavailable controlled CTX or absent current rendered controlled imagery disables picking; hiding it also hides the grid overlay. Use **Show planning terrain** or the relevant retry to restore context.
6. Read **Planning terrain source** in Sources & status for the native crop, bounds, source citation, numerical support and registration/height-reference limits. Altered, oversized, truncated, wrong-format, timed-out or unavailable terrain assets show an error and **Retry planning terrain**. Imagery retains its separate source, coverage and retry states.
7. With both grid endpoints selected, **Endpoint geometry** shows reference-sphere separation. The reproducible pair above reports about **4,134.7 m**. Swap preserves its magnitude; clear removes the value. Expand **Distance model & calculation limits** for the endpoint-only meaning and blocked DEM metrics.

The controlled CTX switch is separate from MOLA and preliminary CTX, and starts disabled. When both CTX products are selected, controlled CTX draws above preliminary CTX inside its footprint. It supports tile levels 0–13 with **6 m native projected imagery pixels**; rendered tile resampling does not add source detail. The native DEM uses **20 m projected cells** in the same documented 3,396,190 m sphere/equirectangular frame, planetocentric latitude and positive-east longitude. The imagery extends 12 projected metres farther east than the DEM; imagery visibility never establishes numerical terrain support. The grid overlay is shown with the controlled source, not transferred into the preliminary mosaic's unresolved registration.

The image citation is Fergason, Galuszka, Hare, Mayer, Redding and Smith (2020), USGS Astrogeology, NASA/MRO/CTX; [DOI 10.5066/P9GV1ND3](https://doi.org/10.5066/P9GV1ND3). Numerical cells come from `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0`; [DEM DOI 10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8). All 65,536 crop elevations and float32 bytes matched independent raw TIFF row-strip reads. The shared source geometry and provider photogrammetric lineage support relative placement; they do not establish absolute landmark accuracy or registration of approximate MDIM 2.1 feature centers. Native projected spacing is not a constant east-west surface distance.

Optional build-time reproduction uses the saved audited TIFF and [uv](https://docs.astral.sh/uv/); normal app setup needs only npm:

```powershell
uv run --with rasterio --with numpy python scripts/prepare-terrain-grid.py
node docs/evidence/controlled-jezero-grid/source-registration/audit-source-grid.mjs --verify-saved
```

The first command extracts native cells without resampling, interpolation, datum change or value alteration and writes the binary, manifest and Rasterio inspection. The second verifies saved HTTP receipts/hashes and independently rechecks source geometry, every numerical cell, fixtures and PNG coverage probes. Omit `--verify-saved` only to re-fetch authoritative metadata and seven imagery/coverage probes with normal TLS. The raw source, metadata and probe images live under `docs/evidence/`, excluded from the production app. [The audit](docs/evidence/controlled-jezero-grid/source-registration/audit.md) documents exact hashes, access outcomes and the native-image versus rendered-tile verification boundary.

The workspace provides source support, hypothetical endpoints and reference-sphere endpoint separation. It does not calculate real DEM slopes, hazards, route costs or routes. The sealed source declaration says IAU-sphere metres; the independent height audit records a conflict and leaves interpretation unresolved. All-valid cells do not prove stereo support everywhere or a traversable region; no pixel-level stereo/fill provenance mask is available.

### Numerical terrain inspection — retained workflow

1. Open **Sources**, then in **Sources & status** choose **Load numerical terrain**. The app verifies a local 52,868-byte source-derived asset's SHA-256 and schema before using its values. It does not download the full TIFF at runtime.
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

1. Open **Plan**, expand **Explore approximate feature references**, and search **Jezero**, **Belva** or **Neretva**. Choose **Inspect** to enter the map directly, center that approximate reference and open its sourced details.
2. Choose distinct **Origin reference** and **Destination reference** values. The map uses an **O** circle, **D** square and reference diamond with names labeled approximate. **Swap endpoints** and **Clear endpoints** work; duplicate assignments preserve the prior selection and explain the error.
3. Toggle layers or return to the overview and inspect another feature. Reference selection persists across these actions and layer retries. It is held in memory and resets on a page reload.
4. Read the source links, planetocentric/east-positive convention, MDIM 2.1 control network and per-feature limitations in Sources & status. Feature coordinates retain their published two-decimal precision.

The three records are approximate geographic centers, not landing sites, observation locations or rover samples. Local search covers only these three records. Markers are visible at regional/detail zoom, independently of image-layer visibility. These **O/D reference endpoints** remain separate from **G-O/G-D native grid endpoints**; choosing a named reference never silently snaps it into a terrain cell. **Compare routes — unavailable** remains disabled pending physical Mars distance/slope validation, documented terrain costs and route computation. No route line, distance, slope or safety score is inferred from either endpoint selection. See [source receipts and verification](docs/evidence/phase-3-targets/README.md).

### Cinematic Jezero approach — current implementation

Choose **Fly to Jezero** in the exploration viewport. With the NASA globe ready, the sequence establishes a full-globe view, performs an eased scripted orbit and camera approach, fades to selected real map imagery, then zooms to the published approximate crater center **77.69°E, 18.41°N** at map zoom **10**. Further zoom respects each CTX source's advertised maximum: level 12 for preliminary CTX and level 13 for controlled CTX. An action from the map first reveals the full overview before approaching again. The camera angles are display choices; they are not geographic coordinates or a validated Jezero orientation.

The map fade waits for an actual rendered tile at the current matrix, rather than relying on accumulated download counts or cached lower-level parents. There are bounded context/detail waits with explicit fallback messages. This checks some visible source imagery, not complete coverage or positional accuracy. A final CTX wait can expire while leaving the centered map usable. The source panel retains independent loading, missing-tile, failure and retry information.

The MOLA and preliminary CTX sources, custom Mars grid and layer preferences are preserved alongside the separately selected controlled CTX source. MOLA supplies context when selected and available; each CTX product gradually appears at local zoom inside its own footprint. CTX-only exploration skips the unavailable/hidden MOLA step; all-hidden stays an honest empty state. Gray imagery remains gray. Neither imagery nor the visual mesh becomes numerical elevation.

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
- OpenLayers map controller, three independent layer switches, zoom, pointer/keyboard navigation, and reset to Jezero's advertised mosaic extent.
- Live capabilities validation, independent requests/retry, timeouts/cancellation, coverage clipping, and explicit loading/empty/error states.
- Source links, instrument and nominal-resolution context, credits, service bounds, and request counts labeled since load/retry.
- An explicit angular service grid, with no Earth projection or scale-denominator conversion. The center readout is an image-grid position, not a validated science-target coordinate.
- Three source-backed feature references, local search, inspection/details, selectable map markers and distinct approximate reference endpoints with swap/clear.
- On-demand native numerical terrain windows with response-byte integrity verification, source ranges, valid/missing counts and explicit limits.
- Controlled CTX imagery with a distinct source contract, attribution, native geometry, level-13 detail, coverage and retry states.
- A hash/schema-verified continuous native float32 crop, source-frame outline, distinct hypothetical grid-cell endpoints, map/keyboard selection, rejection of invalid/missing/outside choices, and independent swap/clear.

## Structure

```text
src/app/App.tsx                  Workspace, layer visibility, status
src/components/layout/          Mission control, sources, About
src/components/map/MarsMap.tsx   Preserved standalone map component (not mounted)
src/components/explorer/        Current single-viewport globe/map orchestration
src/components/globe/           Preserved earlier standalone components (not mounted)
src/data/marsLayers.ts           MOLA, preliminary CTX and controlled CTX definitions
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
public/data/                    Native inspection windows and continuous crop/manifest
scripts/prepare-terrain-windows.py Reproducible build-time Rasterio extraction
scripts/prepare-terrain-grid.py  Reproducible continuous native crop extraction
docs/evidence/terrain-validation/ Source TIFF/labels, extraction and browser evidence
docs/evidence/controlled-jezero-grid/ Native grid inspection and independent source/cell audit
```

Vite, TypeScript, and ESLint configuration remain at the repository root. The Phase 2 checklist is in `docs/superpowers/plans/2026-10-25-phase-2-mars-map.md`. The original placeholder component is preserved but is no longer mounted. The detailed specification remains in `REDLINE_AI_Agent_Project_Spec.md`; working rules remain in `AGENTS.md`.

## Data, attribution, and limitations

**Real source data, HTTP-verified:** NASA Mars Trek's `Mars_MGS_MOLA_ClrShade_merge_global_463m`, `Jezero_CTX_BlockAdj_dd`, and `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0` capabilities and representative image tiles. Earlier MOLA/preliminary CTX browser rendering and interactions passed the user's manual acceptance test. See [earlier service evidence and CRS resolution](docs/data-sources.md) and [current controlled source/crop audit](docs/evidence/controlled-jezero-grid/source-registration/audit.md); the current audit's HTTPS/CORS headers do not substitute for application browser acceptance.

All three layers use the same inspected angular tile geometry. Trek's inconsistent `EPSG::104905` / `IAU2000::104905` labels and Earth-sized scale denominators are not passed to generic projection conversion. The app uses a custom service display grid. Controlled CTX's native planetocentric/east-positive spherical geometry agrees with the numerical DEM, including independently checked projected corners, geographic VRT and cell-center convention. Preliminary CTX's native latitude convention, fine cross-layer registration, absolute landmark accuracy and approximate feature-to-DEM registration remain unresolved. The controlled native grid outline and endpoint centers express source geometry; reference-sphere endpoint separation is supported. Real DEM slope, terrain-cost and route measurements remain unavailable.

The Mars Trek layers are rendered image products, not numerical elevation. Separate source-derived numerical assets support qualified neighborhood inspection and native-cell endpoint selection within the bounded crop. The terrain values are real archived provider samples; endpoint choices and crop boundaries are hypothetical prototype choices. The three sourced feature centers remain approximate and unregistered to the imagery/DEM; slope, hazards and routing remain unavailable. The separate 3D model is visual only and is never an input to calculations. No synthetic terrain or substitute map tiles are used. Zoom enlargement does not add source detail. Browser CORS can hide missing-tile HTTP status; opaque failures are explicitly reported as network/CORS failures. A bounding box does not guarantee complete interior coverage.

Map images stream directly from NASA Mars Trek; no persistent tile cache or republished imagery is bundled in the production app. Saved image probes are audit evidence under `docs/`. Product-specific credit is shown in the source panel and service attribution on the map. The controlled product's fetched FGDC lists access/use constraints as `None`; its citation and processing limitations are retained. The original local wordmark, favicon, and interface icons are preserved. Dependencies and resolved versions are in `package-lock.json`. Dataset redistribution rights are not inferred from public service access alone.

REDLINE is not an official NASA product, is not NASA-endorsed, and is not a certified human-safety system. Re-check official challenge rules before submission-related work.

The next scientific step is to obtain a definitive final vertical surface, correction model/version/sign and processing record for the exact TIFF, then verify it against independent compatible height controls; alternatively audit a replacement numerical DEM with a complete vertical contract. Named-feature planning requires documented control-network transformation or independent landmark residuals and a justified acceptance criterion. The preserved grid and tested arithmetic can then support DEM grade/cost validation. Only afterward implement and independently test A* or Dijkstra and route comparison. Route scores remain model outputs, not safety probabilities. Science-focused costs require separate evidence. Citation-backed geology/observation context, mission report/export, deployment and current challenge/submission requirements remain incomplete. The audited HiRISE source is not integrated as another map layer.

The updated NASA resource list is assessed in [resource strategy and completion priorities](docs/challenge-resource-strategy.md). Controlled Mars Trek imagery is now integrated; Jezero geology and curated Perseverance observations can strengthen science context after route validation. The geology product's documented offsets and viewing terms remain explicit. Worldview supplies Earth data, and Curiosity's Mount Sharp path belongs to a separate Gale example.
