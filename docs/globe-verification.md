# Visual Mars globe milestone — 25 October 2026

**Historical record of the earlier separate-view implementation.** The user subsequently requested one unified zoom-driven explorer. Its implementation and current manual acceptance checklist are in [unified-explorer-verification.md](unified-explorer-verification.md). The results and pending checks below are preserved for traceability; they do not verify the revised explorer.

Baseline: `9a66249 feat(map): add verified Jezero Mars map workspace`, on `main`, with a clean working tree before this milestone. Scope: optional NASA visual globe and navigation back to the existing regional map. No DEM, routing, hazards, geographic picking or unrelated refactoring.

## Design and integration

Keep the established space `#0B0F14`, panel `#121922`, elevated `#18222D`, text `#F2F5F7`, rust `#E06B45` and cyan `#58C7D8`. Retain Segoe UI/system sans-serif and existing panel geometry. The centered NASA model is the sole visual focus; controls and source text remain left-aligned. No decorative telemetry, star field or automatic motion is added.

```text
REDLINE                              About
[Regional Map | 3D Mars]              Panel visibility
Overview / Jezero shortcut | NASA globe | Model source and limits
                          | Controls   |
```

Review against the brief: preserve the map as the default view, keep the same mission workspace, and lazy-load Three.js. A Jezero surface pin was excluded because the model's geographic orientation is undocumented. The explicit region shortcut meets navigation needs without implying precise picking.

The OpenLayers instance stays mounted when hidden. Its refresh skips zero-sized hidden targets; returning to the map updates its size. Switching views retains layer settings and position; the explicit Jezero shortcut resets coverage. The globe has no dependency on map coordinate helpers or any numerical terrain module. Rendering is event-driven, with no continuous animation loop.

## Actual verification evidence

- `npm install three`: exit 0, one added package, 0 vulnerabilities.
- `npm install -D @types/three`: exit 0, six added packages, 0 vulnerabilities.
- `npm run lint`: final run exit 0, no ESLint errors or warnings.
- `npm run typecheck`: final run exit 0.
- `npm test`: final run exit 0, **46 tests across six files passed**, including the 32 existing map tests and 14 globe container/download tests. Tests cover changed dependencies, malformed containers, byte progress, HTTP failures, network/CORS errors, timeout during download/body consumption, and cancellation. Synthetic test containers are not display assets.
- `npm run build`: final run exit 0, 192 modules; CSS 30.08 kB, main JavaScript 484.01 kB, optional globe JavaScript 635.98 kB (7.05 / 147.01 / 159.72 kB gzip). Vite warns about the globe chunk exceeding 500 kB. It is already dynamically imported only when needed; the warning is not suppressed.
- `npm run dev`: Vite started successfully at `http://127.0.0.1:5173/` (ready in 572 ms). This is server-start evidence, not a browser load result.
- `npm run preview`: the production preview started at `http://127.0.0.1:4173/`. Its browser journey is also unverified.
- The application `fetchGlobeAsset` adapter was executed through Vite's `ssrLoadModule` in Node against the official NASA URL: exit 0, **4,032,148 bytes**, progress count matched, container validation passed. This is not GLTFLoader texture decoding or browser rendering.
- NASA page, asset, usage links, HTTP responses and inspected GLB structure: see [source evidence](globe-source.md) and `evidence/globe/`. No local model/texture substitute is used.
- Browser tool: denied observation of `http://127.0.0.1:5173/` by a saved permission or managed policy. No alternate browser or indirect automation was attempted.

Source review fixed narrow-header overflow risk, corrected display-only globe sizing, and prevents a late texture timeout from overwriting a WebGL-context-loss error. A separate read-only review found no other blocking source issues. Visual results remain unverified.

Final Git review: only the 18 intended globe milestone files changed (eight existing files and ten new files). `git diff --check` passed for tracked changes; all ten new files were checked for trailing whitespace with no findings. The index is unchanged and no commit was created. The Phase 2 checkpoint remains `9a66249`; all existing files are preserved.

## Required browser acceptance — all pending

Run these against the current app (and production preview where practical). Report each PASS or FAIL; do not infer new results from Phase 2's earlier manual tests.

1. **Real rendering and console:** Open Regional Map, then 3D Mars. Confirm the official NASA GLB succeeds in Network, the textured Mars globe appears, loading finishes, and the console has no fatal errors. An empty canvas or untextured sphere is a failure.
2. **Globe controls:** Rotate by dragging and the four directional buttons; zoom with wheel/pinch and + / − buttons; reset. Focus the globe and test arrows, + / − and Home. Confirm visible focus and usable limits.
3. **Regional-map regression:** Pan/zoom the regional map and change CTX/MOLA visibility. Switch to the globe and back: position and choices must persist. Both layers, map zoom/reset and source/retry controls must still work. The Jezero shortcut must reset to CTX coverage and move keyboard focus to the map.
4. **Failure/recovery:** Block `assets.science.nasa.gov` before opening the globe. Confirm an honest error, retry after unblocking, and access to Regional Map throughout. Switch views during downloading and retry repeatedly; no stale messages, stacked canvases or fatal errors. Test an unavailable WebGL context where practical; it must offer the regional map.
5. **Responsive/accessibility:** Check desktop, tablet and 320px-wide phone layouts, hide/show panels, tab through the switch and controls, use About/Escape and the skip link. No horizontal page overflow; controls, model, attribution and source information must remain accessible.
6. **Integrity and attribution:** Confirm NASA/JPL-Caltech credit, official model/usage links, visual-only limitations, and the Jezero navigation-aid wording. No scientific coordinates, elevation, route metrics or falsely precise surface marker should appear on the globe.

No browser checks have passed in this milestone yet. A checkpoint commit is withheld until the required smoke test passes, following `AGENTS.md`'s verification and commit workflow. No push is authorized.
