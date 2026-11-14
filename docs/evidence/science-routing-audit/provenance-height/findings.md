# Provenance and height-reference audit — 15 November 2026

The current application's numerical grid is a preserved **CTX DEM crop**, not the requested HiRISE product. All **65,536 float32 cells** independently match the original TIFF's bytes, with **zero differences and zero native NoData/nonfinite samples**. This establishes source-to-grid preservation. It does not validate the final CTX height datum, measured stereo support, physical slope, terrain costs, hazard absence, or human safety.

The exact requested HiRISE DTM has a complete product-specific PDS label defining metres above the Mars 2000 equipotential datum. Its footprint is **east of, and does not overlap, the current CTX crop**. That stronger height definition cannot be transferred to the existing grid.

## Actual production provenance

| Stage | Verified identity and processing |
| --- | --- |
| Provider product | `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0`, USGS [DOI 10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8), [exact TIFF](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif) |
| Pinned original | `docs/evidence/terrain-validation/source-audit/<product>.tif`, 9,662,387 bytes; SHA-256 `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b` |
| Source raster | 1596 columns × 1512 rows, single-band little-endian IEEE float32, uncompressed one-row TIFF strips; scale 1, offset 0 in PDS/ISIS labels |
| Source horizontal frame | Planetocentric, east-positive, signed-180 longitude; equirectangular standard parallel and central meridian 0°, mapping sphere 3,396,190 m; origin X 4,573,663.250853 m / Y 1,109,693.140188 m; 20 m projected spacing |
| Extraction | `scripts/prepare-terrain-grid.py`: columns 522–777 and rows 586–841 inclusive, no resampling/interpolation/datum conversion; source mask/sentinel checked before encoding |
| Application artifact | `public/data/jezero-terrain-grid.f32`, 256 × 256, row-major little-endian float32, 262,144 bytes; SHA-256 `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8` |
| Application manifest | `public/data/jezero-terrain-grid.json`, SHA-256 `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9`; explicitly `provider-declared-iau-sphere-unvalidated` |
| Independent comparison | `verify-provenance.mjs` parses the original TIFF IFD and directly compares each of the 65,536 four-byte source samples with the binary; no Rasterio, preprocessing or application helpers |

The outer bounds are west **77.33659457394239°**, east **77.42297207081594°**, south **18.437093496062143°**, north **18.523470992935692°**. These are crop cell edges, not named-feature control points or measured feature boundaries. The retained provider-value range is **−2560.28857421875 to −2363.345703125 m**. This is not independently validated altitude.

The existing source-grid registration audit additionally records metadata/geometry and rendered-tile coverage. Its results are reused as context; this lane performed a fresh independent all-cell byte check rather than rerunning the older script, which writes outside this lane even in its saved mode. The production preparation script was read, not executed, because running it would overwrite production artifacts.

### Versions, masks and support

The exact source bytes are pinned by SHA-256. `soc_008` in the identifier is not a recovered complete processing/version contract. The previous receipt-backed public inventory found four current exact-product objects, no final processing record, DOI version `null`, and publicly inaccessible S3 version history. S3 object dates of 10 November 2022 indicate storage modification, not a validated scientific revision.

The original TIFF's NoData sentinel is **−3.4028226550889045e38**. The crop contains no such sentinel or nonfinite values. The independent TIFF inspection finds one IFD, one band, no ExtraSamples/SubIFD mask, no vertical GeoKeys 4096–4099, and no GDAL metadata giving a final vertical equation. This corroborates the previously inspected final asset; it is not proof that every possible upstream quality file was released or examined.

The provider describes a photogrammetric product with edited posts, mosaicking/blending and HRSC gap filling. No per-cell stereo/fill/quality classification is present in the inspected final artifact or established by these checks. Finite posts can include edited, blended or filled values; they must not become measured stereo-support or low-risk classifications. Individual source DTMs have a different **−32768** sentinel and different origins, so their arrays and masks are not interchangeable with the final mosaic.

