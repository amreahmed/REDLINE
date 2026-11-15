# Geographic Mars globe verification

Milestone: NASA-based tiled globe, procedural space environment, sourced planetary POIs and geographic map handoff. Starting checkpoint: `b5ebd0d05ca393be3da06d3305c745c355794d45`. No new application dependencies. No remote push.

## Final architecture

- The default is the **actual current Mars Trek Viking MDIM 2.1 color basemap**, identified from Trek's live `run.js` → configuration → `basemapList.json`, then verified against its exact WMTS capabilities and real JPEG tiles.
- A separate geographic renderer maps angular source tiles onto an **undisplaced graphics sphere**. North is +Y, 0° longitude is +Z, 90° east is +X. Unit-vector placement and pole/dateline fixtures establish display-coordinate consistency, not surveyed absolute registration.
- The original NASA GLB controller remains unchanged and selectable as **NASA visual 3D model**. Only one globe renderer is mounted. Its scientific orientation remains unverified and it never supplies geographic POI coordinates.
- The regional OpenLayers engine receives explicit globe-center coordinates and an explicitly selected display layer. Its original regional layers, route overlays, mission picking and terrain interactions are retained. Direct planning clears the extra global imagery and its stale status before opening controlled CTX.
- Explicit HiRISE map imagery enables its verified levels through 17. Removing that extra source restores the original mission zoom limit of 13 and preserves the center. This changes display resolution only; no terrain or coordinate calculation changes.

Changed integration areas: `App`, `MarsExplorer`, `MissionControl`, `InformationPanel`, design styles and additive methods in `createMarsMap`. New modules: `globeLayers`, `marsPois`, `geographicMath`, `globeTileLod`, `createGeographicMarsGlobe`, `explorationTypes`, `imageryStatus`, `globeMapImagery`, `GlobeControls`, `GlobeSourceDetails`, their tests, source/POI/browser evidence and preservation tooling.

## Sources and limits

| Layer | Exact product and service | Contract / qualification |
| --- | --- | --- |
| Main Mars Trek surface | `Mars_Viking_MDIM21_ClrMosaic_global_232m`, NASA Trek EQ WMTS | JPEG 256 px, levels 0–7. Rendered Viking color imagery. Native latitude/absolute registration unverified. Catalog placeholder dates/terms retained in evidence; no unrestricted-use claim. |
| Global CTX | `CTX_beta01_uncontrolled_5m_Caltech`; Trek contract with the same Esri `OnMars/CTX/MapServer/tile` source | PNG 512 px, levels 0–12. Preliminary uncontrolled **Beta01**, distinct from V01. Trek lists levels 0–11; level 12 was separately tested on the same source. Advertised world bounds do not guarantee complete/polar coverage. |
| MOLA | `Mars_MGS_MOLA_ClrShade_merge_global_463m` | JPEG 256 px, levels 0–7. Rendered colorized shaded relief, not numerical elevation. |
| Preliminary Jezero CTX | `Jezero_CTX_BlockAdj_dd` | PNG 256 px, levels 0–12. Preliminary regional imagery, with existing native-latitude/registration qualifications. |
| Controlled Jezero CTX | `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0` | PNG 256 px, levels 0–13. Source-controlled imagery; shared control does not establish absolute landmark accuracy. |
| Jezero HiRISE imagery | `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd` | PNG 256 px, levels 0–17; footprint 77.2229331–77.583964°E, 18.3067994–18.669315° latitude. Exact label verifies 25 cm projected native spacing; every displayed level does not have that resolution. This is imagery, not the separate nonoverlapping DTM in the height audit. |

Source receipts, raw capabilities/configuration, labels, CORS evidence and actual image responses: [source evidence](evidence/global-globe/sources/README.md). Twenty-seven saved response bodies are hash-verified; four unsuccessful source requests are retained with their actual outcomes.

The new evidence directory has a scoped Git attribute that preserves raw line endings/provider whitespace across Windows checkouts. All **118 staged evidence files** were compared byte-for-byte with their working copies before the checkpoint; source bodies were not reformatted to satisfy whitespace checks.

The global CTX service declares GCS_Mars_2000_Sphere/104971 with radius 3,396,190 m; Trek's advertised EPSG:104905 is not used as an Earth projection. Regional/native qualifications remain in source details. No numerical terrain, elevation reference, slope, cost or routing algorithm was changed.

## Streaming and motion

The generic LOD selector uses the real tile size/matrices, angular camera footprint, viewport corners, source clipping, longitude wrapping and polar enumeration limits. It requests current-view detail and same-source ancestors. A complete coarse footprint is pinned beneath detail. The active cache holds up to 64 entries with four concurrent loads; the previous source is retained for a short transition and trimmed to 16 entries afterward. At most two source caches are retained.

During continuous movement, selection updates every 140 ms rather than postponing all work until dragging stops. Cached successful tiles remain visible, LOD hysteresis reduces oscillation, and detail/source transitions use 320 ms fades. Zoom uses distance above the graphics sphere and a 220 ms ease, preventing total-radius jumps directly to the close-camera limit. Reduced motion shortens camera flights and zoom. Imagery fades communicate loading; stars do not animate.

Obsolete work is aborted; stale completions cannot enter another source's cache. Decoded image size/type and bounded response size are checked. Fully transparent PNG tiles count as missing imagery; visible black pixels remain legitimate imagery. There is no inferred grayscale elevation or missing-data mask. Bitmap, texture, material, geometry, observer, event, timer and RAF cleanup are tested. A lost graphics context offers retry or the regional map.

