# Independent controlled Jezero source and crop audit

Audit performed 13 November 2026. Scope: authoritative controlled-CTX geometry, rendered-tile coverage probes, and independent verification of the 256 × 256 native numerical crop. No application files were changed by this audit. No personal browser or device was used.

The placement and extraction checks passed. All **65,536 elevations and their 262,144 float32 bytes** match the pinned source TIFF directly, with zero NoData or nonfinite samples. This verifies native crop support and documented relative source placement; it does not establish absolute landmark registration, route fitness, slope, hazards, or astronaut safety.

## Sources and retrieval

Controlled image product: `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0`.

- [NASA Mars Trek capabilities](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/WMTSCapabilities.xml): freshly fetched HTTP 200, 8,810 bytes, CORS `*`.
- [USGS/PDS native archive](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/): exact product `.lbl`, `_pds3.lbl`, `_dd.vrt`, and `.xml` were freshly fetched HTTP 200. These metadata responses did not include a CORS header; they are build-time audit evidence, not browser-fetchable runtime inputs established by this audit.
- [Controlled image DOI](https://doi.org/10.5066/P9GV1ND3): identified in the fetched FGDC record, not independently re-fetched as a DOI landing page here.
- Numerical source: `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif`, the previously retrieved 9,662,387-byte native TIFF. Its bytes were re-hashed and inspected; this audit did not repeat the complete DEM download.

Requests used Node's built-in HTTPS fetch with normal certificate validation. Exact URLs, final URLs, statuses, retrieval times, content types, CORS headers, lengths, and SHA-256 hashes are in [http-receipts.json](http-receipts.json). Source labels, VRT, and FGDC are saved beside this report. Metadata publication date is `20200724`; HTTP modification and retrieval dates are separate fields, not image acquisition dates.

The provider lists Robin Fergason, Donna Galuszka, Trent Hare, David Mayer, Bonnie Redding, and Ethan Smith; USGS Astrogeology Science Center; MRO Context Camera imagery. FGDC access/use constraints both read `None`. This preserves the product-specific provider statement without implying NASA endorsement of REDLINE.

## Native and service geometry

Independent arithmetic uses the provider's zero-origin spherical equirectangular model: `x = R × longitudeRadians`, `y = R × latitudeRadians`, with **R = 3,396,190 m**, planetocentric latitude, positive-east longitude, and signed longitude domain. This is not an Earth/Web Mercator calculation.

| Contract | Controlled imagery | Numerical DEM |
| --- | --- | --- |
| Native dimensions | 5,322 columns × 5,040 rows | 1,596 columns × 1,512 rows |
| Sample type | One unsigned-byte grayscale imagery band | One IEEE float32 elevation band |
| Projected outer northwest corner | `[4573663.250853, 1109693.140188]` m | Same |
| Native projected sample spacing | 6 m; rows increase south | 20 m; rows increase south |
| Eastern outer longitude | 77.69917761355299° | 77.69897516629472° |
| Southern outer latitude | 18.211027390963398° | Same |

The imagery is **12 projected metres wider to the east**. Its extent must not silently replace the numerical DEM extent. A DEM cell spans 3⅓ native imagery pixels per axis; sharing an origin does not make every cell edge coincide. ISIS corner/bounds, geographic VRT corner/step, PDS3 dimensions/radii/scale, and PDS3 first-pixel projection offsets independently agree. The first center is half a pixel inside the outer corner, rather than at the corner. Full values are in [geometry-checks.json](geometry-checks.json).

The active WMTS matrices, parsed as XML elements rather than commented examples, are levels **0–13**, 256 × 256 PNG, origin `[-180, 90]`, matrix width `2^(z+1)`, matrix height `2^z`, and angular pixel spacing `0.703125 / 2^z` degrees. The exact advertised ResourceURL includes `/1.0.0//default/default028mm/…`. The declared `EPSG::104905` and service scale denominators are recorded but were not substituted for the explicit angular placement model. At level 13 the nominal equatorial sphere sampling is **5.087588097665367 m**, while native imagery remains 6 m. Rendered resampling does not increase measured detail.

## Selected continuous crop

The crop contains source columns **522–777** and rows **586–841**, using zero-based indices. Its exclusive outer edges are column 778 and row 842. The 256 × 256 rectangle is entirely valid and therefore connected under four-neighbor adjacency. It is a fixed prototype crop, not a measured feature boundary or a validated traverse region.

| Outer corner | Longitude, latitude | Controlled native image pixel edge (column, row) |
| --- | --- | --- |
| Northwest | 77.33659457394239°, 18.523470992935692° | 1740, 1953⅓ |
| Northeast | 77.42297207081594°, 18.523470992935692° | 2593⅓, 1953⅓ |
| Southeast | 77.42297207081594°, 18.437093496062143° | 2593⅓, 2806⅔ |
| Southwest | 77.33659457394239°, 18.437093496062143° | 1740, 2806⅔ |

All four recorded outer corners and seven recorded center/elevation fixtures match independent source arithmetic and raw TIFF strip reads. The independent decoder checked TIFF dimensions, single band, float32 sample format, no compression, one row per strip, strip lengths/ranges, geotransform, and source NoData sentinel. It compared each four-byte crop sample against `(586 + row, 522 + column)` in the native strip; it did not call Rasterio, the extraction script, or application helpers. No interpolation or replacement was performed.

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| Pinned source TIFF | 9,662,387 | `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b` |
| `jezero-terrain-grid.f32` | 262,144 | `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8` |
| `jezero-terrain-grid.json` | 3,147 | `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9` |

Crop minimum and maximum are **−2560.28857421875 m** and **−2363.345703125 m**. Those values are actual decoded provider samples, not height-derived colors. Encoding, projection, source identity, height-reference status, NoData, counts, extrema, corners, and fixtures were checked against the manifest. [grid-cell-checks.json](grid-cell-checks.json) records the exact results.

## Rendered coverage probes

The four corner-containing and center-containing level-13 tiles returned HTTP 200, CORS `*`, 256 × 256, 8-bit grayscale plus alpha, and 65,536 opaque pixels each. This sampled imagery coverage at five locations; it is not a pixel-by-pixel validation of every rendered tile in the crop.

| Probe | WMTS zoom / row / column | Result |
| --- | --- | --- |
| Crop northwest | 13 / 3252 / 11711 | Opaque grayscale PNG |
| Crop northeast | 13 / 3252 / 11715 | Opaque grayscale PNG |
| Crop southeast | 13 / 3256 / 11715 | Opaque grayscale PNG |
| Crop southwest | 13 / 3256 / 11711 | Opaque grayscale PNG |
| Crop center | 13 / 3254 / 11713 | Opaque grayscale PNG |
| Controlled image east edge | 12 / 1627 / 5864 | 5,632 opaque, 768 partially transparent, 59,136 transparent pixels |
| Outside controlled image | 12 / 1640 / 5845 | HTTP 404, 196-byte HTML response, no CORS header |

PNG scanlines were decompressed and unfiltered independently to inspect actual pixels and alpha. The edge's metadata longitude falls at pixel edge x = **22.51591838300228**, while low-alpha rendered pixels extend to column 25. This is evidence of a rendered-edge transition, not an exact native pixel/feature boundary; use authoritative bounds for coverage instead of deriving geometry from alpha. The outside response is stored under the requested `.png` filename to preserve exact response bytes and is explicitly classified as HTML, not decoded as PNG. Probe coordinates, tile corners, pixel locations, alpha counts, and hashes are saved in [tile-checks.json](tile-checks.json) and receipts.

The full native imagery TIFF was not downloaded because the source placement contract can be independently verified from labels/VRT/DEM geometry, and tile availability can be tested directly. Rendered PNG values were **not matched to native image samples**. The VRT declares nearest-neighbor warping, but this audit does not establish every later service rendering/resampling step or empirical landmark placement.

## Limits and remaining verification

FGDC states that CTX stereo DTMs were translated into relative alignment, then aligned to a DLR HRSC Level-5 reference. It reports an average relative image displacement of **9.6 m** and relative DTM vertical registration of **3.8 m after a 183.3 m vertical adjustment**. These are provider processing metrics, not a newly measured absolute error bound for REDLINE or registration to approximate MDIM 2.1 science-target coordinates. The provider also describes a northwest gap filled using a CTX image orthorectified to HRSC because no CTX DTM was generated there. All-valid DEM values do not prove stereo support or supply a pixel-level fill-provenance mask.

Heights remain **provider-declared metres relative to the Mars 2020 IAU sphere**, independently unvalidated as a vertical-reference interpretation. No areoid/geoid correction, datum mixing, slopes, physical route metrics, route costs, or safety claims were introduced. Application boundary handling, injected missing-cell rejection, endpoint state, map overlay placement, isolated-browser rendering/CORS, and the main journey are separate checks performed by the implementation reviewers/root agent.

Commands actually run:

```text
node docs/evidence/controlled-jezero-grid/source-registration/audit-source-grid.mjs
node docs/evidence/controlled-jezero-grid/source-registration/audit-source-grid.mjs --verify-saved
```

Both exited 0. The first freshly fetched 12 resources; the second revalidated saved receipts and hashes without network access, repeated all numerical/geometry/PNG checks, and reproduced the results. The application lint, typecheck, unit tests, production build, and browser smoke test were outside this audit's ownership and must be reported from their actual implementation runs. This audit creates no commit; it is intended for the root agent's verified milestone checkpoint.
