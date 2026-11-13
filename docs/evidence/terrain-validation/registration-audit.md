# Coordinate-registration prerequisites for numerical Jezero terrain

Read-only assessment performed on 13 November 2026 against REDLINE `main` checkpoint `b486eed`. Application code, map sources, dependencies and existing evidence were not edited. This assessment uses the project specification, Mars data integrity skill, current degree-display grid, three published feature references, and re-fetched primary metadata. It does not establish numerical DEM availability or run application/browser checks.

## Finding and scope

The existing preliminary imagery layer `Jezero_CTX_BlockAdj_dd` has an explicit, consistently rendered angular tile grid, but REDLINE has not established its precise native latitude convention, control network or fine registration to numerical terrain. Its service grid therefore cannot by itself authorize quantitative overlays or route placement.

The separately audited **controlled** CTX product `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0` has explicit planetocentric/east-positive coordinates, a spherical Mars 2000 projection and documented photogrammetric lineage. Its native label and geographic VRT support a reproducible coordinate transform. These facts belong to that controlled product; they must not be transferred to the currently mounted preliminary mosaic merely because the products depict Jezero.

The strongest honest next boundary is **numerical source inspection in its own documented coordinate frame**, with approximate reference inputs and explicit missing-support status. Quantitative routing drawn over the current imagery requires an additional registration decision and verification.

## Primary-source provenance and independent reference

The [controlled CTX FGDC metadata](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.xml) was re-fetched with HTTP 200 and stored as `registration-sources/controlled-ctx-fgdc.xml`. It describes:

- Stereo CTX DTMs produced in SOCET SET, then rigidly aligned to one another with Ames Stereo Pipeline `pc_align`, allowing translations only. The relatively aligned DTMs were subsequently aligned to the DLR/HRSC team's Mars 2020 **HRSC Level 5 DTM** as an independent reference.
- CTX numerical DTMs exported at **20 m/pixel**, with elevations in metres referenced to the **Mars 2020 IAU sphere, radius 3,396,190 m**. This is a reference-sphere height statement, not permission to label such values MOLA areoid elevation.
- The controlled orthoimage mosaic is at **6 m/pixel** and was orthorectified using those stereo DTMs. Image brightness values remain imagery and cannot substitute for numerical elevations.
- An average **9.6 m displacement among individual CTX images**, measured using IMCORR, and **3.8 m vertical co-registration among individual CTX DTMs after a 183.3 m vertical adjustment to HRSC**. The metadata compares the latter with an approximately 13 m theoretical HRSC vertical precision. These are **provider-reported processing/relative-registration metrics**, not an app measurement, a blanket absolute accuracy estimate, or proof of registration to Gazetteer MDIM 2.1 or REDLINE's preliminary CTX layer.
- A northwest image gap filled using a CTX image orthorectified to HRSC because no CTX DTM was generated there. Therefore the orthoimage envelope does **not** prove that a matching CTX DEM contains valid elevation everywhere inside that envelope. Numerical band masks/NoData must be tested independently.

