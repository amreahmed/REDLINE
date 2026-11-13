# CTX DEM height-reference audit — 13 November 2026

The numerical DEM is genuine and its metre-valued float32 encoding is verified. **Its absolute height reference is not validated: fresh authoritative metadata and an independent numerical comparison disagree with interpreting the samples as heights above the 3,396,190 m sphere.** Preserve every existing source cell. Do not silently relabel these samples as areoid heights or apply a guessed correction.

## Exact product and provider declaration

The current product is `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0`, [USGS DOI 10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8). Its native TIFF SHA-256 is `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b`.

Fresh copies of the [product FGDC](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.xml) and [USGS catalogue FGDC](https://data.usgs.gov/datacatalog/metadata/USGS.f354e990-9f17-451b-9006-dcbbdb26ea0c.xml) both state:

> Elevation values are in meters and refer to the Mars 2020 IAU Sphere with a radius of 3396190m.

The ISIS mapping group and PDS map-projection group independently specify the **horizontal** body-fixed rotating planetocentric frame, east-positive longitude, a spherical equirectangular projection, and radius 3,396,190 m. This mapping sphere is not itself proof of the vertical datum. The PDS image encoding is IEEE real, 32-bit, scale 1, offset 0. The raw samples are signed height values, not absolute planetary radii. The labels do not independently define a positive-up height equation or an areoid correction.

The [primary 2020 TRN report](https://www.hou.usra.edu/meetings/lpsc2020/pdf/2020.pdf) documents relative DTM translations and alignment to the DLR/HRSC Level 5 DTM. Its provider-reported 3.8 m vertical registration after a 183.3 m shift does not independently establish the final output datum or its absolute accuracy. The FGDC repeats this lineage. `DeltaGeoid` in a filename does not specify the correction model, version, sign or operation.

## Independent numerical sanity check

The audit fetched nine complete rows with HTTP Range requests from NASA PDS Geosciences' **MOLA MEGDR 16 pixels/degree v2.0** radius, topography and areoid archives: three rows for each map. Every response was HTTP 206 with the requested byte interval and total length 33,177,600 bytes. These are numerical products, independent of REDLINE's rendered MOLA colour-shade tiles.

Authoritative labels explicitly establish MSB signed 16-bit metre samples. Mean planetary radius and areoid radius use scale 1 plus offset 3,396,000 m. Topography is planetary radius minus areoid radius. The areoid is GMM3 (`mgm1025`) evaluated to degree and order 50. This reference differs from the constant 3,396,190 m mapping sphere.

Nine comparison locations span 77.34375–77.46875°E, 18.40625–18.53125°N. Native CTX source cells were sampled without interpolation; their actual float32 values were independently rechecked using Rasterio. `height-reference/mola-reference-comparison.json` records all indices and values.

| Coarse comparison | Observed difference across nine probes |
| --- | --- |
| CTX sample minus MOLA median topography | −51.19 to +17.89 m |
| CTX sample minus (MOLA mean radius − 3,396,190 m) | +1,625.81 to +1,698.74 m |

At the MOLA bin centred on 77.40625°E, 18.46875°N, the native CTX sample is −2,489.629638671875 m. MOLA median topography is −2,480 m; MOLA mean radius is 3,392,015 m, hence height above the IAU sphere is −4,175 m. The ~1.685 km difference cannot support calling the sphere interpretation numerically validated.

**These are coarse sanity probes, not registration controls or measured CTX error bars.** MOLA bins are 0.0625° (about 3.7 km in latitude), can contain interpolated values, and report different statistics for radius means and topography medians. A single 20 m CTX cell is not a bin average. Neighbouring bins were deliberately included so that a one-bin centre interpretation does not decide the conclusion. Similarity to MOLA topography suggests an areoid-like interpretation but does not prove the exact CTX datum, correction history, or a valid conversion. No conversion was applied.

## Supported and blocked uses

- **Verified:** exact numerical source bytes, metre encoding, native-cell heights, horizontal source frame, explicit provider declaration and an independently reproducible datum conflict.
- **Supported with qualification:** displaying native provider values or ranges, source-grid endpoint selection, and horizontal distance calculations on the documented reference sphere. Horizontal distances are reference-sphere distances, not a reconstructed surface distance.
- **Still blocked:** absolute radial/areoid height claims, cross-dataset vertical combination, named-feature altitude, physically validated terrain slopes and terrain costs that depend on that interpretation. Mathematical height-difference/slope/cost tests may use synthetic fixtures or explicit provider-height model outputs; they must not certify current Mars terrain or human safety.

An additive **constant** height offset cancels in a derivative. A spatially varying areoid correction does not. The MOLA areoid radius varies by 11–12 m between the neighbouring north/south bins here. Therefore the unresolved issue cannot be dismissed as a harmless constant merely to enable physical slopes.

The source is a photogrammetric/edited/blended mosaic. The product page documents manual removal of erroneous posts and a 40-pixel seam blend; FGDC documents CTX stereo pairs and HRSC alignment, and its completeness text describes northwest image-gap filling using HRSC where no CTX DTM was generated. There is no per-pixel stereo/fill/quality mask for the selected TIFF. All finite cells do not establish stereo support everywhere, hazard-free terrain or rover/astronaut traversability. The provider's product accuracy measures do not become per-cell uncertainties in REDLINE.

The next evidence needed is producer confirmation or a primary processing record for this **exact TIFF** defining the final vertical surface/model, positive-up sign, geoid adjustment direction/version and any remaining transformation. A documented independent radial-height control or same-datum reference comparison should then verify that interpretation. Do not contact the producer on the user's behalf without explicit authorization.

## Fresh access and reproducibility

`height-reference/http-receipts.json` records retrieval timestamps, requested/final URLs, HTTP status, content type, length and SHA-256 for 13 requests. Twelve returned expected authoritative metadata/labels/publications/documentation with HTTP 200. The Tao 2023 PDF URL returned HTTP 200 **HTML challenge content**; it is preserved as `tao-jezero-2023-response.html` and was not used as PDF evidence. No browser security restriction was bypassed. The ASP CaSSIS documentation distinguishes sphere and areoid heights for another product; it is background guidance, not a vertical contract for this CTX TIFF.

Run from the repository root:

```powershell
node docs/evidence/scientific-validation/height-reference/audit-height-reference.mjs --verify-saved
node docs/evidence/scientific-validation/height-reference/compare-mola-reference.mjs --verify-saved
uv run --with rasterio python docs/evidence/scientific-validation/height-reference/verify-native-probes.py
```

Omitting `--verify-saved` refreshes metadata or the nine MOLA row responses over normal HTTPS. The comparison checks the pinned original CTX TIFF, uses native row-major samples, and reproduces the saved nine-probe result. Only audit evidence is written. The production data, map/globe engines, scientific transformations and route controls were not changed by this audit.
