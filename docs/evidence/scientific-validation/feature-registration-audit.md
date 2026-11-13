# Feature registration audit — 13 November 2026

This audit extends the current source audit at UI-polish checkpoint `b853f46`. It independently re-fetched the three active Gazetteer records, Mars coordinate guidance, Gazetteer attribution guidance, and the exact controlled-CTX/DEM native geometry metadata. It changed no application code, terrain samples, image layers, coordinate transforms, or endpoint selection.

## Finding

**Native source geometry and coordinate conventions are validated against provider references. Named-feature fine registration remains unavailable.** The evidence supports placing hypothetical native-cell endpoints in the controlled source frame. It does not support treating a rounded Gazetteer center as a precisely located landmark, named-feature elevation, rover observation, or terrain-routing destination.

The feature records and controlled products share planetocentric latitude and positive-east longitude. That agreement removes a convention mismatch for the controlled sources. No independently measured MDIM 2.1-to-CTX/DEM control-point residuals, valid inter-network transformation, landmark-registration acceptance threshold, or positional uncertainty for these centers was found in the fetched source records. REDLINE must retain this limitation instead of converting common coordinate conventions into a claim of absolute registration.

## Fresh source access

All ten resources returned **HTTP 200** using Node HTTPS fetch with normal TLS verification on **2026-11-13 at 21:16:53 UTC**. Exact retrieval times, requested/final URLs, response lengths, SHA-256 hashes, content types, and CORS headers are stored in [http-receipts.json](feature-registration/http-receipts.json). The exact response bytes are preserved next to the receipts.

