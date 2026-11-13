# Jezero numerical terrain source audit

Retrieved and inspected on 13 November 2026. This is a source/data audit for the terrain-validation milestone. It does not establish REDLINE browser access, feature registration, route safety, app tests or a completed route engine.

## Selected candidate

The [USGS Mars 2020 Terrain Relative Navigation CTX DTM Mosaic page](https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic) links the archive directory and numerical GeoTIFF `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif`. The page returned HTTP 200 to the command-line client. The exact [S3 GeoTIFF](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif), ISIS label, PDS3 label and FGDC XML returned HTTP 200, with CORS `*` and `Accept-Ranges: bytes`.

The downloaded GeoTIFF is **9,662,387 bytes** with SHA-256 **16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b**. Raw bytes and metadata remain in this evidence folder, not the browser runtime. Source HTTP receipts are `source-http.json`, `numeric-source-http.json` and `datum-research-http.json`. Retrieval dates are separate from source publication/processing dates.

The alternative HiRISE DTM mosaic in the same authoritative archive is 1,839,545,409 bytes and was not downloaded. The larger JPL science CTX DEM is 90,345,300 bytes and has a different equirectangular standard parallel/origin; its metadata was inspected but its raster was not downloaded. Those sources cannot be treated as interchangeable with the selected 20 m mosaic.

## Verified numerical contract

The labels, TIFF tags and native-payload inspection agree:

| Field | Verified value |
| --- | --- |
| Product type | Numerical stereo-derived CTX DTM, not rendered imagery |
| Dimensions | 1596 columns × 1512 rows × one band |
| Encoding | IEEE float32, little-endian, scale 1, offset 0 |
| TIFF organization | Classic TIFF, compression 1 (none), one row per strip; no overviews/pyramid, not a COG |
| Source pixel spacing | 20 m × 20 m in projected coordinates |
| Pixel interpretation | Raster pixel area; upper-left corner tiepoint |
| Projection | Equirectangular; latitude/longitude of origin 0°; standard parallel 0°; false easting/northing 0 |
| Body | Mars sphere; equatorial/polar radii both 3,396,190 m |
| Geographic convention | Planetocentric latitude, positive-east longitude, −180 to 180° domain |
| Upper-left projected corner | X 4,573,663.250853 m; Y 1,109,693.140188 m |
| Geographic bounds | West 77.1604654592236727°, south 18.2110273909633982°, east 77.6989751662947015°, north 18.7211944818728036° |
| NoData TIFF tag | −3.40282265508890445e+38, represented as float32 −3.4028226550889045e+38 |
| Vertical unit/reference | Provider FGDC declares meters relative to Mars 2020 IAU sphere radius 3,396,190 m; reference not independently validated |

The filename includes `MOLAtopography_DeltaGeoid`, but this is not a sufficient definition for applying an areoid/geoid correction or overriding the explicit provider declaration. The mosaic and individual CTX FGDC metadata both state sphere-referenced meter elevations. No vertical conversion was applied. The source's horizontal sphere is independently explicit in the raster and labels; it must not be substituted for a vertical datum by assumption.

`inspect-numeric-source.mjs` validates the TIFF receipt/hash and its exact header contract before reading uncompressed strip samples. Running it exited 0 and produced `numeric-inspection.json`: **2,413,152 valid cells**, **zero NoData/non-finite cells**, minimum **−2710.69580078125 m**, maximum **−1515.53955078125 m**. NoData must nevertheless remain supported by derived processing and app sampling. All-valid cells do not prove accurate observations or complete stereo coverage.

The FGDC attribute range is −2710.414794921875 to −1522.2337646484375, which differs from the actual downloaded raster's min/max. Preserve this inconsistency, use source-derived statistics for the actual bytes, and do not treat the stale range as an absolute validity threshold.

## Provenance, quality and terms

The FGDC citation lists **Robin Fergason, Donna Galuszka, Trent Hare, David Mayer, Bonnie Redding and Ethan Smith**, publication date **24 July 2020**, publisher **USGS Astrogeology Science Center**, and [DOI 10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8). Preserve those authors and NASA/Mars Reconnaissance Orbiter/CTX attribution. The page requests author citation; FGDC access and use constraints are `None`, fees `None`. USGS disclaims warranties for other uses and does not confer endorsement. This does not certify human traverse safety.

The pipeline uses JPL-corrected CTX stereo imagery, SOCET SET DTM extraction, relative translation alignment using Ames Stereo Pipeline, then alignment to a DLR/HRSC Level 5 DTM. The 20 m mosaic was generated for Mars 2020 Terrain Relative Navigation, not human walking. The [2020 primary conference report](https://www.hou.usra.edu/meetings/lpsc2020/pdf/2020.pdf) supports this history and reports internal CTX-image average horizontal displacement 9.6 m and DTM vertical registration 3.8 m after a 183.3 m vertical shift to HRSC. These are provider-reported internal product measures, not REDLINE's independently measured errors or guarantees for MDIM 2.1 target positions.

The FGDC also notes a northwest imagery gap filled by a CTX image orthorectified against HRSC because no CTX DTM was generated there. Its imagery coverage envelope must not be used as proof of CTX stereo support everywhere. No mask distinguishing CTX-derived, filled or blended samples was found in the selected raster. Exact image acquisition dates are not inferred from its 2019 processing and 2020 publication dates.

## Range and CORS tests

`range-http.json` records:

- HEAD HTTP 200, Content-Length 9,662,387.
- Header Range `bytes=0-9778`: HTTP 206, 9,779 bytes, exact Content-Range and bytes matching the downloaded TIFF.
- One complete row Range `bytes=4567955-4574338`: HTTP 206, 6,384 bytes, matching the downloaded TIFF.
- OPTIONS with `Access-Control-Request-Method: GET` and request header `range`: HTTP 200, allow methods GET/HEAD and allow header range.

All successful responses gave CORS `*`. `Access-Control-Expose-Headers` is absent, so client code cannot assume JavaScript access to Content-Range or Accept-Ranges. These are command-line source probes using an Origin header, not an actual REDLINE browser request. Root owns isolated-browser acceptance. This TIFF is small enough for reproducible offline preprocessing; bounded row reads are possible, but do not advertise a Cloud Optimized GeoTIFF.

## Remaining evidence boundary

The source has a documented numerical spatial/encoding contract and usable data. It supports qualified, source-derived neighborhood inspection. MDIM 2.1 feature centers are approximate and have no independently established fine registration to this DTM. The current preliminary `Jezero_CTX_BlockAdj_dd` imagery cannot inherit the selected numerical product's CRS/control simply because both depict Jezero. Precise target elevation, slope at a science site, physical route metrics, and endpoint-to-endpoint routing remain dependent on additional registration and calculation validation.

No app code, package/dependency, existing source registry, commit or personal-device/browser interaction was performed by this audit.
