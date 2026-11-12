# Cinematic Jezero approach verification

Implementation baseline: `d6da376` on `main`, with the pre-existing terrain audit reports and image evidence preserved. This milestone changes the retained explorer/controllers; it does not replace the map, NASA GLB, MOLA/CTX sources or dependencies. The [execution plan](superpowers/plans/2026-10-25-cinematic-jezero.md) records scope and ownership.

## Implemented behavior

- All explicit Jezero buttons share the same guarded flight action. From a map view, a 420 ms map fade first exposes the full globe. A 2-second preparation/orbit/dolly stage establishes full-globe framing and approaches Mars; a 700 ms fade reveals real map context; a 2.2-second map zoom arrives at the approximate crater center at level 10. Tile waiting can extend these display timings; they are not a duration guarantee or a physical flight model.
- The map uses the cited USGS/IAU navigation reference `[77.69,18.41]` in longitude-first order, with planetocentric/positive-east provenance and the existing native-CTX registration qualification. It is not an exact science target. The [orientation report](globe-flight-orientation.md) explains why the separate globe rotation remains scripted.
- One requestAnimationFrame sequence owns timing and rejects overlapping starts and stale callbacks. The retained controllers provide poses/zoom/opacity; no extra renderer is created during a flight. Ordinary input is disabled until the transition settles.
- A current-view/source/matrix readiness check rejects cached lower-resolution parent tiles, stale frames, hidden layers and fully transparent tile payloads. The context gate waits up to 12 seconds before retaining a readable overview fallback; the final CTX gate waits up to 10 seconds before leaving the map usable with an explicit notice. This is a conservative display gate, not proof of full valid-pixel coverage. If canvas readback cannot inspect alpha, it cannot assert CTX readiness, but normal tile rendering remains enabled.
- MOLA and CTX preferences persist. CTX-only uses local context rather than silently enabling MOLA. All-hidden retains the empty-layer explanation. The layer registry, formats, bounds and maximum level 12 are unchanged. MOLA enlargement beyond level 7 is still disclosed.
- Skip, Cancel/Escape, reduced motion, mid-flight graphics failure and disposal stop the animation owner. Reduced motion opens the destination directly. A return lasts 1.2 seconds and restores a full overview without geographically interpreting the globe.

## Automated and environment verification

Initial integration runs on 25 October 2026, before the manual-zoom correction recorded below:

| Command/check | Actual result |
| --- | --- |
| `npm run lint` | Exit 0; no ESLint errors or warnings. |
| `npm run typecheck` | Exit 0. |
| `npm test` | Exit 0; **110 tests passed across 15 files**, zero failures. |
| `npm run build` | Exit 0; 200 modules; CSS 32.74 kB, main JS 496.43 kB, lazy globe JS 637.33 kB. Existing warning for the globe chunk exceeding 500 kB remains. |
| Development server | Existing Vite process listened on `127.0.0.1:5173`. HTTP requests to `/`, the explorer component and the new choreography module returned 200. No second development server was started. |
| Source probes | Real MOLA context matrix 4 and CTX matrices 10, 11, 12 at the corrected location returned HTTP 200 and decoded as 256 × 256 images. CTX PNG mode is grayscale with alpha. |
| Evidence preservation | All 55 pre-existing terrain-audit evidence files retained identical SHA-256 hashes. The audit reports were not edited. |
| Git review | `git diff --check` passed. The source registry, projection factory, package/lockfile and project instructions have no diff. Nothing was staged or committed. |

The [source request record](evidence/cinematic-jezero/source-checks.json) and [development HTTP record](evidence/cinematic-jezero/dev-http.json) contain exact outcomes. Source probes used Python's HTTP client and Pillow decode; the server check used `Get-NetTCPConnection` and HTTP requests. These checks do not inspect the app's canvas or browser console.

Focused commands executed during implementation included `npm test -- src/features/explorer/animation.test.ts`, `npm test -- src/features/explorer/jezeroFlight.test.ts`, `npm test -- src/features/explorer/transition.test.ts`, and `npm test -- src/features/explorer/transition.test.ts src/features/explorer/layers.test.ts`, plus the globe/map suites. Tests first failed for missing modules/new behavior, then passed after implementation. Independent review found and prompted fixes for CTX-only generic re-entry waiting on its own hidden layer and reduced-motion return retaining a close camera. Both regression tests were observed failing before their fixes and passing afterward. The final independent review found no further actionable issue; it did not claim browser acceptance.

No browser automation was retried. The saved permission/managed-policy denial remains in force. HTTP resource tests, mocked renderer tests and a production build do not establish actual browser animation, texture rendering, perceived smoothness or responsive layout.

