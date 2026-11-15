# Global globe source reconnaissance — 15 November 2026

These are new source receipts for the globe milestone. Older scientific audit records, the regional registry and all numerical terrain data are unchanged. Run `node docs/evidence/global-globe/sources/collect.mjs --verify-saved` to verify saved bodies offline; omit the flag to request the exact listed public resources again. Retrieval time is not an acquisition date.

## Current Mars Trek main basemap

The current official [Mars Trek application](https://trek.nasa.gov/mars/) loads `app/run.js?v=3.4.123-Mars`, which loads `jpl/config/config.json`. That configuration's `basemapService` points to `jpl/config/basemapList.json`. The saved basemap list explicitly declares its equirectangular default as **`Mars_Viking_MDIM21_ClrMosaic_global_232m`**, followed by separate north- and south-polar products. REDLINE registers the main equirectangular Viking product first, with global CTX available separately. The polar products are not claimed to be integrated.

| Contract | Observed value |
| --- | --- |
| Exact product | `Mars_Viking_MDIM21_ClrMosaic_global_232m` |
| Tile template | `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg` |
| Encoded response | JPEG; WMTS specifies 256 × 256 tiles |
| Current access | Official app/configuration, capabilities, abstract, catalog metadata and both root tiles returned HTTP 200; tiles and capabilities CORS `*` |
| Advertised coverage | `[-180, -90, 180, 90]` |
| Grid | Origin −180°, +90°, degrees; `2^(z+1)` columns × `2^z` rows |
| Matrix levels | 0–7; no level 8 is declared |
| Product resolution label | 232 m; streamed angular pixel scale varies with level and latitude |
| Source mission | Viking 1 and Viking 2 Orbiter Imaging Systems, confirmed by the exact Trek abstract |
| CRS qualification | Trek advertises EPSG:104905; REDLINE uses the inspected angular display grid, not Earth projection semantics |

The capabilities template contains a redundant slash after `1.0.0`; actual HTTP probes verified the normalized equivalent. Saved provider bytes are unchanged, and tests compare that normalized URL without inventing another service.

The exact catalog metadata is incomplete: its title, dates, creator, native coordinate details and usage terms are placeholders, including an `Access_Constraints: PRIVATE` field despite the publicly served default basemap. REDLINE does not treat these placeholders as a genuine 1970 acquisition date or grant of unrestricted use. It retains the raw response, the public default configuration, source attribution and links. Native latitude interpretation and absolute landmark registration are not independently established by this retrieval. The mosaic remains rendered imagery, not numerical elevation, and cannot resolve vertical-reference, physical-slope, terrain-cost or human-safety gates.

## Exact global CTX product

NASA Mars Trek's live candidate `CTX_beta01_uncontrolled_5m_Caltech` capabilities, abstract and catalog metadata identify **preliminary uncontrolled Beta01**. It is not the newer V01 release. The service advertises a global extent of −180° to +180° longitude and −90° to +90° latitude; this is a bounding extent, not proof of complete imagery or polar coverage. Beta01's exact coverage fraction was not established. The newer V01's 99.5% between 88°S and 88°N must not be attached to this source.

The WMTS ResourceURL points to the [Esri/USGS OnMars CTX tiled service](https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer?f=pjson), not a conventional Trek tile URL. Exact endpoints and current HTTP results are in `http-receipts.json`.

| Contract | Observed value |
| --- | --- |
| Tile template | `https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{TileMatrix}/{TileRow}/{TileCol}` |
| Encoded response | PNG, 512 × 512, 8-bit grayscale for the tested tiles |
| Current access | Capabilities/Esri JSON and three actual tile probes HTTP 200; tile/metadata CORS `*` |
| Grid origin and units | −180°, +90°; longitude then latitude, degrees |
| Matrix dimensions | `2^(z+1)` columns × `2^z` rows |
| Angular resolution | `360 / (512 * 2^(z+1))` degrees per pixel |
| Trek advertised levels | 0–11 |
| Esri source advertised levels | 0–17, same power-of-two angular cache |
| Registered globe range | 0–12: Trek matrices 0–11 plus level 12 from the same exact linked Esri cache, verified in Esri metadata and a live sampled tile |
| Actual spatial reference | Esri WKT `GCS_Mars_2000_Sphere`, WKID 104971, radius 3,396,190 m, zero flattening |
| Conflicting label | Trek advertises EPSG:104905; Earth projection semantics are not assumed |
| Nominal source pixel scale | Provider describes CTX near 5 m/pixel; this does not equal every streamed overview's resolution |
| Encoding limitation | Provider describes lossy 8-bit display rendering; returned PNG does not undo prior compression |
| Attribution / usage | NASA/JPL/MSSS/Caltech Murray Lab/Esri; provider grants free use of Beta01 |

Actual tile probes: both root hemispheres (`0/0/0`, `0/0/1`) and Jezero (`12/1628/5856`). The last is on the same live Esri cache beyond the shorter Trek capabilities listing; it verifies availability of that sampled tile only. Esri's exact level-12 resolution is 0.0000858306884765625 degrees/pixel, equivalent to approximately 5.09 m along the declared reference-sphere equator. That is a geometric pixel span, not a terrain measurement or uniform global ground resolution. REDLINE stops at level 12 despite the cache advertising further levels; upscaling is not described as additional source detail. Tests independently compare Trek's original 0–11 matrices and Esri's separate level-12 declaration.

No global exhaustive coverage test, per-pixel validity mask or quantitative positional calibration is claimed. NoData/mosaic gaps and failed requests must remain visible/absent; bright source pixels are not fabricated filling.

The [Caltech V01 page](https://murray-lab.caltech.edu/CTX/) and [NASA PDS bundle](https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Amars_mro_ctx_globalmosaicv01_murraylab_2023) describe the separate successor, 5 m rendered mosaic and its source traceability. Internet search retrieval confirmed that distinction. Direct Node access to Caltech failed certificate-chain verification, including a system-trust attempt; no certificate checking was disabled. That direct failure is retained in receipts. The globe does not claim to stream V01.

## Existing regional layers

Fresh capabilities confirm the existing registry without changing it:

- MOLA `Mars_MGS_MOLA_ClrShade_merge_global_463m`: 256 px, JPEG, levels 0–7, global rendered shaded-relief imagery. It is not numerical elevation.
- Preliminary CTX `Jezero_CTX_BlockAdj_dd`: 256 px, PNG, levels 0–12; extent `[75.1537692, 15.9058484, 78.8717121, 19.4453003]`. Fine registration and native latitude interpretation remain unresolved.
- Controlled CTX `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0`: 256 px, PNG, levels 0–13; extent `[77.1604655, 18.2110274, 77.6991776, 18.7211945]`. Source-control lineage does not establish independent absolute named-feature accuracy.

These use the angular origin −180°, +90°, global 2 × 1 root grid. The regional grid has 256 px tiles and therefore twice the angular pixel size at the same numerical level as the global 512 px service.

## Jezero HiRISE imagery

Verified exact Trek image layer:

`JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd`

Its live WMTS advertises 256 px PNG, levels 0–17, extent `[77.2229331, 18.3067994, 77.583964, 18.669315]`, and the same angular matrix geometry. An actual tile `13/3256/11713` returned HTTP 200, 256 × 256 PNG and CORS `*`.

The corresponding USGS `first.lbl` explicitly defines **0.25 m projected pixels**, Mars radius 3,396,190 m, Planetocentric latitude, PositiveEast longitude, longitude domain 180 and Equirectangular projection centered at latitude/longitude 0°. Native extents match Trek's rounded bounds. The `first.xml` describes joint HiRISE bundle adjustment, CTX reference control, a 2D affine correction and bilinear resampling. This establishes the documented source frame and processing lineage, not a new independent absolute accuracy validation.

This is rendered orthomosaic imagery. It is neither a DEM nor the separate nonoverlapping HiRISE DTM used in the historical height-definition audit. It does not resolve the live CTX height-reference conflict, physical slopes, terrain costs or human safety. The initially guessed native XML name without `first` returned 404; the correct label and metadata were then retrieved, with both outcomes preserved.

## Other unavailable candidates and limits

Both user-supplied `https://trek.nasa.gov/mars/trekWS/` and `.../MapService?request=GetCapabilities` returned HTTP 404. The functioning case-sensitive catalog endpoint is `https://trek.nasa.gov/mars/TrekWS/rest/cat/...`, and exact layer WMTS endpoints function independently.

HTTP+CORS checks here do not substitute for the root agent's authorized isolated-browser acceptance. All imagery remains display data. Coordinate-driven globe display tests validate the application mapping against these declared grids; they do not establish independent global feature registration or a validated relief shape.
