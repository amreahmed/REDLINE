# Height-reference resolution and alternative controls — 14 November 2026

This investigation builds on the 13 November exact-FGDC and coarse-MOLA audit without repeating those thirteen source downloads. It preserves the production CTX TIFF, manifest, all 65,536 cropped cells, and existing endpoint interactions. **The exact CTX absolute datum remains conflicted.** New input metadata and much finer paired HRSC controls strengthen that conclusion and provide a feasible, explicitly documented reference for the next scientific comparison.

## New evidence for the current CTX product

The preserved production product is `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0`. Existing provider metadata says its metre elevations refer to the IAU sphere radius 3,396,190 m. This investigation found:

- Its actual TIFF has only `AREA_OR_POINT=Area` metadata and the horizontal sphere/projection CRS, with no vertical keys or processing history. Normal HTTPS requests for its external `History.IsisCube` and TIFF `.aux.xml` both returned **404**. The errors and exact URLs are saved; their names were derived from the existing label pointer/sidecar conventions rather than treated as real available resources.
- All three archived individual CTX DTMs in the documented mosaic lineage have embedded **`GEOID=mola`** metadata. The F05 sidecar independently repeats it. Their scales are 1, offsets 0, native float32 spacing 20 m, and NoData is **−32768**, which differs from the mosaic's sentinel. Their origins differ from the final mosaic; they are not interchangeable arrays.
- At seven pinned production-grid fixture positions, nearest native J03 input samples differ from the final mosaic by less than 0.65 m. Other component values and missing samples are explicitly recorded in `alternative-contracts.json`. This is evidence of numerical source lineage, not a reconstruction of final mosaicking/registration.
- The archived metadata does not preserve the final geoid operation direction or version. The inspected ASP `dem_geoid` source writes a `GEOID` key in either forward or reverse adjustment, so that key alone cannot prove the output reference. The current public source code is explanatory evidence, not proof of which tool/version produced the 2019 output.
- The new primary 2021 Jezero stratigraphy paper uses the exact CTX product and describes areoid-based HRSC elevations, but does not supply the missing exact-product processing equation/sign. Its geographical/stratigraphic context does not override the contradictory CTX FGDC.

No final CTX datum conversion or relabelling is justified by these facts alone. A producer processing record or confirmation for this exact TIFF must define final vertical surface/model, positive-up sign, and geoid adjustment direction/version; then a same-reference comparison must verify it.

## Paired HRSC reference: feasible and numerically inspected

