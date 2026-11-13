# Challenge resource audit — 13 November 2026

This read-only audit requested the supplied public resources through HTTP clients and the remote internet search connector. Application code, dependencies, commits and personal browsers/devices were not changed. `http-receipts.json` records requested/final URLs, UTC retrieval times, HTTP status, content type, response headers, byte counts and SHA-256 hashes. Saved pages are evidence of retrieval, not app/browser acceptance.

## Recommended next milestone

Integrate the **controlled Jezero CTX imagery as a separately attributed map layer**, then verify its geographic tile geometry against the native controlled orthomosaic and the already audited numerical DEM. This is a focused improvement to the evidence foundation of the current Jezero workflow. Preserve the broader preliminary imagery for regional context and clearly identify each product. Test loading, missing coverage, unavailable service, source controls and an isolated browser before claiming it works in REDLINE.

The native controlled orthomosaic and selected DEM share the documented Mars sphere, zero-origin equirectangular convention and upper-left projected corner; they have different native pixel spacing and dimensions. This is documented product geometry/lineage, not an empirical landmark residual or proof of precise MDIM 2.1 feature registration. The WMTS images have their own angular tile grid and rendered/resampled image pixels; validate that adapter rather than treating tiles as native DEM cells. Keep slope, endpoint-to-endpoint routes and safety scoring disabled until their numerical and endpoint contracts are independently verified.

After that milestone, consider **one geologic interpretation context layer** from USGS SIM 3464. Its documented 100–200 m offsets and hosted viewing-only terms must remain visible; it is unsuitable for precise DEM-linked material assignments or hazard/science route weights without further evidence. Do not apply one arbitrary translation to correct random registration offsets.

## Resource access and relevance

