# REDLINE terrain-detail audit — 25 October 2026

Audited commit: `d6da376a3e12991cba7a3a08a27fe9ee2d22b4b7` (`feat(explorer): unify Mars globe and regional map`). The working tree was clean at the start. This task adds audit documentation and source evidence only; no application code, dependency, configuration, or existing work is changed. No commit or push is part of this audit.

## Finding

There is a confirmed **Jezero navigation/framing problem**, alongside expected source-resolution limits. The detail action centers the large preliminary CTX mosaic at **77.01274065°E, 17.67557435°N** and stops at **zoom 8**. This is southwest of Jezero crater's published center and even its approximate west/south bounds. The [USGS Gazetteer](https://planetarynames.wr.usgs.gov/Feature/14300) gives the crater center as **77.69°E, 18.41°N**, in planetocentric, positive-east coordinates. Zooming further around the current shortcut point does not move toward the crater.

The source/grid path is **not fixed to a low CTX matrix**: executing the actual application source factory and installed OpenLayers APIs selects CTX matrices 8, 10, 11 and 12 at the corresponding view zooms. Fresh HTTP requests to matching NASA source URLs return real grayscale imagery with finer visible features. This establishes configuration and source availability, **not the tiles actually displayed by the user's running browser**.

The smooth global appearance also has two distinct explanations. The Three.js overview uses NASA's finite visual GLB, not MOLA or adaptive terrain. In the regional map, MOLA is coarse global relief and cannot supply close-up imagery. Neither is a numerical elevation dataset in this application.

## Verified source and service limits

All four capabilities documents were freshly retrieved with HTTP 200 and `Access-Control-Allow-Origin: *`. Native source spacing and WMTS sampling are different quantities:

| Source | Documented native spacing | Advertised WMTS levels | Finest angular tile sampling | Approximate finest meridional sampling |
| --- | --- | --- | --- | --- |
| `Mars_MGS_MOLA_ClrShade_merge_global_463m` | 463.0836 m/pixel; 128 pixels/degree; rendered color relief | 0–7 | 0.0054931640625°/pixel | 325.606 m/pixel |
| `Jezero_CTX_BlockAdj_dd` — current | Effective native mosaic resolution remains unverified; the instrument's 6 m capability is not proof of this mosaic's effective resolution | 0–12 | 0.000171661376953125°/pixel | 10.175 m/pixel |
| `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0` — candidate | 6 m/pixel, one 8-bit grayscale band, from its product labels | 0–13 | 0.0000858306884765625°/pixel | 5.088 m/pixel |
| `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd` — candidate | 0.25 m/pixel, one 8-bit grayscale band, from its product labels | 0–17 | 0.00000536441802978515625°/pixel | 0.318 m/pixel |

The last column is an explanatory grid calculation, `angular sampling × 2π × 3,396,190 / 360`, using the documented Mars sphere radius. It is not a terrain measurement, native resolving-power claim, or distance result. East–west physical sampling differs with latitude. A finer service grid can resample an image without creating new information; MOLA's service grid being finer than its native spacing illustrates this.

Fresh capabilities confirm `default028mm`, style `default`, 256 × 256 pixels, matrix identifiers `0` through each source's maximum, and top-left origin `[-180, 90]`. Matrices have `2^(z+1)` columns and `2^z` rows. Coordinates are longitude first, rows run southward, and angular spacing is `0.703125 / 2^z` degrees/pixel. MOLA serves JPEG; the three image mosaics serve PNG.

See [MOLA/CTX source audit](terrain-detail-ctx-sources.md), [HiRISE audit](terrain-detail-hirise.md), and the raw [evidence directory](evidence/terrain-detail-audit/).

## What the current implementation does

| View zoom | CTX matrix when selected/in coverage | MOLA matrix | MOLA enlargement per source pixel | Meridional display sampling per CSS pixel |
| --- | --- | --- | --- | --- |
| 4, initial handoff | CTX deliberately hidden | 4 | 1× | Approximately 2,605 m |
| 8, current Jezero detail action | 8 | 7 | 2× | Approximately 163 m |
| 10 | 10 | 7 | 8× | Approximately 40.7 m |
| 11 | 11 | 7 | 16× | Approximately 20.4 m |
| 12, current maximum | 12 | 7 | 32× | Approximately 10.2 m |