### Manual-zoom overlap correction — 25 October 2026

The user reported that manual zoom exposed both views for about one second and supplied a screenshot showing the globe above a regional imagery band. This is evidence of a visual defect in the previous implementation; “all good but…” is not a PASS report for all six acceptance checks.

Static inspection found the globe opacity was held at 1 throughout every non-null animation composition. Transparent map coverage exposed that globe, and the separate 360 ms CSS opacity transition could extend the fade after settlement. The correction derives both pane opacities from the same animation blend, gives the map pane the existing opaque space background, and removes the second CSS fade. Camera timing, layer preferences, readiness checks, sources and coordinates are unchanged.

Five composition tests cover manual reverse entry, both fade directions, CTX waiting, settled endpoints and direct/Skip/cancel destinations. Extracting the previous opacity formula reproduced **four failures** in `npm test -- src/features/explorer/transition.test.ts`; after the correction, all **15 tests** in that file passed. These are state/composition tests, not browser pixel tests.

Fresh checks after this correction:

| Command/check | Actual result |
| --- | --- |
| `npm run lint` | Exit 0; no errors or warnings. |
| `npm run typecheck` | Exit 0. |
| `npm test` | Exit 0; **115 tests passed across 15 files**, zero failures. |
| `npm run build` | Exit 0; 200 modules; CSS 32.69 kB, main JS 496.47 kB, lazy globe JS 637.33 kB. Existing globe chunk-size warning remains. |
| `Invoke-WebRequest` to the existing development server | `/`, the explorer component, transition module and stylesheet each returned HTTP 200. This checks resource serving only. |

Only `MarsExplorer.tsx`, `transition.ts`, `transition.test.ts`, `index.css` and this verification record were changed for this correction. Existing uncommitted cinematic work and terrain-audit evidence remain preserved. No browser access was retried; no commit or push was made.

**Targeted visual retest pending:** refresh the app and manually zoom map → globe → map repeatedly, including wide views and coverage edges. Confirm the outgoing view fades together with the incoming view, no globe persists behind missing tiles after arrival, no extra fade follows settlement, and the midpoint remains readable. Repeat Skip/Cancel and reduced motion as part of the lifecycle check below.

## Files changed in this milestone

- `src/components/explorer/MarsExplorer.tsx`, `src/components/layout/MissionControl.tsx`, `src/styles/index.css`: coordinated viewport, controls, status/fallback and accessible motion choices.
- `src/features/explorer/animation.ts`, `jezeroFlight.ts`, `transition.ts`, `layers.ts` and their tests: timing, stages, state guards and preserved layer choices.
- `src/features/globe/createMarsGlobe.ts`, `flightPose.ts` and their tests: scripted camera paths and lifecycle guards.
- `src/data/jezero.ts`, `src/features/map/createMarsMap.ts`, `jezeroView.ts`, `FrameAwareTileLayer.ts`, `frameReadiness.ts` and associated tests: sourced framing, opacity and current rendered-image readiness.
- `README.md`, this record, `docs/globe-flight-orientation.md`, the implementation plan, and `docs/evidence/cinematic-jezero/`: usage, provenance, observed checks and manual acceptance.

The pre-existing four terrain-audit reports and `docs/evidence/terrain-detail-audit/` remain uncommitted and preserved alongside this milestone. No data source or dependency was replaced.

## Historical manual browser checklist — previously pending

