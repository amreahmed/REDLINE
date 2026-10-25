# Unified Mars explorer refinement — 25 October 2026

Baseline: Phase 2 commit `9a66249` plus the existing uncommitted globe implementation. The tracked diff and new files were inspected before editing; a recovery copy was saved outside the repository. The prior controllers, source registry, GLB error handling, standalone components, tests and evidence remain preserved. No dependency was added for this refinement. No DEM analysis, terrain costs, routes or precise surface picking is implemented.

## Geography decision made before transition coding

[The GLB investigation](globe-alignment.md) decoded actual mesh/UV/index arrays, inspected the color atlas, and checked NASA and USGS references. The six-face atlas has no validated geographic axis/prime-meridian mapping or independent control-point fit. No longitude/latitude conversion is implemented.

The first handoff explicitly enters the Jezero mosaic's service-grid center at map zoom 4. Subsequent handoffs retain the existing map center and use at least zoom 4. The Jezero navigation action overrides the destination deliberately. Returning to the overview retains the globe's viewing direction but retreats its camera; it does not claim to center the map's geographic location. Exact geometric continuity is therefore **not implemented**. This is the user-authorized honest fallback, described before and during the fade.

## Design and behavior

Keep the established space `#0B0F14`, panel `#121922`, elevated `#18222D`, text `#F2F5F7`, rust `#E06B45` and cyan `#58C7D8`, with Segoe UI/system sans-serif. Keep labels left-aligned and use the real visual content as the focus. A single toolbar, viewport, control strip and source panel span all three levels. No new decorative surface or top-level view tabs.

```text
REDLINE                                      About
Mars explorer / Overview to Jezero            Panel visibility
Mission + layers | Overview → MOLA → CTX      | Sources + status
                 | One navigation strip      |
```

- Overview entry threshold: camera distance ≤ 2.45 after arming at ≥ 3.2, in arbitrary display units only.
- Map return threshold: zoom ≤ 1.5 after arming at ≥ 2.5; automatic return is suppressed while the globe is unavailable.
- CTX detail threshold: enter at zoom ≥ 7, leave at ≤ 6.25. The user's checkbox remains authoritative. The existing CTX extent clips actual imagery, and outside coverage suppresses CTX without disabling MOLA.
- Input is disabled during the 360 ms opacity handoff. Stale transition timers and competing gestures are ignored. Reduced-motion preference sets transition time to zero.
- OpenLayers and the GLB remain mounted; input is enabled only on the settled active renderer. Outgoing map imagery remains through its fade, then map layers are hidden. Both controllers release resources on unmount, with globe cleanup also on retry.
- The retained standalone `MarsMap` / `MarsGlobe` components are no longer mounted by App. Their controller implementations and data/error paths are reused by `MarsExplorer`.

## Automated verification

The following commands were rerun on 25 October 2026 for the checkpoint after the user confirmed the manual browser results:

| Check | Result |
| --- | --- |
| `npm run lint` | Exit 0, no ESLint errors or warnings. |
| `npm run typecheck` | Exit 0. |
| `npm test` | Exit 0, **67 tests passed across eight files**. |
| `npm run build` | Exit 0, 193 modules; CSS 31.48 kB, main JS 484.97 kB, globe JS 636.13 kB (7.30 / 147.74 / 159.77 kB gzip). |

Vite retains the warning about the dynamically imported Three.js chunk exceeding 500 kB. It is not suppressed. Tests include threshold/rearm behavior, stale transition events, round trips, unavailable-overview fallback, CTX detail hysteresis, coverage and user layer preferences, plus the earlier WMTS/GLB/request tests. Two new message-priority regression tests failed against the previous behavior, then passed in the complete suite after fixing CTX-unavailable precedence and removing the unsupported promise of available MOLA context.

Independent source review found no blocking lifecycle/reentry/input issue. Its remaining status-copy findings were fixed. The existing development and production-preview servers remain listening on loopback ports 5173 and 4173; this port check is not a browser-load or console result. No dependency-install command was run for this refinement.

The implementation Git review found only the 30 intended cumulative globe/explorer files (including the earlier uncommitted work). Package and lockfile hashes matched the saved pre-refinement copies. The checkpoint uses `feat(explorer): unify Mars globe and regional map`; Git history records the final hash. The user subsequently authorized committing and pushing to the existing GitHub remote. That push also includes the already verified Phase 2 checkpoint `9a66249`, which had remained local.

No browser automation was retried through another surface or port. The known saved permission/managed-policy denial for `http://127.0.0.1:5173/` is still the browser-verification limitation. Node tests, HTTP asset inspection and a production build do not establish rendering or visual continuity.

## Manual browser acceptance — PASS (user-reported)

On 25 October 2026, the user was asked whether all six checks below passed and replied: **“All six passed.”** Each PASS records that manual report, not an agent-observed browser test.

| Check | Reported result |
| --- | --- |
| 1. Initial overview, real textured model, loading and console | **PASS — user-reported** |
| 2. Zoom handoff, input lock, fade and reduced motion | **PASS — user-reported** |
| 3. MOLA/CTX detail, coverage and layer controls | **PASS — user-reported** |
| 4. Return/re-entry, retained map state and interaction isolation | **PASS — user-reported** |
| 5. Model/tile failures, fallback, retry and recovery | **PASS — user-reported** |
| 6. Responsive accessibility, attribution and integrity notices | **PASS — user-reported** |

1. **Initial overview:** Reload the app. Confirm one primary explorer viewport, NASA's real textured GLB, functional loading feedback, retained mission/source panels and no fatal console errors. Verify the Network request uses the documented NASA asset.
2. **Zoom handoff:** Rotate to different hemispheres, zoom in by wheel/pinch, buttons and keyboard. Confirm the handoff consistently and visibly enters labeled Jezero context initially, not a falsely precise picked location. Verify the short fade, input lock and reduced-motion behavior; it must not flicker near thresholds.
3. **MOLA to CTX:** Confirm real MOLA context loads. Zoom into Jezero until CTX appears, zoom out until it recedes, and pan outside the CTX bounds at detail zoom. Selected MOLA must remain where available; CTX must not stretch beyond its footprint. Test each layer off and both off, including CTX-only broad/outside views.
4. **Return and re-entry:** Zoom out to the overview, then back in repeatedly. Confirm the camera retreats enough to avoid immediate re-entry, the map center and layer preferences persist, and the explicit Jezero action targets its stated area. Verify no duplicate canvases or competing interactions, including rapid input during a fade.
5. **Failures:** Separately block the model and tile hosts. Check model retry, map fallback, missing/failed tile messages and recovery. Confirm an unavailable globe does not automatically replace a usable map on zoom-out. Exercise return/retry while downloads or texture preparation are pending; no stale success message or fatal error may appear.
6. **Accessibility and integrity:** At desktop, tablet and 320px phone width, test controls, panels, keyboard focus/skip link, About/Escape, attribution/source links and readable notices. Confirm no globe-picked coordinates or elevation/route metrics are claimed. Repeat against production preview where practical.

All six required browser checks passed according to the user. Browser version, raw traces, screenshots and a distinct production-preview run were not supplied and are not inferred. These results verify the reported guided display workflow; they do not validate model georeferencing or native CTX registration. The earlier instruction to withhold the checkpoint while acceptance was pending is satisfied by this report and the fresh automated results. The user's latest request authorizes the GitHub push.