The display-sampling estimates use the same explicit sphere conversion as above. CTX at zoom 8 is 16 times coarser in each angular dimension than zoom 12. The app stops at the current source's advertised maximum; increasing that maximum alone would not create valid level-13 current-CTX tiles. An explicit current-CTX level-13 probe returned 404.

The inspected implementation and runtime API trace establish:

- `src/features/map/createMarsMap.ts` computes the mosaic midpoint and hard-codes `focusJezero()` to zoom 8. `MarsExplorer.tsx` enters zoom-4 context when the Jezero action starts on the globe; the map's detail button and Home key call `focusJezero()`.
- CTX appears at zoom 7 and retreats at 6.25, subject to the user's selection and coverage. This gate is intentional, not evidence of a failed tile switch.
- MOLA is below CTX; both layers have opacity 1. Each layer clips to its own bounds. There is no CTX colorization, CSS map scaling transform, or persistent blur filter. The handoff's opacity fade settles at 1.
- OpenLayers interpolation is enabled. At matching integer CTX zooms, one tile pixel spans one CSS pixel. DPR 2 uses the same matrix and URL, spreading that sample over two device pixels per dimension. Fractional zoom and high-density displays can soften appearance, but do not explain the misplaced shortcut.
- OpenLayers can draw cached parent tiles while higher-level tiles are unavailable or loading. Thus generated URLs and accumulated load counters alone cannot prove the current on-screen detail level.
- The loader checks 256 × 256 decoded dimensions and reports request failures. Coverage rectangles do not guarantee valid interior pixels. Transparent image pixels expose lower layers; an entirely transparent HTTP-200 image is not valid terrain coverage merely because it decodes.

The actual viewport, device ratio, current layer selection, cache contents, browser network log and rendered frames remain unobserved. The [rendering audit](terrain-detail-rendering.md) includes clearly labeled simulated viewport calculations, not screenshots. At the current midpoint/zoom 8, the published crater center is outside the illustrative 390 × 430 viewport and near the top edge of the 960 × 600 example. Both exclude it after zooming to 10 around the same midpoint.

## Controlled CTX comparison

The controlled mosaic has substantially better provenance, but it is **not a demonstrated visual-sharpness upgrade**. At two identical level-12 service footprints, the retrieved controlled tiles look softer and lower in contrast than the preliminary tiles. Level 13 exists and was decoded and inspected; its existence is not proof of greater native detail or better visual clarity. The processing reason for this appearance was not established.

Its coverage is much smaller:

| Source | Longitude range, east-positive | Latitude range |
| --- | --- | --- |
| Current CTX | 75.1537692–78.8717121° | 15.9058484–19.4453003° |
| Controlled CTX | 77.1604655–77.6991776° | 18.2110274–18.7211945° |
| Controlled HiRISE | 77.2229331–77.5839640° | 18.3067994–18.6693150° |

These are advertised envelopes, not complete valid-pixel footprints. Controlled CTX covers the western/landing-region portion, not all of Jezero crater. Its tile at the app's current shortcut point returns 404. Replacing the current layer without changing the framing and coverage handling would lose existing regional coverage and initially point outside the new data.

The [source-tile comparison](evidence/terrain-detail-audit/ctx-source-tile-comparison.png) contains uncolorized source pixels. Same-level current/candidate pairs use the same tile footprint. Different levels cover different angular areas and are not an equal-ground-scale sharpness test. The explicitly arbitrary overlap probe `[77.5, 18.5]` is a sampling location, not a named science target.

## Planetary coordinates and HiRISE suitability

The WMTS `EPSG::104905` label and scale denominators retain the previously documented planetary-CRS discrepancy. The app avoids generic Earth projection conversion and derives its display grid from verified angular matrix geometry. Matching service grids establish consistent tile placement; they do not independently establish native cross-product registration.

