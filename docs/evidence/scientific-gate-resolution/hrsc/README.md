# Complete native HRSC reference around the preserved Belva crop

**Terrain data: ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO.** This is a separately stored native subset of HRSC Mars Express HMC-30 Level-5 DTMs, produced by the HRSC Science Team Global Topography and Mosaics Task Group. Original integer heights are retained. REDLINE is an independent prototype; this evidence does not establish an official NASA product, endorsement, certified traverse, or terrain safety.

The complete **103 × 103** native rectangle contains **10,609 valid paired cells**, with no NoData in either height product. It covers the original geographic support of the preserved **256 × 256 / 65,536-cell CTX crop**. The CTX TIFF, native float32 data, manifest, transforms, and app code have not been changed by this extraction. HRSC is a separate external numerical reference and part of the CTX control lineage, so it is **not independent ground truth** and does not resolve the conflicted CTX absolute datum.

## Data interface and verified contract

`hrsc-native-reference.json` records source/crop geotransforms, global indices, exact source GeoTIFF keys, scientific limits, provenance hashes, attribution, and complete valid coverage. Consumers read the paired files at their native shape and retain their separate vertical meanings.

| Property | DT5 | DA5 |
| --- | --- | --- |
| Exact asset | [HMC_13E10_dt5.tif](https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_dt5.tif) | [HMC_13E10_da5.tif](https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_da5.tif) |
| Subset | `hrsc-dt5-native.i16` | `hrsc-da5-native.i16` |
| Validity | `hrsc-dt5-validity.u8` | `hrsc-da5-validity.u8` |
| Vertical key 4097 | Height above spheroid with radius **3396.0 km** | Height above equipotential surface described by **GMM3**, PDS dataset **MGS-M-MOLA-5-MEGDR-L3-V1.0** |
| Encoding | Signed little-endian int16, row-major | Same |
| Scale / offset / units | 1 / 0 / metres | Same |
| NoData / validity encoding | -32768; uint8 mask 0=NoData, 1=valid | Same |
| Native values in complete crop | -4039 through -3854 m | -2547 through -2359 m |
| Source resource size | 638,313,017 bytes | 638,313,147 bytes |
| HTTP Last-Modified | 2020-10-01 17:17:21 GMT | 2020-10-01 17:16:19 GMT |

Last-Modified is an HTTP file/cache date, **not an image acquisition date or scientific product version**. The naming document dated 29 October 2019 defines `HMC_nnHtt_pp5`: `13` is quadrangle, `E` the eastern half, **`10` the sub-tile index**, and `dt5` / `da5` the Level-5 product type. The `10` is not a release-version identifier. The multi-orbit acquisition/contributor list and exact scientific release version remain unknown for this specific crop. The readme says PDS-conforming release through PSA was in preparation; that cached statement is not proof of a current completed archive release.

Both originals are numerical elevation DTMs, not rendered tiles, RGB height proxies, or a visual globe. Actual TIFF tags and the independent reader confirm one uncompressed signed-int16 band, 50 m projected spacing, area pixels, identity scale/offset, and the stated NoData sentinel. GDAL's default scale/offset are verified; no guessed stretch or color decoding occurs.

The horizontal model is equirectangular/EQC on a **3,396,000 m sphere**, zero standard parallel, central longitude, latitude origin, false easting, and false northing. Coordinates are longitude then latitude, positive east and north, with metre projected axes. Planetocentric and planetographic latitude coincide on this defined sphere. It differs from the CTX horizontal sphere of **3,396,190 m**; ignoring that radius difference selects different HRSC pixels.

GDAL-order source geotransform:

```text
[4000775, 50, 0, 1778175.0000000002, 0, -50]
```

Native source rows **13605–13707** and columns **11661–11763**, inclusive; crop geotransform:

```text
[4583825, 50, 0, 1097925.0000000002, 0, -50]
```

Pixel indices refer to area edges; centre coordinates use `column + 0.5`, `row + 0.5`. No reprojection, resampling, interpolation, upsampling, or height conversion is applied to the stored HRSC or CTX samples.

## Coverage and accepted comparison extent

The native rectangle is floor/ceil aligned around the **original outer CTX pixel edges**, not a new feature boundary. Native coverage is fully checked through every original byte segment and mask. Its geographic bounds are **[77.33622689238946, 18.43680667179286, 77.4231153683884, 18.52369514779179]**, ordered west, south, east, north in degrees.

There are **408 border-overhang cells** retained in the evidence. A whole-footprint CTX comparison must reject those cells rather than average only their partial coverage. The **10,201 wholly covered cells** are native rows **13606–13706**, columns **11662–11762**, with projected outer bounds **[4583875, 1092825.0000000002, 4588925, 1097875.0000000002] m** and geographic bounds **[77.33707046982634, 18.437650249229744, 77.42227179095151, 18.52285157035491]°**. All these extents are computed projection/grid geometry, not surveyed landmarks or a validated route area.

## Verification and reference arithmetic

`http-range-receipts.json` and `ranges/` retain **206 exact HTTP 206 responses**, each containing only one 103-cell native row segment: **42,436 fetched sample bytes in total**. Every interval, full-resource length, response time, URL, HTTP validator, byte count, and SHA-256 is recorded. A server that ignores Range is rejected before consuming its body; wrong interval/size and truncated responses fail closed.

`native-reader-validation.json` records **21,218 independently matched raw samples** across both products and their complete masks. Rasterio/GDAL reads an ephemeral sparse TIFF fixture with the original offsets, saved original metadata ranges, and known sample segments. Its only read window is the saved crop. Unsaved sparse holes are never treated as source observations, and the fixture is removed after validation. The full 638 MB originals were not downloaded.

