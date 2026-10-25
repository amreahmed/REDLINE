# Phase 2 Mars image sources and display coordinates

Evidence retrieved on 25 October 2026 is preserved in `docs/evidence/phase-2/`. Retrieval times in the HTTP records are UTC request times, not observation dates. Neither a successful HTTP response nor an XML fixture test establishes browser rendering.

The two capabilities XML fixtures retain their saved response formatting. File-specific `.gitattributes` rules preserve their line endings and allow the provider's trailing spaces; ordinary source files keep the normal whitespace checks.

## Exact services

| Product | MOLA color hillshade | Jezero CTX preliminary mosaic |
| --- | --- | --- |
| Layer identifier | `Mars_MGS_MOLA_ClrShade_merge_global_463m` | `Jezero_CTX_BlockAdj_dd` |
| Mission / instrument | Mars Global Surveyor / MOLA | Mars Reconnaissance Orbiter / CTX |
| Capabilities | [MOLA XML](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml) | [CTX XML](https://trek.nasa.gov/tiles/Mars/EQ/Jezero_CTX_BlockAdj_dd/1.0.0/WMTSCapabilities.xml) |
| Angular coverage, west/south/east/north | `[-180, -89.9991635, 179.9983271, 90]` | `[75.1537692, 15.9058484, 78.8717121, 19.4453003]` |
| Image format | JPEG, 256 × 256 | PNG, 256 × 256, grayscale with alpha in the probed tile |
| Matrix identifiers | Literal strings `0` through `7` | Literal strings `0` through `12` |
| Resolution evidence | The [exact USGS source product](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_global_color_shaded_relief_463m) and service ID identify nominal 463 m spacing | Trek's catalog describes CTX instrument imagery up to 6 m/pixel; this is not a verified effective resolution for this mosaic. The catalog also has `resolution: 0.0001` without a complete unit/processing contract |

Both products use style `default`, tile matrix set `default028mm`, upper-left origin `[-180, 90]`, and matrix dimensions `2^(z+1)` columns by `2^z` rows. The exact ResourceURL has a double slash after `1.0.0/`; the probed CTX double-slash and single-slash responses had identical SHA-256 hashes. The application uses the supplied ResourceURL after checking its origin, product path, and placeholders.

The catalog labels CTX coverage as “Global,” contradicting its own polygon and both capabilities bounding boxes. The application uses the explicit regional bounding box. Bounding rectangles do not guarantee complete valid imagery within their interiors. Catalog ingestion dates and tile `Last-Modified` headers are not acquisition dates; acquisition dates are left unknown.

## Resolving the CRS discrepancy for image display

The capabilities and catalog use `urn:ogc:def:crs:EPSG::104905`. The actual [Trek API configuration](https://trek.nasa.gov/tiles/apidoc/config/config.json) instead uses `urn:ogc:def:crs:IAU2000::104905`. Neither is silently registered as a valid EPSG/IAU authority definition. [Esri's official SDK registry](https://developers.arcgis.com/enterprise-sdk/api-reference/net/esriSRGeoCS3Type/) identifies WKID **104905** as Mars 2000. The [archived OSGeo IAU2000 registry](https://raw.githubusercontent.com/OSGeo/spatialreference.org/master/scripts/iau2000.json) uses **49900** for Mars 2000. These are supporting context; Trek's configuration literally says 104905, not 49900.

The operational imagery grid is independently explicit in the [Trek service documentation](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars): the first global level has two columns and one row, with columns doubling at each level. Both live capabilities agree on the complete angular geometry:

```text
x = service longitude; y = service latitude (degrees)
origin = [-180, 90]; x increases eastward; tile rows increase southward
angular resolution[z] = 360 / (256 × matrixWidth[z])
                      = 180 / (256 × matrixHeight[z])
resolution[0] = 0.703125 degrees/pixel
```

The advertised level-zero scale denominator is `279227636.2980747`. Multiplying by the WMTS nominal 0.28 mm pixel and dividing by `0.703125` gives approximately `111194.6498` metres per degree, an Earth-sized conversion. Using Mars's equatorial radius with that denominator produces approximately `1.31900695` degrees/pixel, contradicting the provider's two-column global grid.

Consequently, REDLINE constructs `WMTSTileGrid` explicitly from the validated dimensions and origin. It does **not** use OpenLayers' scale-denominator-based capabilities helper, `fromLonLat`, Web Mercator, or an Earth transformation. Both source and view receive the same custom `REDLINE:MARS-TREK-DISPLAY` projection with degree units and `enu` axis order. An explicit nominal Mars equatorial `metersPerUnit` based on 3,396,190 m prevents the library's default Earth lookup; it is not used to compute or display physical scales or distances. Rotation and horizontal wrapping are disabled. This is untransformed service-grid placement, not a scientific reprojection.

The independent probe position `[77.5, 18.5]` falls in CTX tile level 9 / column 732 / row 203. Tests verify that the actual configured OpenLayers source generates the same URL used by the HTTP probe. This position is a test point for grid indexing, not an asserted observation or science target.

### Scope of coordinate confidence

The matching USGS MOLA source record describes planetocentric latitude, positive-east longitude, −180–180° domain, and radii A = 3,396,190 m / C = 3,376,200 m. This record was available through the search index; the research agent's direct retrieval returned 403. These attributes are not inferred from the misleading `WGS84BoundingBox` element name in WMTS.

An equivalent native label establishing the precise latitude convention and reprojection history of **Jezero_CTX_BlockAdj_dd** was not found. A differently named Jezero mosaic cannot substitute as proof. Both products can be plotted on their identical service grid, but precise CTX latitude convention, fine cross-layer registration, and alignment with external targets or a DEM remain unverified. The UI labels its readout **Service grid center**. No target overlays, physical distances, numeric elevation, slope, or route calculations are enabled. See [USGS Mars coordinate guidance](https://planetarynames.wr.usgs.gov/Page/MARS/system) for why latitude and longitude conventions must remain explicit.

## Access evidence and failure behavior

The raw evidence records exact URLs, response headers, byte lengths, hashes, and image dimensions; image bytes were examined in memory and not added to the repository.

| Probe | Actual result |
| --- | --- |
| Both exact capabilities, with `Origin: http://127.0.0.1:5173` | HTTP 200, `Access-Control-Allow-Origin: *` |
| MOLA `7/50/183.jpg` | HTTP 200, JPEG signature, 256 × 256, CORS `*` |
| CTX `9/203/732.png` | HTTP 200, PNG signature, 256 × 256, CORS `*` |
| CTX exact double-slash ResourceURL | HTTP 200, same payload hash as the single-slash URL |
| CTX `9/0/0.png`, entirely outside regional coverage | HTTP 404, HTML error body, **no CORS header** |
| Selected Trek catalog records | HTTP 200, no CORS header; bundled metadata is used rather than runtime catalog fetching |

Runtime capabilities are fetched afresh and checked against the inspected contract. If layer IDs, extent, CRS, matrix IDs/dimensions, or resource URLs change, the affected layer stays unavailable until revalidated. Each layer loads independently and offers retry. Requests time out after 15 seconds, including response-body consumption. Source changes/unmount abort in-flight requests. Decoding and 256 × 256 image dimensions are checked before imagery is marked received. No placeholder imagery or synthetic data replaces errors.

Layers are clipped to their advertised bounds. A viewport outside those bounds is explicitly marked outside coverage. An observable HTTP 404 becomes an empty tile. Because the observed 404 response lacks CORS, browsers can hide its status and expose only a network error; that case is labeled **network or CORS failure**, never asserted to be confirmed missing coverage. Request counts and warnings describe activity since the layer was loaded or retried, not completeness of all imagery in the viewport.

No persistent/offline tile cache or tile redistribution is implemented. OpenLayers keeps a bounded in-memory rendering cache; ordinary browser caching follows provider headers. Images are streamed from NASA. The [Trek API documentation](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) offers WMTS client access, but does not establish a blanket redistribution license for every upstream product. No such license is claimed. Preserve NASA/MGS/MOLA and USGS credit for relief, NASA/MRO/CTX credit for the mosaic, and NASA/JPL-Caltech Mars Trek service attribution. The preliminary CTX mosaic's individual processing authors are not established by the inspected metadata.

## Verification boundary

XML-fixture, grid/axis/boundary, configured OpenLayers URL, and request-classification/timeout tests exercise the actual code. HTTP image responses establish source availability at probe time. **The user reported PASS for all six Phase 2 browser acceptance checks on 25 October 2026**, including actual application-origin imagery/requests, layer toggling, navigation, coverage, failure/recovery states, console health, and responsive controls. The individual results are recorded in [README.md](../README.md#manual-browser-results--25-october-2026).

Browser automation remained blocked by a saved permission or managed policy. The browser evidence is the user's manual report, not agent observation or an automated browser run. Browser version, precise viewport sizes, raw request traces, and a separate production-preview run were not supplied. These PASS results validate the reported display workflow; they do not establish the native CTX latitude convention, fine cross-layer registration, numerical elevation, or fitness for measurements.