The [HRSC team MC13E page](https://hrscteam.dlr.de/public/data/HMC30/quads.php?quad=mc13e) and readme explicitly offer paired DT5 and DA5 products. Their actual GeoTIFF vertical keys are stronger evidence than a mapping sphere or filename:

| Contract | `HMC_13E10_dt5.tif` | `HMC_13E10_da5.tif` |
| --- | --- | --- |
| Vertical citation, key 4097 | Height above spheroid with radius **3396.0 km** | Height above equipotential surface described by **GMM3**, PDS dataset **MGS-M-MOLA-5-MEGDR-L3-V1.0** |
| Vertical units, key 4099 | Metres (9001) | Metres (9001) |
| Data | Signed little-endian int16, scale 1/offset 0 | Same |
| Native spacing | 50 × 50 m projected | Same |
| NoData | −32768 | Same |
| Dimensions | 13,336 columns × 17,782 rows | Same |
| Horizontal model | Equirectangular, standard parallel/central longitude 0; **3,396,000 m** sphere | Same |
| Native upper-left edge | X 4,000,775 m, Y 1,778,175 m | Same |
| Exact resource size | 638,313,017 bytes | 638,313,147 bytes |

Both native raster bounding extents contain all four outer corners of the preserved Belva prototype crop. This is **bounding coverage**, not proof of full valid interior coverage. Nine paired control positions sampled inside the crop are valid in both products. Full per-cell coverage/mask validation remains necessary for any further quantitative integration.

Exact data URLs:

- [HRSC sphere-height DT5](https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_dt5.tif)
- [HRSC areoid-height DA5](https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_da5.tif)
- [HRSC readme](https://hrscteam.dlr.de/public/data/HMC30/MC13E/AA_README_HMC30.txt)
- [HRSC product tiling and names](https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC30_tiling_scheme_and_file_naming.pdf)

The server supports correctly bounded **HTTP 206** requests. Full 638 MB files were not downloaded. The TIFF directory is near each file's end, so the initial 64 KiB header alone cannot open the raster. Receipt-backed requests for that directory, pointed metadata/strip tables and individual native samples resolved this access issue. Every successful numerical response records its exact requested interval, total resource length, response timestamp, byte count and SHA-256.

## Nine current-grid comparisons

`hrsc-control-comparison.json` uses all seven pinned native grid fixtures plus two additional audit-selected native cells, **row 600/column 600 and row 820/column 760**. The additional selections are explicitly labelled audit locations, not landmarks or independent positional controls. Their values come from the hash-verified existing production binary, without interpolation.

Each source cell centre is converted to the HRSC horizontal frame using the HRSC sphere radius 3,396,000 m, preserving the degree coordinates and axis conventions. Ignoring the 190 m radius difference in the projection would select different pixels. Native nearest-cell samples are read directly from signed-int16 strips; no new DEM, resampling, corrected CTX cell or route input is produced.

| Across all nine probes | Difference |
| --- | --- |
| CTX sample minus HRSC DA5 areoid height | **−65.27978515625 to +3.45458984375 m** |
| CTX sample minus HRSC height above the app's 3,396,190 m sphere | **+1621.72021484375 to +1695.42138671875 m** |

The second comparison uses the explicit reference equation `heightAbove3396190Sphere = DT5 − 190 m`. This is arithmetic to compare named reference surfaces; the production CTX samples are not transformed. DT5 and DA5 remain separately recorded as original native integers. At the current centre fixture (source row 714, column 650), CTX is −2489.27978515625 m, HRSC DT5 is −3921 m, and HRSC DA5 is −2424 m.

The pair implies local areoid radii of 3,394,495–3,394,511 m at the audit points, varying across the crop. An unresolved datum therefore cannot simply be assumed to differ by a harmless constant. The source's areoid-like numerical values are reinforced, but the exact final CTX transformation is still not established.

These comparisons are **not CTX accuracy bounds**. HRSC and CTX have different native resolutions/support; a 20 m CTX post and nearest 50 m HRSC post have different centres, and the HRSC product is itself part of the CTX control lineage. Agreement does not make HRSC independent ground truth, establish named-feature registration, or prove astronaut/rover traversability. The −65 m centre comparison is preserved rather than hidden or reclassified as a known terrain error.

## Other candidate DEMs

- **Individual CTX source DTMs:** direct numerical access and MOLA-geoid metadata are now inspected. They are same-lineage inputs with native NoData and differing origins, so they cannot serve as independent absolute validation or silently replace the preserved crop.
- **USGS-served HiRISE Socet DTMs:** the collection linked by the documentation (`mro_hirise_controlled_socet_dtms`) now returns 404. The live official collection list exposes `mro_hirise_socet_dtms`; querying its intersection with the preserved crop returns two real products, `DTEEC_045994_1985_046060_1985_U01` and `DTEEC_002387_1985_003798_1985_A01`. Their bounding boxes start east of the crop's western edge (77.3834° and 77.3441° respectively versus crop 77.33659°), so neither covers the entire crop. They may offer partial checks but do not replace all 65,536 cells. Their STAC numerical band units are empty, so nominal ~1 m spacing and DTEEC naming/HiRISE SIS do not complete an exact asset's vertical contract. No HiRISE data was numerically integrated or declared validated.
- **JPL Science Investigation CTX mosaic:** the previously audited larger 20 m mosaic remains a separate product with a different extent/projection and incompletely specified vertical contract. Its broader coverage does not fix the exact production TIFF's missing datum definition. No repeat download or replacement occurred.

## Supported use and next gate

Reference-sphere Mars distances and explicitly qualified **provider-height-relative grades/cost models** remain distinct from physically validated terrain slope or safety metrics. The new evidence does not enable a physical slope, an absolute named-feature elevation, route comparison, hazard claim or safety probability. A supported relative grade simply describes a difference between current provider samples over a documented horizontal baseline; it is not a validated local gravity-referenced slope.

The paired HRSC assets provide a feasible numerical reference with an explicit positive-up height definition and GMM3 areoid identity. Before using them to resolve the production datum, validate complete native coverage, document registration/support tolerances, compare matching spatial support, preserve processing provenance and obtain the missing exact CTX final-height equation. If a new HRSC-derived surface is considered later, it must remain a separate versioned dataset; upsampling 50 m samples cannot preserve or improve 20 m measured detail.

## Reproduce without mutating saved evidence

From the repository root:

```powershell
node docs/evidence/scientific-resolution-2026-11-14/height/fetch-new-evidence.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/probe-hrsc-headers.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/inspect-hrsc-ranges.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/sample-hrsc-controls.mjs --verify-saved
uv run --with rasterio --with numpy python docs/evidence/scientific-resolution-2026-11-14/height/inspect-alternatives.py --verify-saved
```

All `--verify-saved` commands only read and validate existing bodies/results. Unqualified fetch/probe commands perform normal HTTPS requests and save new audit evidence. No personal browser, TLS bypass, producer contact, production terrain transformation or app-code edit was used by this investigation.
