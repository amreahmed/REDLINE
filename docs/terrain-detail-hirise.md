# HiRISE source audit for the terrain-detail review

Audited on 25 October 2026. This is source research only. Application code, dependencies, and map configuration were not changed. External NASA/USGS resources and downloaded source tiles were inspected; REDLINE browser rendering remains unverified because browser access is blocked.

## Finding

A usable candidate for a later, explicitly approved close-up layer is NASA Mars Trek's `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd`, titled **MRO HiRISE, Jezero Mosaic, Controlled**. Live capabilities and representative tiles returned HTTP 200 with `Access-Control-Allow-Origin: *`. The tiles are genuine grayscale imagery. This is a small western Jezero/landing-area mosaic, not a crater-wide or global layer. Its bounding envelope contains gaps, including an inspected all-transparent tile.

HiRISE is not the smallest fix for the present navigation/detail problem: the current app midpoint is outside this mosaic and southwest of the published Jezero crater boundary. Fixing the destination and exposing the detail available from the selected CTX source should be assessed first. Merely adding this HiRISE layer at the existing midpoint would not supply imagery there.

## Published Jezero location

The [USGS Gazetteer, Jezero feature 14300](https://planetarynames.wr.usgs.gov/Feature/14300) was retrieved directly with HTTP 200. It identifies the crater center as **77.69° E, 18.41° N** in **planetocentric latitude, positive-east longitude, 0–360°**. Its published bounding envelope is 77.27–78.11° E and 18.01–18.81° N. These are a geographic feature center and envelope, not a landing point or a pixel-accurate target.

The application's coverage-box midpoint, `[77.01274065, 17.67557435]`, lies numerically west and south of that envelope. It is also outside both the controlled CTX envelope in the fetched catalog and the HiRISE envelope below. It must not be described as the center of Jezero crater. The preliminary CTX product's native latitude convention remains unresolved in the application registry; this numerical comparison does not establish precise co-registration with that product.

The [USGS HiRISE product page](https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_hirise_orthorectified_image_mosaic) additionally publishes `[77.4298, 18.4663]` as the projection center of a separate JPL surface-operations mosaic. This audit uses that published location only as an in-coverage source-probe reference; it does not assert that it is the actual Perseverance touchdown coordinate or a newly validated science target.

## Data contract

| Item | Verified evidence |
| --- | --- |
| Exact WMTS layer | `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd` |
| Provider and source | NASA Mars Trek service; USGS Astrogeology Mars 2020 TRN orthorectified HiRISE mosaic, [DOI 10.5066/P9QJDP48](https://doi.org/10.5066/P9QJDP48) |
| Source image | One unsigned 8-bit grayscale band; nominal 0.25 m/pixel, 85,600 columns × 85,952 rows |
| Source spatial model | Mars sphere, equatorial and polar radii 3,396,190 m; planetocentric latitude; positive-east longitude; longitude domain −180–180° |
| Original projection | Equirectangular, center longitude and latitude 0°, 0.25 m/pixel |
| Geographic `_dd` variant | Published VRT defines geographic degrees on the same sphere; pixel spacing `4.2176512145287685e-6` degrees; grayscale band, source NoData 0 |
| Bounding envelope `[west,south,east,north]` | `[77.2229331, 18.3067994, 77.583964, 18.669315]` |
| WMTS format and style | PNG, `default` |
| Matrix set / levels | `default028mm`, identifiers `0` through `17` |
| Grid | 256 × 256-pixel tiles; top-left `[-180,90]`; level 0 is 2 columns × 1 row; each dimension doubles per level |
| Service coordinate label | `urn:ogc:def:crs:EPSG::104905`; this label alone is insufficient geodetic evidence. The product labels, geographic VRT, origin, and matrix geometry establish the Mars degree grid used here. |
| Resolution of finest served grid | Level 17: `0.000005364418029785156` degrees/pixel, approximately **0.318 m/pixel meridionally** on the documented sphere. This is the tile-grid spacing, not a claim that the served pyramid preserves all 0.25 m source detail. |
| Attribution / terms | USGS page: access constraints none; use constraints request citation of authors. Credit USGS Astrogeology, MRO/HiRISE, and NASA Mars Trek; retain the data-release DOI and authors' reference. |

The verified [capabilities](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml) include a double slash before `{Style}` in the tile template; the exact advertised template worked in these probes. The `WGS84BoundingBox` and `EPSG` names in the service XML do not turn these coordinates into Earth WGS84. Do not import an Earth projection or derive Mars scale directly from unqualified WMTS scale denominators.

Grid spacing above was calculated as `360 / (matrixWidth * tileWidth)` degrees/pixel, then multiplied by `pi * 3396190 / 180` for meridional metres/pixel. East-west ground spacing additionally varies with latitude. Level 12 is about 10.175 m/pixel, level 15 about 1.272 m/pixel, and level 17 about 0.318 m/pixel by this calculation.

The [published `_dd` VRT](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd.vrt) explicitly links the geographic variant to the original orthomosaic. Its gray image band is not numerical elevation. Source NoData 0 must not be generalized to rendered PNG gray value 0: valid rendered pixels in the fetched tiles also reach zero; use the served alpha mask and documented source encoding at the appropriate stage.

The USGS HTML has an inconsistent `Instrument Names: CTX` catalog field, while the page title, description, source product, and NASA Trek instrument field identify HiRISE. This isolated metadata inconsistency is retained here rather than silently copied into attribution. The underlying spatial and pixel information was cross-checked against the ISIS/PDS labels and the exact geographic VRT.

## Actual tile probes and source-image inspection

All probes sent `Origin: http://127.0.0.1:5173` to the external Trek service. This checks returned CORS headers, not browser execution. Indices below are `level / row / column`.

| Probe | Result | Inspected content |
| --- | --- | --- |
| `12/1627/5857`, published JPL projection-center reference | HTTP 200; 57,973 bytes | 256 × 256 grayscale+alpha PNG; 65,536 opaque pixels. Source view shows ridges, crater forms, and tonal structure. |
| `15/13022/46863`, same reference | HTTP 200; 42,527 bytes | 256 × 256 grayscale+alpha PNG; 65,536 opaque pixels. Narrower view with ridge patterns and low-contrast ground. |
| `17/52089/187454`, same reference | HTTP 200; 28,343 bytes | 256 × 256 grayscale+alpha PNG; 65,536 opaque pixels. This particular close-up is low contrast; high pixel resolution does not guarantee conspicuous visual texture everywhere. |
| `17/52088/187452`, upper-left child of the inspected level-15 tile | HTTP 200; 32,497 bytes | 256 × 256 grayscale+alpha PNG; 65,536 opaque pixels. Direct source-image inspection shows curved ridge patterns. This is a tile comparison probe, not a named target. |
| `10/405/1463`, tile containing the envelope's northwest corner | HTTP 200; 206 bytes | 256 × 256 grayscale+alpha PNG; **all 65,536 pixels transparent**. HTTP success does not mean valid image coverage. |
| `12/1645/5848`, current application midpoint | HTTP 404; 196-byte HTML response | No imagery; outside the layer envelope. |
| `12/1629/5863`, Gazetteer crater center | HTTP 404; 196-byte HTML response | No imagery; crater center is east of this small mosaic. |

The four valid source images above were opened locally at original resolution. The alpha mask for all five PNG responses was decoded and counted. No colorization, sharpening, terrain inference, elevation decoding, or fabricated imagery was performed.

## Recommendation and limits

Treat this as a verified **candidate source**, not an integrated or browser-accepted layer. If a later approved change adds it, preserve its grayscale appearance and exact geographic footprint, respect transparent/absent tiles, show source resolution and missing-coverage status, and enable only its advertised levels. Keep CTX or MOLA visible beneath unavailable HiRISE coverage. Do not stretch this mosaic across Jezero or call its 25 cm pixel spacing 25 cm positional accuracy.

The existing map's level-12 ceiling would prevent access to this service's finest detail. A HiRISE addition needs an explicit, coverage-aware close-up zoom policy and fresh browser checks for alignment, layer order, requests, alpha compositing, and failure states. Source HTTP success and local image inspection do not satisfy those acceptance checks.

## Evidence and commands

Saved under `docs/evidence/terrain-detail-audit/hirise-*`:

- Live WMTS XML, selected unchanged NASA catalog records, and configuration used to discover the catalog.
- Gazetteer HTML, NASA metadata/abstract, USGS product HTML and published directory.
- Original ISIS/PDS labels and geographic VRT.
- HTTP status/header/byte-count/SHA-256 receipts and tile-grid calculations.
- Seven representative tile responses, including 404 bodies, with decoded PNG alpha/grayscale statistics.

Commands actually used: PowerShell reads/searches with `Get-Content` and `rg`; `git status --short` and `git branch --show-current`; Node scripts through `node --input-type=module` using built-in `fetch`, `fs`, `crypto`, `zlib`, and the repository's existing `@xmldom/xmldom` parser; local `view_image` inspection. No package install, application modification, test/build claim, commit, or push was made by this source-audit task. Application checks belong to the main audit or a later approved fix.

Evidence verification script: exit 0. All 16 downloaded response-file hashes and byte counts matched their receipts; 18 matrices, four fully opaque source-image samples, one fully transparent sample, two expected outside-coverage 404 responses, and the cited label/Gazetteer fields were asserted. `git diff --check` reported no tracked whitespace errors. The untracked report check emitted only the repository's LF-to-CRLF normalization warning (exit 1 for the new-file diff).