| Supplied resource | Observed access | Suitable use |
| --- | --- | --- |
| [Mars Trek](https://trek.nasa.gov/mars/) | TLS-valid GET 200; exact controlled CTX capabilities, service discovery and three actual PNG tiles also 200 | Current Mars imagery services and a controlled Jezero layer candidate |
| [USGS interactive Mars maps](https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars) | TLS-valid GET 200; traced Hub page/application/webmap items and actual Jezero unit service | Published geologic interpretation with scale, citation, projection and registration limits |
| [Curiosity proposed path up Mount Sharp](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/) | TLS-valid GET 200 | Presentation example for explaining a proposed route and its science destinations; not Jezero route geometry or terrain input |
| [NASA Worldview](https://worldview.earthdata.nasa.gov/) | TLS-valid GET 200; [Earthdata description](https://www.earthdata.nasa.gov/data/tools/worldview) also 200 | Earth imagery interface inspiration or a separately justified terrestrial-analogue discussion; not a Mars weather/terrain layer |
| [Perseverance raw images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | TLS-valid GET 200; discovered public gallery JSON request returned 200 and CORS `*` | Sourced image/caption cards with acquisition date, camera and exact image credit; no inferred global coordinates or DEM |

## Exact controlled CTX candidate

- Product: `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0`.
- Current Trek catalog title: **MRO CTX, Jezero Mosaic, Controlled**; UUID `32003f69-a6f6-4441-bb46-4c46689c42eb`.
- [Service discovery](https://trek.nasa.gov/mars/TrekServices/ws/index/getLayerServices?uuid=32003f69-a6f6-4441-bb46-4c46689c42eb) returned 200 and names that exact WMTS endpoint/layer ID.
- [Actual WMTS capabilities](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/WMTSCapabilities.xml) returned 200 with a localhost Origin and CORS `*`. Format PNG; style `default`; matrix set `default028mm`; matrix identifiers **0–13**; 256 × 256 tiles; angular upper-left `[-180,90]`; matrix 0 has 2 columns × 1 row. Its advertised authority label is `urn:ogc:def:crs:EPSG::104905`; do not let an Earth CRS lookup override the inspected angular grid.
- Advertised geographic envelope: west 77.1604655°, south 18.2110274°, east 77.6991776°, north 18.7211945°. This is an envelope, not proof every pixel contains valid image support.
- Level-13 requests calculated from that grid for the three existing approximate reference coordinates all returned actual 256 × 256 PNGs: [Jezero row 3258 / column 11727](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/default/default028mm/13/3258/11727.png), [Belva row 3254 / column 11713](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/default/default028mm/13/3254/11713.png), [Neretva row 3251 / column 11705](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/default/default028mm/13/3251/11705.png). Received sizes were 32,457, 33,351 and 34,637 bytes; all had CORS `*`. These are CLI requests, not an isolated-browser rendering/registration test.
- [Native TIFF](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif): HEAD 200, length 36,269,402 bytes; Range `bytes=0-30921` returned 206 with 30,922 bytes and exact Content-Range. CORS `*`. No full TIFF download or full-file hash was performed in this resource audit.
- Native labels and registration checks already saved in `../terrain-validation/registration-sources/` document 5322 × 5040, 6 m projected pixels, sphere R=3,396,190 m, planetocentric/east-positive signed longitude, standard parallel/origin 0, and upper-left `[4573663.250853,1109693.140188]` m. The selected 20 m DEM is a separate numerical product. Retain Fergason et al. (2020), USGS Astrogeology/NASA-MRO-CTX attribution and the orthomosaic citation [10.5066/P9GV1ND3](https://doi.org/10.5066/P9GV1ND3); do not substitute the DEM citation for the image product.

## USGS geology: usable context, important registration limit

The Hub is a map-discovery application, not itself a Jezero geologic-units dataset. Its inventory advertises Earth EPSG:4326 for catalog footprints; those footprints are not the native geology geometry.

The actual [USGS publication](https://doi.org/10.3133/sim3464) returned 200 at `https://pubs.usgs.gov/publication/sim3464`. The official product is **Sun, V.Z., and Stack, K.M. (2020), Geologic map of Jezero crater and the Nili Planum region, Mars, USGS SIM 3464**, scale 1:75,000. It covers approximately 76.8–77.8°E and 17.7–18.7°N. Its mapping combines CTX imagery with THEMIS night infrared, CTX DTMs, HRSC topography and HiRISE context; these are sourced geological interpretations, not measurements of astronaut trafficability.

The linked [interactive map DOI](https://doi.org/10.5066/P9CZYIO7) returned 200 after redirecting to the USGS ArcGIS application. Traced [webmap item](https://usgs.maps.arcgis.com/sharing/rest/content/items/137eebf467514082a27c03c88b5ffe58?f=pjson) and its data identify the actual [geologic units layer](https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Jezero_FeatureServiceFromPro/FeatureServer/8?f=pjson). The layer metadata and a one-feature native JSON geometry/attribute query both returned 200 with CORS `*`. Fields include `unit`, `name`, `Unit_Description`, `Additional_Characteristics` and `Unit_Interpretation`.

Its native spatial reference is Mars-sphere **Transverse Mercator**: R=3,396,190 m; central meridian 77.5°; latitude of origin 0°; scale factor 1; false easting/northing 0; metre units. The layer returned native projected polygon geometry. An advertised GeoJSON capability does not justify treating Mars output as Earth/WGS84 GeoJSON or using an unverified Earth transformation.

The [official metadata](https://pubs.usgs.gov/sim/3464/sim3464_metadata.xml), fetched with valid TLS and HTTP 200, states that the geologic map was drawn on a semi-controlled CTX mosaic before the July 2020 controlled mosaic and has **random offsets of about 100–200 m** from that surface-operations mosaic. The official GIS projection agrees with the native service WKT. This evidence blocks unqualified precise overlay claims with the selected controlled DEM.

Both the [service item](https://usgs.maps.arcgis.com/sharing/rest/content/items/b602bd9a573d447eb07388e5fb9ca884?f=pjson) and webmap license information explicitly restrict the hosted map to viewing and direct users to official PDF/GIS products. The [official GIS ZIP](https://pubs.usgs.gov/sim/3464/sim3464_database.zip) HEAD returned 200 with length **349,336,873 bytes**; it was not downloaded. Official metadata lists a GIS-software viewing requirement. Reuse/redistribution and analytical use of a derived clip require the actual official package/license review before an implementation relies on them; public query access is not an unrestricted license. [USGS copyright guidance](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits) returned 200, but does not override product-specific qualifications.

## Curiosity, Worldview and raw-gallery boundaries

Curiosity's page is dated **15 May 2019** and credits NASA/JPL-Caltech/ESA/University of Arizona/JHU-APL/MSSS/USGS Astrogeology Science Center. It describes a proposed ascent of lower Mount Sharp, with HiRISE, CRISM, CTX and HRSC source context. It is an animated illustration from a different rover/location, not an exported Jezero graph, astronaut route, DEM or current rover plan.

Worldview explicitly belongs to NASA's **Earth Science Data and Information System** and serves Earth satellite imagery. Earth near-real-time imagery must not be relabeled as Mars current conditions.

The gallery JavaScript uses this [public JSON endpoint](https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020,ingenuity&feedtype=json&ver=1.2&num=1&page=0); the saved example returned an image identifier, Sol, camera, caption, acquisition/receipt dates and exact credit. The returned example was acquired on 6 November 2026; retrieval does not make it live imagery. Its `xyz` was `(0.0,0.0,0.0)` and scale was `UNK`; no verified global map position or numerical terrain can be derived from those fields. This is a discovered public gallery implementation endpoint, not a separately verified stable API contract. Follow the per-image credit and [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/), which returned 200; preserve third-party credits and avoid endorsement claims.

## Current challenge/rules verification boundary

The exact [2026 challenge page](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/) and homepage failed normal TLS validation locally. Windows curl reported `SEC_E_UNTRUSTED_ROOT`; Node fetch failed. Two separately named public-page diagnostics disabled TLS checking, returned 200, and saved only a page shell. Their receipts explicitly say `tlsVerified: false`; **they are not authenticated current challenge/rules evidence**. No further disabled-TLS requests were made.

The remote internet connector also returned 502 on opening the challenge page, `/resources/`, `/2026/` and `/legal/`. It did return indexed official results: the challenge title; the 2026 participation page with registration, maximum six team members and project submission from 14 November at 09:00 to 15 November at 23:59 local time; and [2026 participant terms](https://www.spaceappschallenge.org/legal/) marked updated 7 August 2026, including citation and appropriate license documentation for all solution materials. These are **indexed primary-source excerpts**, with crawl recency retained in the saved connector responses, rather than successful direct-page retrieval.

The [official 2026 registration PDF](https://assets.spaceappschallenge.org/media/documents/2026_NASA_Space_Apps_Registration_Recruitment.pdf) was retrieved with valid TLS and HTTP 200. The connector's official PDF result supports the global **14–15 November 2026** dates and timeline. It is not the judging rubric or full submission guide.

The complete current challenge statement/resources, 2026 global judging rubric/weights, exact submission-field requirements and rules concerning pre-existing work or AI assistance remain **unverified**. Do not infer them from 2025 judging PDFs, staging pages, competitor projects or user-generated local-event schedules. The project's supplied specification supports prioritizing integrated Mars evidence and an explainable planning workflow, but this audit cannot certify competition eligibility or predict winning.

## Verification and handoff

Run from the repository: `node docs/evidence/challenge-resources-2026-11-13/verify-resource-evidence.mjs`.

The verifier checks every saved successful HTTP response against its receipt byte count/hash, keeps unverified-TLS diagnostics distinct, checks the three PNG signatures/dimensions and validates the sampled geology response's native Mars sphere WKT. This audit does not claim app builds, browser rendering, empirical co-registration, routes or scientific safety validation. Root owns the next-phase proposal and checkpoint.