## Candidate requested HiRISE product

[Official page](https://www.uahirise.org/dtm/ESP_023524_1985) returned HTTP **200**. The page's exact [DTM link](https://www.uahirise.org/PDS/DTM/ESP/ORB_023500_023599/ESP_023524_1985_ESP_023379_1985/DTEEC_023524_1985_023379_1985_U01.IMG) returned HTTP **206** for `bytes=0-65535`, with `Content-Range: bytes 0-65535/700271460`. The complete attached label is **4,305 bytes**, ending at standalone `END`; the full 700,271,460-byte image was not downloaded or numerically integrated. Fetches used standard Node HTTPS/TLS verification, with no browser operation or security bypass.

| Label field | Product-specific fact |
| --- | --- |
| Dataset / product / version | `MRO-M-HIRISE-5-DTM-V1.0`; `DTEEC_023524_1985_023379_1985_U01`; version `1` |
| Mission / instrument / producer | MRO / HiRISE / University of Arizona, with `PRODUCER_FULL_NAME` naming Alfred McEwen and USGS-Astrogeology; `SOCET Set 5.6.0` |
| Stereo observations | `ESP_023524_1985`, `ESP_023379_1985` |
| Encoding | 8235 columns × 21258 rows, PC_REAL 32-bit, scale 1, offset 0; missing bit pattern `FF7FFFFB` |
| Vertical definition | Elevation **metres above the Martian equipotential surface (Mars 2000 Datum), Smith et al. (2001)**; positive above is defined in the label's note |
| Horizontal mapping | Planetocentric/east-positive equirectangular; all three radii **3,394,839.8133163 m**, the local Mars ellipsoid radius at projection centre; standard parallel 15°, centre longitude 77.53° |
| Actual projected sample | **1.0096633268711 m**; webpage's `1.00 meter/pixel` is nominal |
| Bounding footprint | west **77.45290261°**, east **77.59817341°**, south **18.159317160581°**, north **18.521550219233°** |
| Current crop relationship | No overlap: candidate west exceeds current east by **0.02993053918406°** |

The official page identifies these associated orthoimages in the same product directory:

- `ESP_023524_1985_RED_C_01_ORTHO.JP2`
- `ESP_023524_1985_RED_A_01_ORTHO.JP2`
- `ESP_023379_1985_RED_A_01_ORTHO.JP2`
- `ESP_023379_1985_RED_C_01_ORTHO.JP2`

Their URLs were observed in the saved authoritative page. Their complete images, detached labels and numerical coverage were not fetched in this lane; no independent pixel registration result is claimed from those links.

The [HiRISE DTM documentation](https://www.uahirise.org/dtm/about.php) and [RDR SIS](https://hirise-pds.lpl.arizona.edu/PDS4/DOCUMENT/HIRISE_RDR_SIS.PDF) are reused from prior HTTP-200 receipts and hash-verified locally in `provenance-checks.json`. SIS §5.1 defines metres above Mars 2000; §5.4 describes stereo triangulation controlled to MOLA elevation and, when possible, MOLA tracks, editing of extraction artifacts, and orthoimages generated from the stereo DTM. Additional images can be tied to the fixed original stereo pair. These are **general production procedures**, not this product's measured control residuals, MOLA-track list, or independent absolute accuracy.

Saved label SHA-256: `220e7ff937b18d6eaf5e2eb712c452980053daf6ca9f468bf21219577173d5cd`. Saved 64 KiB response SHA-256: `ef39ad298b65690a2d810ff541b8a3f97245f62d41a57ae1b2260cbb194c7e9d`. Saved product-page SHA-256: `4c2fd321686b112430a2d0cd9d1cd91c00dba64f54907a97dab4413a3d228c92`. Complete receipt timestamps and URLs are in `http-receipts.json`.

## Current CTX height-reference conclusion

The previous investigations remain reproducible and provide a real unresolved conflict:

1. Exact-product and catalogue FGDCs declare metre elevations relative to the **3,396,190 m IAU sphere**. Mapping metadata establishes the horizontal sphere; it is not independent evidence of that vertical equation.
2. Named component TIFFs carry `GEOID=mola`, but this key can be written for either direction of a geoid operation. It does not establish the final model/grid/version, sign, operation order, alignment transformation, or whether that description survives final mosaicking unchanged.
3. The final TIFF lacks a vertical reference equation/GeoKeys and recoverable processing history. The published sources inspected do not supply a checksum-linked final equation or correction notice.
4. Nine saved paired HRSC DT5/DA5 probes reproduce CTX-minus-areoid differences **−65.27978515625 to +3.45458984375 m** and CTX-minus-height-above-the-app-sphere differences **+1621.72021484375 to +1695.42138671875 m**. These are diagnostic comparisons, not measured CTX error bounds. HRSC's different support and shared control lineage prevent treating it as independent ground truth.
5. The cited 2021 production-quality paper reports an approximately **0.09° inter-product tilt**. That is not a measured correction or uncertainty for this crop.

A spatially constant offset cancels algebraically: if `z'(p) = z(p) + C`, then `z'(q) - z'(p) = z(q) - z(p)`. Accordingly an explicitly labelled provider-height relative grade over a validated horizontal baseline can be mathematically checked without establishing absolute height. However a varying correction `C(p)` contributes `C(q)-C(p)` to each difference, and a tilt also changes local gradients. The saved HRSC pair implies varying areoid radius across the crop. No evidence justifies assuming the missing transformation is constant.

Therefore this audit does **not** convert provider-height differences into validated gravity/surface slopes or authorize physical terrain costs. It does not relabel the production CTX samples as areoid heights, apply an offset/tilt, replace CTX with HiRISE/HRSC, or change the existing A* implementation or scientific gates.

To close the exact CTX datum gate, recover an exact-product final processing equation defining positive-up sample meaning, final reference surface/model/grid version and checksum, signed/order-specific `DeltaGeoid` and alignment operations, and any correction notice. Validate that equation against appropriately registered matching-support control. Public MOLA PEDR control or a separately versioned reference surface could reject interpretations; an empirical fit still cannot impersonate the provider's missing final processing contract. No producer contact occurred.

## Verification and rerun commands

Executed successfully from `D:/Projects/REDLINE` in this lane:

```powershell
node docs/evidence/science-routing-audit/provenance-height/collect-hirise.mjs
node docs/evidence/science-routing-audit/provenance-height/collect-hirise.mjs --verify-saved
node docs/evidence/science-routing-audit/provenance-height/verify-provenance.mjs
node docs/evidence/scientific-resolution-2026-11-14/height/fetch-new-evidence.mjs --verify-saved
node docs/evidence/scientific-gate-resolution/vertical/analyze-public-evidence.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/inspect-hrsc-ranges.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/height/sample-hrsc-controls.mjs --verify-saved
```

Results: original collector HTTP 200 page / HTTP 206 complete attached-label range; all-cell source preservation **65,536 / 65,536**, zero differences; **20** saved height-investigation bodies; **42** saved public vertical bodies and complete inventory sizes **35 / 92**; both exact HRSC vertical TIFF contracts; **18** native HRSC heights / **9** paired comparisons.

`verification-runs.json` records exact commands, exit codes and output for this audit. New scripts and saved-result equality are checked with:

```powershell
node --check docs/evidence/science-routing-audit/provenance-height/collect-hirise.mjs
node --check docs/evidence/science-routing-audit/provenance-height/verify-provenance.mjs
node docs/evidence/science-routing-audit/provenance-height/verify-provenance.mjs --verify-saved
```

Only files inside `docs/evidence/science-routing-audit/provenance-height/` were created or edited by this lane. No production/scientific algorithm, original evidence, dependency, commit, remote, personal browser or device was changed. Browser acceptance and the application's lint/typecheck/test/build checks belong to the root milestone; this evidence fragment does not claim those checks.