The controlled CTX and HiRISE product labels explicitly document planetocentric latitude, positive-east longitude, a −180–180 longitude domain, and equirectangular projection with central longitude/latitude zero on a sphere of radius 3,396,190 m. Their geographic VRTs document longitude/latitude geotransforms, grayscale bands and NoData=0. Their derived bounds agree with their WMTS envelopes. This is stronger native-coordinate evidence than is available for the current preliminary CTX layer. Fine co-registration among all displayed products remains unverified; there is no validated GLB-to-map transform. The native VRT's NoData value must not be used to discard every black rendered PNG pixel: the served alpha mask distinguishes valid rendered pixels from missing imagery.

The HiRISE candidate is appropriate for a **future bounded close-up layer**, not a planet-wide or whole-crater replacement. Real grayscale/alpha tiles were fetched, decoded and visually inspected at levels 12, 15 and 17. A sampled boundary tile at level 10 returned HTTP 200 but had **65,536 transparent pixels and zero valid image pixels**. Probes at the current app midpoint and published crater center returned 404 outside this HiRISE envelope. Any later integration must retain those gaps honestly and avoid treating decoded-but-empty tiles as detail availability.

The NASA GLB was also retrieved again: HTTP 200, CORS `*`, the same 4,032,148-byte SHA-256 as the existing evidence, one mesh with 3,072 triangles and two 2048 × 1536 embedded textures. It has no adaptive terrain or texture refinement in the current viewer. [Fresh binary inspection](evidence/terrain-detail-audit/globe-source-inspection.json) supports the source-limit explanation; it does not verify GPU rendering or lighting in the app.

## Smallest recommended fix — not applied

Correct the Jezero **navigation target and framing first**, retaining the current CTX source. Use the cited crater footprint for a crater overview; for a detail action, choose a clearly labeled, sourced navigation location inside real imagery coverage and inspect zoom 10–12. Do not simply increase zoom at the existing mosaic midpoint. Make the explicit Jezero action's context/detail behavior clear and consistent.

This can remain a focused change to the map controller's target/framing, the explorer action if consistency requires it, associated tests and source documentation. No new map engine, colorization, exaggerated relief, cinematic transition, or source replacement is needed to test this first correction. A separately approved controlled-image/HiRISE addition would need its own bounds, source limits, transparency handling and visual acceptance.

After any approved fix, verify the real browser at the chosen location: actual matrix URLs, successful decoding, parent-tile replacement after loading, grayscale detail, layer toggles/order, outside/transparent coverage, and responsive framing. Browser access remains blocked, so these targeted visual acceptance checks are **pending**. Prior user-reported general browser acceptance is preserved but does not resolve this new terrain-detail complaint.

## Verification and repository handoff

Fresh baseline commands executed during this audit:

| Command | Observed result |
| --- | --- |
| `npm run lint` | Exit 0; no ESLint errors or warnings. |
| `npm run typecheck` | Exit 0. |
| `npm test` | Exit 0; 67 tests passed across eight files, zero failures. |
| `npm run build` | Exit 0; 193 modules. Existing 636.13 kB Three.js chunk warning remains. |
| `node docs/evidence/terrain-detail-audit/render-audit.mjs` | Exit 0; actual parser/source/grid/visibility API diagnostic assertions passed. No browser or tile requests are performed by this script. |

Additional verification used PowerShell/Node/Python HTTP probes, capabilities and product-label parsing, PNG/JPEG decoding, GLB binary inspection, and direct viewing of saved source images. Request receipts preserve exact URLs, HTTP outcomes, retrieval times and hashes. An independent [saved-evidence check](evidence/terrain-detail-audit/audit-integrity.json) passed: 39 response files match their byte/hash receipts, all 18 sampled image responses decode as 256 × 256, all visible pixels in the 17 PNG samples are grayscale, and the rendering trace's ten source inputs remain unchanged. The temporary Python check emitted a Pillow `getdata` deprecation warning; its assertions passed with exit 0. These are source inspections, not a bypass of the browser restriction. No app/browser smoke-test result is claimed for this audit.

`git status`, `git diff`, and `git diff --check` were reviewed. The only additions are this report, three supporting audit reports, and their evidence under `docs/evidence/terrain-detail-audit/`. Application/dependency/configuration diffs remain empty. No implementation fix, commit, push, DEM processing, routing or colorization was performed.