The metadata credits Robin Fergason, Donna Galuszka, Trent Hare, David Mayer, Bonnie Redding and Ethan Smith, with USGS Astrogeology as publisher and [DOI 10.5066/P9GV1ND3](https://doi.org/10.5066/P9GV1ND3). Its publication metadata and processing date must not be represented as observation/acquisition times. The terms list no access or use constraints but preserve a USGS purpose-specific quality/no-warranty statement. The numerical DEM resource still needs its **own** label, provenance, footprint and encoding verification; an imagery metadata paragraph describing a related DTM is supporting lineage, not a complete numerical data contract.

The parallel numerical source audit subsequently retrieved the exact `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0` product and its own labels/FGDC metadata under `source-audit/`. Its native label gives 1596 × 1512, 20 m pixels, the same zero-origin sphere and projected upper-left as the controlled orthoimage. Its east outer bound is `77.6989751662947015°`, slightly narrower than the image because of its integer dimensions. The source audit reports all cells valid in the decoded payload; that is independent numeric inspection, not an inference from the image bounds. The numerical FGDC metadata also states metre heights relative to the 3,396,190 m sphere. The filename's `DeltaGeoid` token alone must not override that explicit statement or justify calling the values areoid elevation. See the source audit for unresolved datum interpretation and exact access results.

## Coordinate contract and checks actually performed

Primary [ISIS label](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.lbl), [PDS3 label](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0_pds3.lbl) and [geographic VRT](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0_dd.vrt) all returned HTTP 200. Stored copies and hashes appear in `registration-sources/http-receipts.json`.

The controlled orthoimage label specifies Mars, equal equatorial/polar radius 3,396,190 m, planetocentric latitude, positive-east longitude, signed 180° domain, equirectangular projection, central latitude/longitude 0°, 6 m projected pixels, dimensions 5322 × 5040 and projected upper-left corner `[4573663.250853, 1109693.140188]` m. Its PDS3 `LINE_FIRST_PIXEL` and `SAMPLE_FIRST_PIXEL` are one-based labels; these should not be confused with a zero-based browser array.

With angles in radians, the source's exact zero-origin/zero-standard-parallel sphere model gives `x = R × longitude`, `y = R × latitude`. A Node arithmetic check used the source projected corner, dimensions, spacing and radius as inputs, then compared against separately published geographic corners and VRT coefficients. It reproduced:

| Independent provider check | Computed result |
| --- | --- |
| Upper-left corner | `[77.16046545922367°, 18.721194481872804°]`, identical to the native label |
| Lower-right outer corner | `[77.699177613553°, 18.211027390963398°]`, agreement below `1e-12°` with the label |
| Positive x angular pixel step | `0.0001012236291486913°`, agreement below `1e-16°` with the VRT |
| Top-left cell center | `[77.16051607103824°, 18.721143870058228°]`, using half-pixel offsets |

`registration-sources/coordinate-checks.json` preserves exact inputs/results. This validates transform arithmetic and pixel convention **against provider geometry**, beyond self-consistent round trips. The corners are geometric source references, not physical landmark control points. No empirically observed MDIM/CTX/DEM landmark residual was measured.

[GDAL's geotransform tutorial](https://gdal.org/en/stable/tutorials/geotransforms_tut.html), fetched with HTTP 200, defines the upper-left **outer corner** at `(0,0)`, north-up raster row direction, the six-term affine transform, and the top-left pixel center at `(0.5,0.5)`. [PROJ's equirectangular documentation](https://proj.org/en/stable/operations/projections/eqc.html), fetched with HTTP 200, documents central meridian, origin latitude, true-scale latitude and false offsets. The simple formula above is restricted to this explicit spherical, zero-origin contract, not a generic Earth EPSG conversion or support for arbitrary Eqc parameters.

For later slope/distance calculations, 20 m spacing in a `lat_ts=0°` equirectangular projected x direction is not automatically 20 m physical east–west ground separation at Jezero latitude. On the documented sphere a parallel interval uses the cosine of latitude; at Belva's published 18.48° latitude, a 20 m projected x interval corresponds to approximately **18.969 m** along that parallel. This is a distortion illustration, not a validated terrain measurement. Use a documented Mars sphere distance or an appropriate local metric model for adjacent geographic cell centers, and state the horizontal reference surface. Never use OpenLayers' global degree multiplier as a latitude-independent distance calculation.

## Existing feature references: suitable only for approximate inspection

The three active records use USGS/IAU Gazetteer **MDIM 2.1** approximate centers, planetocentric latitude and positive-east longitude. The [USGS Mars coordinate guidance](https://planetarynames.wr.usgs.gov/Page/MARS/system) explicitly distinguishes this system from traditional planetographic/west-positive maps. The guidance and Gazetteer FAQ were re-fetched with HTTP 200, supplementing the already verified individual feature records.

All three centers are numerically inside the **controlled orthoimage's envelope**, as confirmed from its published geotransform. Their inclusion does not imply valid DEM cells or exact landmark placement. The source only publishes their center coordinates to two decimal places: a 0.01° north–south step on the chosen sphere is about **592.75 m**. Half that step is about **296.37 m**, but this is only the scale of rounding/quantization; it is **not** a positional uncertainty bound, reported accuracy or justified error bar. No rounding policy or landmark residual was supplied by the feature source.

These records are therefore appropriate as named **approximate/coarse geographic references** for independently qualified terrain inspection, if the numerical source has valid coverage. An app may report a sample at the supplied approximate coordinate while making clear it is not an elevation measurement of the named site as a whole. It must not describe the single selected 20 m cell as a precisely registered Jezero/Belva/Neretva science observation, landing site or traversable endpoint. Exact routing should instead use validated grid coordinates or new explicitly hypothetical grid-cell choices in the numerical source's frame, retaining the distinction from named centers.

## Gates before dependent quantitative planning

1. **Numerical product contract:** verify the exact DEM product and resource, type/band, sample bytes/endianness, scale/offset, height units/reference surface, dimensions/geotransform, no-data sentinel/mask and processing/resampling. Do not borrow those fields from the orthoimage or a similarly named DEM.
2. **Coordinate transformation:** validate source convention/domain/radii/projection parameters against labels, native GeoTIFF keys, independently published corners and geographic VRT/control information. Reject unsupported Earth authority defaults and metadata disagreements. Test north-up pixel centers, one-/zero-based indexing, bounds and longitude wrapping.
3. **Valid support:** fetch/decode actual numeric samples and masks at proposed reference inputs and along any candidate traverse. A bounding box alone is insufficient. Classify outside-raster and NoData separately, propagate nonfinite values, and never replace gaps with zero. Resampling must not fill or conceal missing cells implicitly.
4. **Registration for imagery overlays:** either use a deliberately selected controlled orthoimage with documented shared DEM lineage and test its pixel/corner mapping, or measure multi-point spatial residuals between the numerical source/controlled imagery and the current preliminary CTX. Preserve residuals and source point selection. Until that decision is made, keep current imagery as qualified visual context and do not claim routes follow precise depicted terrain. Provider relative registration must not be relabeled as MDIM 2.1 registration.
5. **Endpoint fitness:** approximate named centers need explicit precision limits. Quantitative route endpoints must map to valid source grid support; terrain uncertainty and snapping policy must be shown. Do not silently snap outside/no-data references to a nearby valid pixel.
6. **Metrics:** compute physical horizontal distances with the source Mars model, use valid numeric height differences with consistent vertical datum, and document whether slope is degrees or percent. Do not combine MOLA areoid heights and sphere-relative CTX heights without a validated conversion.

## Suggested implementation tests

- Pin the provider corner/VRT values above as independent sphere-transform fixtures; test the zero-standard-parallel scope and rejection of unsupported radius/projection metadata.
- Pin affine outer-corner versus pixel-center behavior using `(0.5,0.5)`, north-down rows, last valid cell center and east/south **exclusive** outer boundaries. Cover float-rounding policy explicitly rather than allowing accidental out-of-range indices.
- Test positive-east wrapping, signed/0–360 domains, latitude limits, axis reversal rejection and nonfinite inputs; retain existing coordinate validation.
- Use independent real DEM sample fixtures and source-byte hashes once the numeric candidate is decoded. Test NoData, all-missing windows, outside coverage, unsupported encoding, truncated Range responses, and source-request failure.
- Verify known sphere-distance cases, latitude-dependent east–west spacing and nonzero diagonal distance; synthetic calculation fixtures must remain test-only. If metrics are not implemented in this milestone, avoid exposing values as accepted route outputs.
- Keep arithmetic registration tests distinct from landmark-overlay acceptance and empirical accuracy. A round-trip test or similar-looking image does not prove cross-dataset co-registration.

## Access/verification limitations

Eight small metadata/documentation resources were re-fetched successfully. Response timestamps, exact URLs, bytes, SHA-256 hashes, content types and CORS headers are in `registration-sources/http-receipts.json`; resources on the USGS S3 and Gazetteer hosts returned no CORS header in these CLI responses. No browser-origin fetch was performed, so frontend usability is not inferred. No numerical DEM was downloaded/decoded by this subtask, no actual terrain measurements or routing were produced, and no app tests/build were run. Root owns candidate selection, numerical verification, browser testing and milestone checkpointing.