Availability at the current center is distinct from a regional footprint visible near the horizon. Partial tile failures/missing counts are shown beside active imagery. Another dataset cannot silently fill missing data. Source-controlled coverage and real imagery can render without certifying absolute feature accuracy.

## POIs and interactions

Fifteen source-qualified POIs: Perseverance, Curiosity, Opportunity, Spirit, Viking 1, Viking 2 and InSight archived landing references; Olympus Mons, Valles Marineris, Elysium Mons, Gale, Hellas and Jezero landmarks; Belva and Neretva science references. Coordinates derive from NASA/PDS NAIF landing kernels, USGS Gazetteer entries and the preserved project feature references. [POI evidence](evidence/global-globe/pois/README.md) records definitions, precision, dates, exclusions and uncertainty; 21 saved source captures are hash-verified.

No guessed Sojourner/debris/impact records are included. Landing sites are not live rover positions. Approximate MDIM feature centers are not precise terrain-routing endpoints. Markers are surface-attached, horizon-hidden and collision-suppressed; selected/hover labels keep a readable screen offset even at close zoom. Search/list/detail controls provide keyboard alternatives to graphical marker picking.

Flights use actual POI coordinates. Early clicks queue until the geographic controller is ready; repeated flights during map return replace the queued target without canceling the necessary return. Source changes during handoff update the map source. Source retry also reaches the selected existing regional map layer. Geographic map entry/return preserves the center and selected source; planning remains a separate deliberate controlled-crop operation.

Procedural stars, directional lighting and atmospheric rim are disclosed visual effects, not an astronomical catalog, current solar ephemeris or atmospheric observations.

## Verification evidence

All required checks passed on the final implementation. Browser evidence is from new **isolated headless Chromium profiles**, with no personal profile, native browser session or security bypass. The three final replays passed **49 acceptance groups**: 18 globe/source/POI/responsive checks, eight real-motion/rapid-input checks and 23 existing mission/scientific-status checks. All three recorded zero unhandled page errors; the mission replay also recorded zero console errors and eight workers started/terminated with none left active.

- `npm run lint`: passed, exit 0.
- `npm run typecheck`: passed, exit 0.
- `npm test`: **592 tests across 47 files passed**, exit 0.
- `npm run build`: passed; existing >500 kB chunk advisory remains. No new dependency was introduced. The unchanged route worker is 11.68 kB.
- `node docs/evidence/global-globe/verify-preservation.mjs`: **149 protected files byte-identical** to the starting checkpoint.
- `node docs/evidence/science-routing-audit/provenance-height/verify-provenance.mjs --verify-saved`: **65,536 cells compared, zero differing Float32 bytes**, all valid cells preserved. CTX final height definition remains unresolved.

Replays: [globe/browser results](evidence/global-globe/browser/browser-results.json), [existing mission results](evidence/global-globe/browser/mission-results.json), [motion/rapid-input results](evidence/global-globe/browser/motion-results.json). Replay scripts are beside their results. Network-failure injection is restricted to disposable browser contexts; real NASA responses and production workers are used for normal checks.

MOLA's two complete coarse JPEG tiles were each requested once during the motion replay and reused across continuous dragging and MOLA → Viking → MOLA switching. The replay observed motion-enabled levels 2–3 while moving closer and retained imagery in intermediate screenshots. The main replay observed progressive HiRISE globe levels 7–9, then actual level-17 HiRISE responses in the regional map. Received/missing/failed counts remain explicit; these checks do not claim exhaustive source coverage or physical GPU benchmarks.

Visual evidence: [default Viking globe](evidence/global-globe/browser/desktop-viking.png), [global CTX](evidence/global-globe/browser/desktop-global-ctx.png), [continuous MOLA drag](evidence/global-globe/browser/mola-continuous-drag-16.png), [HiRISE map detail](evidence/global-globe/browser/jezero-hirise-map.png), [320 px globe](evidence/global-globe/browser/small-mobile-globe.png), [mobile layer sheet](evidence/global-globe/browser/mobile-layers.png). These were inspected alongside the source/POI, terrain-route and failure/recovery captures. Full overview framing adapts to narrow screens while deliberate close-view geography and distance remain unchanged on resize.

## Visual acceptance checklist

- Desktop: immersive color globe, visible restrained stars/terminator/rim, readable controls and attribution, one contextual drawer.
- Tablet/mobile/320 px: viewport-first layout, bottom-sheet controls, no horizontal overflow, visible scientific status/attribution, usable source/search/category controls.
- Layers: default Viking, global CTX, MOLA and regional source identities; camera continuity; no silent substitute outside coverage; partial failures and retry.
- Globe: rotation, real progressive tiles, smooth zoom, stable coarse imagery during continuous dragging, POIs attached and hidden behind the body.
- POIs: actual-coordinate flight, front-side hover/click, full provenance, confidence/coordinate qualifications and secondary NASA links.
- Handoff: Olympus and Jezero centers/sources retained in both directions; source selection and repeated flights during transitions remain usable.
- Mission: grid controls, real controlled CTX readiness, production route worker, comparison, cancellation/retry, scientific qualifications and audit download preserved.
- Keyboard: focusable explorer, arrow/+/-/Home actions, labeled controls, drawer close/return focus, sourced search and category controls.

Scientific validation remains **Partial**. Vertical height reference, absolute named-feature registration, real-Mars slopes/physical terrain costs, precise named-feature routing and original GLB scientific orientation remain unverified and gated. The new globe verifies display placement and imagery access; it is not a scientific registration certificate. Provider failures, coverage gaps and nominal-versus-displayed resolution remain visible. Long-session physical GPU-memory measurement and performance on representative hardware are not established by software/headless Chromium acceptance.