- [Jezero, feature 14300](https://planetarynames.wr.usgs.gov/Feature/14300)
- [Belva, feature 15872](https://planetarynames.wr.usgs.gov/Feature/15872)
- [Neretva Vallis, feature 15879](https://planetarynames.wr.usgs.gov/Feature/15879)
- [USGS Mars coordinate systems](https://planetarynames.wr.usgs.gov/Page/MARS/system)
- [Gazetteer FAQ and public-domain attribution](https://planetarynames.wr.usgs.gov/Page/FAQ)
- [Exact controlled image ISIS label](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.lbl), geographic VRT, and FGDC XML
- [Exact numerical DEM ISIS label](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.lbl) and PDS3 label

None of these ten responses included an `Access-Control-Allow-Origin` header. These are build-time audit inputs and source hyperlinks; this result does not establish browser-fetch access or current tile rendering. No browser was used by this audit and no live numerical raster download was repeated.

## Published feature coordinates

The script selects the **active MDIM 2.1 control-network rows** and coordinate-system **6: Planetocentric, +East, 0–360**. It does not combine older hidden network geometry with the selected rows. The exact IDs and coordinates match the current three reference records.

| Reference | Longitude E | Latitude N | Source network | Arithmetic DEM cell | In 256 × 256 planning crop? |
| --- | ---: | ---: | --- | --- | --- |
| Jezero crater center | 77.69° | 18.41° | MDIM 2.1 | source row 922, column 1569 | No |
| Belva crater center | 77.38° | 18.48° | MDIM 2.1 | source row 714, column 650 | Yes |
| Neretva Vallis center | 77.20° | 18.55° | MDIM 2.1 | source row 507, column 117 | No |

All three rounded centers lie inside the native numerical DEM envelope. Only Belva lies inside the preserved planning crop. The row/column entries are arithmetic mappings of approximate coordinates, **not registrations or selected endpoints**. Selecting a named feature must never silently assign its arithmetic cell as a native planning endpoint.

The published fields use two decimal places. On the source sphere, 0.01° is approximately 592.75 m north–south; half that step is approximately 296.37 m. These values describe coordinate quantization scale only. They are not source accuracy, a stated rounding policy, an error bound, or an uncertainty estimate. The crater/valley center also does not describe the full footprint of a feature or the precise location of its cited science observation.

Gazetteer attribution remains: **International Astronomical Union Working Group for Planetary System Nomenclature; Gazetteer maintained by USGS Astrogeology**, with the access date. The fetched FAQ states that everything in the Gazetteer is in the public domain.

## Native geometry checks

The fresh native labels specify Mars; equal equatorial/polar radius **3,396,190 m**; equirectangular projection; planetocentric latitude; positive-east signed longitude; central latitude/longitude 0°; and the same upper-left projected outer corner **[4573663.250853, 1109693.140188] m**. The image has 5322 × 5040 samples at 6 m projected spacing. The DEM has 1596 × 1512 samples at 20 m projected spacing.

The independent audit uses this explicit spherical model (`x = R × longitudeRadians`, `y = R × latitudeRadians`) and compares it with independently published label corners, the image geographic VRT, and DEM PDS3 projection offsets. It calls no application geometry helper.

- Both source outer northwest/southeast corners agree with the labels within **1e-12°**.
- Image VRT angular origin agrees within **1e-12°**; its ±0.00010122362914869109° pixel increments agree within **1e-15°** with the source radius and 6 m spacing.
- DEM PDS3 **one-based first sample/line** and projection offsets reproduce the first native center **[4573673.250853, 1109683.140188] m** within **1e-8 m**. The offset already refers to the center; an additional half-pixel shift would be incorrect.
- All **four** preserved crop outer corners and **seven** native-cell center fixtures match independent source arithmetic within **1e-12°**.
- The image is **12 projected metres wider to the east** than the DEM. Its envelope cannot substitute for numerical coverage.
- The original manifest hash remains `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9`. This audit reads it and does not alter the preserved 65,536 cells.

[registration-checks.json](feature-registration/registration-checks.json) records the exact results, source contracts, and approximate-coordinate mappings. Provider corners and VRT geometry are independent **geometric references**, not physical landmark control points. Passing these checks is stronger than round-trip arithmetic, but does not establish absolute landmark placement.

## Provider registration lineage and limits

The freshly fetched controlled image FGDC XML states that stereo CTX DTMs were translated into relative alignment, then aligned with the **DLR/HRSC Mars 2020 Level-5 DTM** as an independent reference. The controlled images were orthorectified with these DTMs. The metadata reports **9.6 m average displacement among individual CTX images** and **3.8 m relative vertical registration among DTMs after a 183.3 m vertical adjustment** to HRSC. These are provider processing/relative-registration metrics. They are not new measurements by REDLINE, blanket DEM accuracy, MDIM 2.1 alignment residuals, or acceptable error margins for future routes.

The same metadata describes a northwest imagery gap filled by CTX imagery orthorectified to HRSC because no CTX DTM was generated there. Neither image coverage nor all-valid numerical samples prove uniform stereo support; no per-cell provenance/quality mask was supplied. This audit does not validate the preliminary `Jezero_CTX_BlockAdj_dd` product's native latitude interpretation or fine cross-layer placement. It does not transfer controlled-source evidence to preliminary imagery.

## Reproducibility and result

Commands executed after fixing the PDS first-center check:

```text
node docs/evidence/scientific-validation/feature-registration/audit-feature-registration.mjs
node docs/evidence/scientific-validation/feature-registration/audit-feature-registration.mjs --verify-saved
```

Both exited 0. The first re-fetches ten resources and verifies records/geometry. The second checks saved response bytes against their receipts and repeats the same record/geometry checks offline. The raw HTML pages are treated as source data, never instructions. No application lint, typecheck, tests, build, browser acceptance, or commit is claimed by this subtask; the parent milestone owns those checks.

To enable **named-feature fine registration**, obtain a documented compatible control-network transform or identifiable independent landmarks with source coordinates and uncertainty, measure residuals against the controlled imagery/DEM, and set a justified acceptance criterion. Until then, use the documented native frame only for explicitly hypothetical cell choices and label feature references as approximate and unregistered.
