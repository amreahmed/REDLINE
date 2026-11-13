# NASA resource assessment and completion strategy — 13 November 2026

The user supplied an updated challenge-resource list and asked REDLINE to make useful use of it. The strongest product direction is one complete, explainable Jezero planning journey: explore compatible Mars layers, inspect cited science context, choose valid hypothetical endpoints, compare genuinely computed terrain tradeoffs, and produce a reproducible mission report.

This is a product recommendation based on the project specification and source audit. It is not a verified official judging rubric, a claim that every listed resource must be integrated, or a prediction of an award.

## Resource roles

| Resource | Useful role in REDLINE | Evidence boundary |
| --- | --- | --- |
| [JPL Mars Trek](https://trek.nasa.gov/mars/) | Primary imagery delivery and multi-mission context. Existing MGS/MOLA and MRO/CTX sources already work. Add the specifically audited controlled CTX mosaic as the next compatible source. | Imagery is not numerical elevation. Recheck exact layer geometry, coverage, resolution, provenance and browser access; each product keeps its own contract. |
| [USGS-NASA Mars interactive geology maps](https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars) | Source-backed geologic interpretations and legend/source explanations. A Jezero map is directly relevant to the selected region. | The Hub is an index. Jezero SIM 3464 uses a different projection and earlier semi-controlled mosaic, with documented ~100–200 m offsets relative to newer controlled imagery. Its web-map terms say viewing purposes only; analytical work points to official GIS products. |
| [Perseverance raw images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | A few curated rover-observation cards, retaining exact image ID, instrument/camera, observation date or sol, credit and source links. Ground the science story in observations. | A raw camera image does not provide a registered Mars map location, DEM, hazard detector or safety measurement. Use verified location context only; metadata/product dates must not be invented. The gallery/API is an external dependency requiring its own stable-contract and failure checks before integration. |
| [Curiosity's proposed Mount Sharp path](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/) | Reference for an understandable route story: annotated destinations, terrain context and a clear explanation of the planning objective. | This is a proposed Curiosity/Gale example. It is not a Jezero path, an astronaut traverse, or an output of REDLINE's route engine. Keep any future Gale case separate. |
| [NASA Worldview](https://worldview.earthdata.nasa.gov/) | Inspiration for layer discovery, comparison and time/status communication. | NASA Earthdata describes it as an Earth-observation viewer. Its Earth imagery is not a Mars basemap, Mars weather feed or Jezero hazard layer. A source appearing on the resource list does not change its planetary coverage. |

All five supplied resource URLs returned HTTP 200 in the source audit. HTTP access alone is not evidence of usable geospatial data or browser acceptance. Saved source receipts, extracted metadata, service responses and verification are under `docs/evidence/challenge-resources-2026-11-13/`.

Verification: `node docs/evidence/challenge-resources-2026-11-13/verify-resource-evidence.mjs` exited 0, checking 36 authenticated response hashes, two separately marked diagnostic hashes, three 256×256 PNG tile contracts and one native Mars geology response. `npm run lint` also exited 0. This document/audit adds no application integration or new route capability.

## Concrete compatible next source

Mars Trek advertises **`JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0`**, UUID **`32003f69-a6f6-4441-bb46-4c46689c42eb`**, through its actual layer-service response. Its [WMTS capabilities](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/WMTSCapabilities.xml) were fetched successfully. The native controlled image labels share the selected DEM's sphere, zero-origin projection, upper-left projected corner and processing lineage, while pixel spacing/dimensions differ.

That is a stronger basis for the next placement milestone than transferring the controlled product's properties onto the currently mounted preliminary CTX. The app must still verify tile-to-native geometry, coverage and browser behavior; shared lineage does not establish absolute accuracy or Gazetteer registration.

## Jezero geology qualification

Sun, V.Z., and Stack, K.M. (2020), **Geologic map of Jezero crater and the Nili Planum region, Mars**, USGS Scientific Investigations Map 3464, scale 1:75,000, [DOI 10.3133/sim3464](https://doi.org/10.3133/sim3464).

The audited [web map](https://usgs.maps.arcgis.com/home/item.html?id=137eebf467514082a27c03c88b5ffe58) points to the [geologic unit FeatureServer layer](https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Jezero_FeatureServiceFromPro/FeatureServer/8). Its spatial model is a Mars sphere Transverse Mercator with central meridian 77.5°, scale 1, R=3,396,190 m. It cannot be passed through Earth/Web Mercator defaults or the DEM's equirectangular formula.

The [official metadata](https://pubs.usgs.gov/sim/3464/sim3464_metadata.xml) states that mapping used the semi-controlled mosaic before July 2020's controlled product and documents random offsets of about 100–200 m relative to surface-operations CTX. Therefore use it first as cited interpretation context with its limits shown. Any analytical unit sampling, geometry reuse or cross-layer science preference needs separately checked official GIS terms, transforms and registration. Geologic unit categories alone do not establish walking hazards or a science-value score.

## Priority order for completion

1. **Controlled imagery and continuous terrain support:** validate source placement and a bounded connected native DEM crop; allow distinct hypothetical valid grid endpoints. The current 2,821 inspected cells occupy three separate windows, and approximate Gazetteer centers are not precise traverse endpoints.
2. **Computed route comparison:** verify physical Mars horizontal distances and slope, explicit NoData propagation and documented nonnegative graph costs. Start with shortest and lower terrain cost. Explain calculated metrics and preference tradeoffs; introduce balanced/science modes only when their model is grounded.
3. **Science explanation and report:** add a small curated observation/geology narrative, then export or print endpoint/route geometry, genuine metrics, weights, source product IDs and limitations. Keep evidence near the decision it supports.
4. **Demo and submission:** verify current official requirements, then finish the deployment and required project materials. Demonstrate the complete journey in roughly two minutes, with one visible route tradeoff and an honest evidence report.

The executable placement milestone is [controlled Jezero grid plan](superpowers/plans/2026-11-13-controlled-jezero-grid.md). These tasks are pending, not implemented by the resource audit.

## Current checkpoint and verification boundary

Checkpoint **`7b4137a feat(terrain): validate Jezero numerical source windows`** implements numerical source inspection, native sampling/integrity validation and working load/retry behavior. Lint, typecheck, 223 tests, production build, source-hash checks and isolated development/production browser checks passed. [Terrain verification](terrain-validation.md) records actual evidence and remaining limitations. No synthetic terrain, routes or safety probabilities are displayed.

The local client could not authenticate a direct TLS connection to the current Space Apps challenge/home pages. A separately marked TLS-disabled diagnostic copy is retained only as diagnostic evidence; it is not proof of current official rules. Remote indexed official content and a separately authenticated current official asset are supplemental evidence, not a complete live challenge/rules review. Recheck the exact challenge and full participant/submission rules through a normally authenticated connection before claiming submission readiness. No account changes, publishing or project submission occurred.

The complete current judging rubric, submission-field requirements and rules concerning pre-existing work or AI assistance remain unverified. The audit deliberately does not substitute prior-year or local-event guidance for those requirements. Its [detailed source assessment](evidence/challenge-resources-2026-11-13/audit.md) retains exact URLs, access outcomes and qualifications.