`projection-validation.json` tests the model against pyproj/PROJ and Rasterio/GDAL, geometric axis/radius fixtures, all four original CTX outer edges, and every pinned source fixture. Synthetic geometric controls are labelled test data. The seven source fixtures show that using the CTX sphere directly would shift native indices. This validates coordinate arithmetic and pixel placement under the declared CRS; it does not measure empirical feature registration or CTX/HRSC co-registration accuracy.

`paired-vertical-validation.json` preserves these named-reference equations:

```text
radius = 3396000 + DT5
GMM3_areoid_radius = 3396000 + DT5 - DA5
height_above_3396190_sphere = DT5 - 190
```

All paired integer identities hold and all nine earlier native-control pairs match. Across this crop, DT5−DA5 is **-1505 to -1489 m**, implying GMM3 areoid radii of **3,394,495–3,394,511 m** under the provider's declarations. These are reference-only identities and pair diagnostics. They do not independently reconstruct the GMM3 gravitational model, validate its local error, or supply the missing CTX transformation/sign/version.

The root-owned comparison under `../comparison/` models the preserved CTX scalar as constant over each native cell, then weights complete overlapping support by spherical surface area. A raster post is not necessarily a measured footprint average, so this assumption remains conspicuous. `review-native-support.py` independently checks selected real cells, including difference extremes, using degree-domain intersections and eight-point Gauss-Legendre integration of the spherical area Jacobian. It changes no source samples or root-owned code.

## Attribution, usage, and resolution limits

The current [HRSC-specific provider imprint](https://hrscteam.dlr.de/imprint_hrsc_en.php), preserved as `hrsc-usage-imprint.html`, explicitly licenses **HRSC image data and derived products including DTMs under [CC BY-SA 3.0 IGO](https://creativecommons.org/licenses/by-sa/3.0/igo/)** and requires clearly legible credit to **ESA/DLR/FU Berlin**. The numerical crop is a native spatial subset with a separately derived NoData validity mask; retain credit, source links, licence, and change notice when distributing it. Provider logos and unrelated website materials have separate conditions and are not incorporated in the numerical data subset.

The [provider readme](https://hrscteam.dlr.de/public/data/HMC30/MC13E/AA_README_HMC30.txt) identifies multi-orbit DTMs produced with improved imaging-geometry bundle-block adjustment and asks users to cite **Gwinner et al. (2016), Planetary and Space Science 126, 93–138, [doi:10.1016/j.pss.2016.02.014](https://doi.org/10.1016/j.pss.2016.02.014)**. Its official [DLR methodology record](https://elib.dlr.de/109617/), saved as `hrsc-methodology-2016.html`, describes stereo 3D processing and feasible multi-orbit 50 m grids. The full 2016 paper was unavailable in that repository; this investigation read the official abstract, not an inaccessible full paper.

The official [2010 HRSC methods abstract](https://elib.dlr.de/68116/), preserved as `hrsc-methodology-2010.html`, describes typical DTM grid size as about twice mean stereo ground resolution, with restrictions relative to stereo point precision and density. Its generic accuracy and grid-generation statistics are **not local uncertainty measurements for HMC_13E10 or this crop**.

**50 m posting and 1 m stored quantization are verified; neither proves effective terrain resolution or metre-level accuracy.** A mosaic cell combines stereo reconstruction and processing support. The exact contributing imagery, acquisition dates, local point density, effective spatial resolution, interpolation history, registration error, and per-cell vertical uncertainty are not supplied by the inspected exact asset metadata. Small hazards, local traversability, physical terrain slope, and astronaut/rover safety are not established. Shared HRSC/CTX control lineage prevents an independent CTX accuracy claim; the current CTX datum remains unresolved.

## Reproduce and verify saved evidence

Run from the repository root. The base Python lacked Rasterio; `uv` supplies an isolated runtime without application dependency or lockfile changes. Recorded versions are NumPy **2.5.3**, Rasterio **1.5.2** / GDAL **3.12.2**, pyproj **3.8.0** / PROJ **9.8.1**. Different library versions can change serialized WKT/fixtures and require a reviewed report regeneration.

```powershell
uv run --with numpy==2.5.3 --with rasterio==1.5.2 --with pyproj==3.8.0 python docs/evidence/scientific-gate-resolution/hrsc/build-hrsc-reference.py --verify-saved
python docs/evidence/scientific-gate-resolution/hrsc/fetch-source-documentation.py --verify-saved
uv run --with numpy==2.5.3 --with pyproj==3.8.0 python docs/evidence/scientific-gate-resolution/hrsc/review-native-support.py --verify-saved
```

Omit `--verify-saved` to build missing original row evidence or documentation; saved rows are reused after their hashes and ranges are checked. The main verifier performs no network request and rewrites no saved report or data. It only creates/removes an ephemeral validation fixture. Source documentation HTTP tests are separately saved; this build-time reference makes no frontend/CORS availability claim.

The header/tail TIFF metadata, source readme, and naming PDF are inherited from the unchanged earlier `scientific-resolution-2026-11-14/height/` evidence and verified against their preserved HTTP receipts and hashes. `hrsc-tiling-naming.txt` is text extracted from that retained naming PDF with `pypdf`; inspect the original PDF for graphical tiling detail.

This evidence-only lane ran the native decoder, response/NoData checks, independent reader/projection checks, and saved-evidence verification. The root milestone owns app lint, typecheck, tests, production build, smoke testing, and the reviewable Git checkpoint. No application terrain or route capability is enabled by these files.
