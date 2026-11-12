# Terrain-detail rendering audit

Audited 25 October 2026 against `d6da376` (`feat(explorer): unify Mars globe and regional map`). Application code, dependencies and tests were not changed. This report covers the rendering configuration and navigation; the source comparison has separate evidence in `docs/evidence/terrain-detail-audit/`.

## Confirmed findings

The Jezero navigation target is the midpoint of the **entire preliminary CTX mosaic**, not the center of Jezero crater. In `src/features/map/createMarsMap.ts`, `jezeroCenter()` averages `[75.1537692, 15.9058484, 78.8717121, 19.4453003]`, yielding approximately **77.01274065°E, 17.67557435°N**. `focusJezero()` uses that point and **zoom 8**. The [USGS Gazetteer Jezero record](https://planetarynames.wr.usgs.gov/Feature/14300) gives the crater center as **77.69°E, 18.41°N**, explicitly planetocentric, positive-east, 0–360. Its stated west/south limits are 77.27°E and 18.01°N. The current shortcut point is southwest of even those limits. The fresh source page is saved as [hirise-jezero-gazetteer.html](evidence/terrain-detail-audit/hirise-jezero-gazetteer.html).

This is a demonstrated navigation/framing issue. It is not a pixel-registration result: the preliminary CTX product's native latitude convention and fine registration remain unverified. An authoritative crater coordinate provides a better navigation reference, not automatic scientific alignment.

There are two different entry behaviors in `src/components/explorer/MarsExplorer.tsx`:

- The Jezero action while on the globe enters map **context at zoom 4**, where CTX is deliberately hidden.
- The same action while already on the map, the toolbar's **Jezero detail**, and the map's Home key use `focusJezero()` at **zoom 8**.

CTX enters at zoom 7 and exits below/equal to 6.25, subject to the user's layer choice and bounding-box coverage. A “Jezero” action from the globe therefore does not itself finish at CTX detail. Zoom 8 is also **16 times coarser in each angular image dimension** than the current CTX maximum, zoom 12. Increasing zoom around the existing midpoint continues to explore the wrong part of the broad mosaic for a crater-centered close-up.

## Actual source/grid API trace

Executed:

```powershell
node docs/evidence/terrain-detail-audit/render-audit.mjs
```

Result: **exit 0; diagnostic assertions passed**. The script loads the actual application parser, projection, source factory, visibility and transition functions through Vite SSR; parses the fresh capabilities XML; then exercises installed OpenLayers `View`, tile-grid selection, and source URL functions. It does not start a browser, fetch tiles, create a canvas, or measure a real viewport. The full values and input hashes are in [render-trace.json](evidence/terrain-detail-audit/render-trace.json); [render-audit.mjs](evidence/terrain-detail-audit/render-audit.mjs) reproduces them.

| Map zoom | View resolution (degrees / CSS pixel) | CTX matrix | CTX source-pixel size (CSS pixels) | MOLA matrix | MOLA source-pixel size (CSS pixels) |
| --- | --- | --- | --- | --- | --- |
| 4 | 0.0439453125 | 4; hidden by detail gate | 1 | 4 | 1 |
| 7 | 0.0054931640625 | 7 | 1 | 7 | 1 |
| 8 | 0.00274658203125 | 8 | 1 | 7 | 2 |
| 9 | 0.001373291015625 | 9 | 1 | 7 | 4 |
| 10 | 0.0006866455078125 | 10 | 1 | 7 | 8 |
| 11 | 0.00034332275390625 | 11 | 1 | 7 | 16 |
| 12 | 0.000171661376953125 | 12 | 1 | 7 | 32 |

These values are angular display sampling, not claims about native instrument resolution or numerical elevation. MOLA's advertised source is 463 m nominal spacing; zooming beyond its last tile level cannot add source detail.

At the Gazetteer crater center, the actual current CTX source factory generates these URL suffixes after `.../1.0.0//default/default028mm/`:

| Map zoom | Matrix / row / column |
| --- | --- |
| 8 | `8/101/366.png` |
| 10 | `10/407/1465.png` |
| 11 | `11/814/2931.png` |
| 12 | `12/1629/5863.png` |

The complete URLs are in the trace. The doubled slash is preserved from the inspected capabilities template. This establishes that the configured CTX source chooses higher matrix levels; it does **not** establish that the running browser requested, decoded or displayed them.

## Layer composition, scaling and missing coverage

- The managed layer collection is **MOLA first, CTX second**. Both return opacity **1**, with no explicit z-index. CTX is above MOLA. No source-color filters or CTX colorization are present.
- Both source and view use `REDLINE:MARS-TREK-DISPLAY`, degree units, east/north axis order, and explicit matrices with top-left origin `[-180, 90]`, 256 × 256 pixels, and `default028mm`. No Earth/Web Mercator transformation runs in this path.
- Each `TileLayer` clips to its advertised bounds. CTX visibility also requires viewport overlap. That rectangle does not prove valid imagery in every interior pixel. Source alpha/missing-tile behavior must be assessed separately.
- `createMarsMap` validates decoded image dimensions as 256 × 256. There is no path stretching a single arbitrary image over Jezero or over the globe.
- The pane transition changes opacity over 360 ms; the active pane ends at opacity 1. The pane/host CSS fills the viewport without a scaling transform or a persistent blur filter.
- Installed OpenLayers defaults are `interpolate: true`, `tilePixelRatio: 1`, `zDirection: 0`. The canvas renderer selects a tile level from **CSS-pixel view resolution**, then scales for device pixel ratio. At DPR 2 the URL/matrix is unchanged: a CTX source pixel occupies 2 × 2 device pixels at an exact matching zoom. This can soften apparent sharpness on a dense display; it does not explain away the wrong navigation target. Changing interpolation cannot manufacture new surface detail.
- The installed OpenLayers renderer may display cached parent tiles while a target tile is not ready, including some error cases; an explicitly `EMPTY` tile is skipped. Thus a correct higher-level URL configuration does not prove higher-detail imagery is currently displayed. The application records failures/missing requests, but its accumulated counters are not a per-frame tile-level inspection.

## Viewport limitation

The actual app's viewport dimensions, device ratio, current zoom, network requests and cached tiles were not observable because browser verification is blocked.

The trace includes **illustrative, simulated** 960 × 600 and 390 × 430 CSS-pixel viewports using OpenLayers' actual extent calculation. They are not browser screenshots. At the current midpoint and zoom 8, the Gazetteer crater center would be near pixel `[726.58, 32.60]` in the larger example and **outside** the smaller example at `[441.58, -52.40]`. At zoom 10 or 12 around that same midpoint it is outside both examples. These computations explain why viewport framing matters without asserting what the user's actual browser showed.

## Global globe smoothness

The Three.js overview is NASA's standalone visual GLB, independent of both WMTS layers. The recorded source inspection establishes **3,072 triangles** and two **2048 × 1536** textures in a six-face atlas. `createMarsGlobe.ts` keeps that geometry/material and provides camera orbit/zoom; it has no higher-resolution texture or geometry refinement. Smooth appearance when moving close to this finite visual asset is an expected limitation. Its normal texture and mesh are not a DEM, and no geographic GLB alignment has been validated.

## Smallest recommended change; not implemented

First correct the **Jezero shortcut and framing**: use a cited crater/feature reference and make the explicit detail action consistently reach a useful regional detail view. Preserve a separate broad-context entry if desired. Inspect a valid close-up at zoom 10–12 on the existing CTX layer before changing sources or adding rendering effects. Fit a documented crater footprint for an overview; use a cited point/footprint for a closer delta view rather than arbitrarily enlarging the broad-mosaic midpoint.

A controlled CTX or HiRISE layer is a separate source decision, dependent on the candidate's verified contract, true coverage and registration. Do not raise maximum zoom and assume it adds native detail. Do not colorize CTX or exaggerate visual relief to imply measurements.

Before accepting any fix, inspect the real browser at the target location: confirm the requested and displayed CTX matrices, response/decode outcomes, eventual replacement of cached parents, layer order/opacity, bounding-box and interior NoData behavior, and desktop/mobile framing. Those visual checks remain **unverified**. No success commit or push was created for this audit.