Run at the development app, [http://127.0.0.1:5173](http://127.0.0.1:5173), and repeat the main journey against production preview where practical. Report PASS/FAIL for each item; no old acceptance report is carried forward as evidence for this animation.

| Check | Result |
| --- | --- |
| 1. Full globe, rotation/approach and real-map crossfade | PENDING |
| 2. Correct Jezero framing and CTX levels 10–12 | PENDING |
| 3. MOLA/CTX visibility, grayscale and coverage | PENDING |
| 4. Reverse/replay, duplicate prevention, Skip and Cancel | Manual-zoom overlap reported; correction awaiting visual retest. Other lifecycle checks PENDING. |
| 5. Slow/failed services, fallback and recovery | PENDING |
| 6. Responsive/keyboard/reduced-motion behavior and attribution | PENDING |

1. **Animation:** Wait for the NASA model, then choose Explore Jezero. Confirm the complete textured globe appears before its smooth rotation/dolly, followed by MOLA context and regional imagery in the same viewport. Check for blank frames, abrupt camera/layout jumps, duplicate canvases and console errors. Repeat Jezero detail while already on the map.
2. **Destination/detail:** Confirm the service-grid center reads `77.690° lon, 18.410° lat`. Check real CTX Network requests at final matrix 10 (`10/407/1465.png` near the center), then zoom to 11 and 12 (`11/814/2931.png`, `12/1629/5863.png`). Confirm finer imagery appears after loading and no enlarged MOLA is described as new detail.
3. **Layers/coverage:** Toggle CTX to reveal MOLA, test CTX-only and both-hidden before/during a flight, and pan beyond CTX coverage. Choices must persist; CTX must remain grayscale and clipped, with real MOLA context where selected/available and honest empty/missing states elsewhere.
4. **Lifecycle:** Try repeated clicks; use Skip, Cancel and Escape during different stages. Return by button and zoom-out, then re-enter/replay. Confirm one animation at a time, usable controls afterward and no immediate bounce between views.
5. **Failure/recovery:** Throttle or block the NASA model and tile hosts separately, retry layers, and test failure during flight. Confirm bounded waiting, readable fallback, usable direct map/overview routes, no false successful detail claim, and recovery after restoring access.
6. **Accessibility/resize:** Test desktop/tablet/320px phone widths and resizing mid-flight. Check keyboard focus, About/Escape, all controls and source links. Enable reduced motion before and during an approach; arrival must become direct. NASA credit and the scripted/approximate-navigation limitations must stay readable.

## Agent verification — 13 November 2026

The user requested autonomous testing and continuation. Browser access now works. Testing moved to an isolated in-app browser at the user's request; no personal Chrome/native-app testing was continued after that request. Earlier checks on Chrome are not the basis of the following acceptance record.

The isolated browser exercised the actual app and a separate loopback Vite QA server at port 5174. `docs/evidence/cinematic-jezero/browser-qa-server.mjs` injects a fetch/motion wrapper **in memory only**, with a visible QA disclosure. Normal mode makes real NASA requests; fail mode injects network errors; slow mode delays the real request by 2.5 seconds. A forced reduced-motion preference exercises the normal application media-query handler. This does not reproduce a genuine NASA outage, CORS policy change or a changed operating-system preference. The standard production preview at port 4173 has no injection.

| Acceptance area | Observed result |
| --- | --- |
| Globe and Jezero entry | NASA textured globe loaded; approach and map stages were observed; real CTX appeared at the published `77.690,18.410` service-grid center. |
| Detail | Zoom controls reached the maximum CTX level; imagery/loading states responded and no terrain measurement was claimed. |
| Layers and coverage | MOLA/CTX toggles, both-hidden explanation and CTX-only outside-coverage state worked. Keyboard panning reached `79.799,18.410`; Home returned to Jezero. |
| Lifecycle | Return/replay, Skip, Cancel and keyboard navigation were exercised. Pane style inspection at settled map arrival reported globe opacity 0 and map opacity 1. Unit tests separately prove overlap guards and both fade directions. |
| Failure and recovery | Injected model/metadata network failures produced useful unavailable/retry messages and a usable map. Restoring access and Retry recovered the real layers. Slow real requests displayed metadata/imagery loading states. |
| Accessibility/responsiveness | About and Escape, keyboard controls, panel visibility and viewport overrides at 1280, 768 and 320 px were exercised. Forced reduced motion opened Jezero directly; changing the preference after initiating a flight left a usable settled map. The 320px document client/scroll widths both measured 305px after the overflow fix. |
| Production preview | The built app at `127.0.0.1:4173` loaded the NASA model and completed Jezero entry with real layer requests, followed by keyboard zoom navigation. |

This is a functional browser smoke test with sampled screenshots/accessibility/DOM observations, not a frame-by-frame smoothness benchmark, fine-registration test or planetary measurement validation. No fatal console error was captured in the normal isolated journey. The original user-reported manual acceptance remains historical evidence only.

Two review findings were corrected: the 320px body minimum width caused horizontal overflow with a vertical scrollbar; removing that minimum allows the layout to use its actual available width. Also, whole-tile alpha could falsely qualify imagery when its opaque pixels were outside the visible crop. The new per-tile alpha mask checks only the viewport/layer intersection, with north-down raster rows. Three regression tests first failed for transparent crops; the corrected focused suites passed. These are display-readiness checks, not terrain sampling.

Fresh final commands: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test` exit 0 (**119 tests / 15 files**); `npm run build` exit 0 (200 modules). The lazy globe chunk remains about 637 kB and emits the existing >500 kB warning. No dependency, source layer, projection, DEM or route engine changed.

## Checkpoint gate

The user-authorized functional acceptance and configured checks have now been exercised by the agent. Review and stage this milestone separately from the following feature-reference work. Preserve all existing audit evidence, and do not push.
