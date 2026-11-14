# PLACES native control and relative image registration audit

**Result: the PLACES frame/pixel ambiguity is resolved for the actual release 16.0 controls; bounded empirical relative-image evidence is obtained. Absolute MDIM/Gazetteer named-feature registration remains unresolved.** No app, native DEM, preserved 65,536-cell crop, source coordinates or geotransform was changed. No A*, route calculation, tolerance or safety probability was introduced.

## Actual controls and source contract

The [PDS Geosciences Mars 2020 Rover PLACES bundle](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/) supplied actual `best_tactical.csv`, matching PDS4 labels, native map/DEM labels, raw localized SITE definitions, orbital origin tables and orbital metadata. These are downloaded products, not SIS examples. All seven compared labels identify **release 16.0**; CSV/map time context is 2021-02-18 through 2026-06-21, with products created 2026-07-29. These are archive/product times, not dates assigned to individual SITE definitions. The latest self-contained release is used as the SIS recommends. The older SPK is compared by site identity, rather than pretending its delivery and the current PLACES release are identical.

`places-frame-check.json` records 666 actual CSV records, **21 matching localized SITE records (21–41)** inside the preserved crop and **50 localized ROVER records** with reported sols 659–779. All 21 SITE records use `sol=-1` and `sclk=0`; no observation date is inferred from those placeholders. Their raw records derive from `ORBITAL(1)` and refer to `ORBITAL(0)`. The maximum horizontal coordinate difference from the archived SPK site definitions is **0.00003653 m**, consistent with serialization. That arithmetic agreement is **not** micrometre/millimetre geolocation accuracy or independent image control.

Every retrieved file listed by the provider MD5 inventory matches its published MD5. Local SHA-256 receipts also validate saved octets. `places-http-receipts.json` retains the actual HTTP 200 results; `native-imagery-http-receipts.json` records six successful metadata/header requests and one full CTX TIFF timeout. The bounded CTX and PLACES byte ranges subsequently succeeded with HTTP 206 and validated ranges. HTTP retrieval establishes archive access, not browser/CORS rendering.

The actual PLACES map/DEM labels declare:

- Mars sphere radius 3,396,190 m, planetocentric latitude, positive-east longitude, body-fixed rotating coordinates.
- Equirectangular projection, standard parallel 18.4663°, origin latitude/central meridian 0°, zero false easting/northing.
- Native current map cutout upper-left corner `(easting,northing)=(4340890,1097070)` m; 59,200 samples × 21,920 lines at 0.25 m, three unsigned-byte BSQ bands. PDS4 array offset is 118,400 bytes. Attached ODL/VICAR headers independently agree.
- The actual orbital metadata defines `(line,sample)=(0,0)` at the **upper-left pixel corner**. All 21 SITE CSV map/DEM pixel values agree with corner arithmetic within their decimal serialization. Thus the centre of array element `[row,column]` has corner coordinates `[row+0.5,column+0.5]`. The generic SIS centre wording must not override the actual metadata and data.
- The matching DEM cutout has the same corner at 1 m spacing. This audit does not transfer its height reference to REDLINE's DEM.

The archived [JPL PLACES SIS](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/document/Mars2020_Rover_PLACES_PDS_SIS.pdf), §5.1.1.2, gives **expected 0.5 m `best_tactical` accuracy relative to its base map**. No stated statistical confidence, per-control covariance, global accuracy, CTX registration bound or named-feature uncertainty accompanies this figure. The SIS §5.2 links the operational base map to the published `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first` product; orbital metadata names `M20_PrimeMission_HiRISE_CLR_25cm.tif`. This establishes a documented mission-map lineage, not byte identity or a complete reprojection history of that operational file. The actual matching cutout is therefore used for the empirical comparison.

## Geometry qualifications

`orbital_1_metadata.csv` includes a repeated identical keyword block and whole-base dimensions/bounds that do not agree: 52,000 lines × 36,000 samples at 0.25 m imply 13,000 m north–south and 9,000 m east–west, whereas its declared corner bounds span 9,000 m north–south and 13,000 m east–west. These metadata are not substituted for the internally consistent **actual cutout PDS4 label**. The verifier retains both versions of the orbital keyword block and uses the real cutout label for pixels.

The exact [controlled CTX product](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif) and REDLINE's native 20 m DEM share origin `(4573663.250853,1109693.140188)` m, sphere, planetocentric/east conventions and `lat_ts=lon0=0`. TIFF tags independently validate CTX spacing, uncompressed unsigned-byte encoding, one row per strip, first zero-based image byte offset 30,921 and NoData tag 0. CTX is 5,040 × 5,322 pixels at 6 m; DEM is 1,512 × 1,596 cells at 20 m. Their east extents differ by 12 m; neither shape is inferred from the other.

The preserved crop is native DEM rows 586–841 and columns 522–777. Its corner bounds are approximately 77.3365946–77.4229721°E and 18.4370935–18.5234710°N. The current PLACES cutout north edge corresponds to DEM corner row 631.157. It therefore omits **903.140188 m at the north of this crop**. The nine native image patches are inside the overlap, around native DEM rows 660/740/820 and columns 550/650/750; no claim is made about the omitted north strip or unsampled ground.

For this pair of spherical equirectangular grids the documented conversion is exactly `x_CTX=x_PLACES/cos(18.4663°)`, `y_CTX=y_PLACES`. It changes coordinates, not pixels or terrain values. This is not an empirical fitted scale.

## Empirical native image comparison

Nine 3,072 × 3,072 native first-band PLACES patches were selected from a fixed 3 × 3 grid **before matching**, obtained with validated byte ranges, and kept losslessly. A native CTX row range supplies the matching image samples. Native PLACES imagery was area averaged to exact 6 m CTX cells for this analysis only; no DEM was resampled. Cutout geometric coverage and CTX's provider-valid DN range 3–255 form the matching mask. PLACES labels declare no DN NoData sentinel, so colors 0/255 are retained. All nine compared patches have full valid coverage.

Shi–Tomasi image corners supply reproducible texture anchors. Normalized cross correlation uses 21 × 21 CTX pixel templates with a ±10-pixel search and a three-sample quadratic peak. A 0.70 NCC, 0.05 competing-peak margin and search-edge rejection filter ambiguous image matches; these are **matching algorithm settings, not positional acceptance tolerances**. Templates of 15 and 31 pixels independently measure sensitivity. All candidates, rejected candidates, native coordinates, correlation values and paired PLACES coordinates remain in `native-image-registration.json`.

Five grid patches were designated for the descriptive translation fit and four held out before matching. Scale and rotation remain fixed by the source coordinate contracts. The equal-patch median translation from 97 retained fit ties is **(−0.61195,+0.47502) m** in CTX easting/northing. Across **62 held-out ties**, residual RMS is **2.01962 m**, median **1.58162 m**, maximum **5.22291 m**. The fit-tie RMS is 2.31954 m. No translation was applied to either dataset.

A more inspectable subset chooses one tie per patch by **maximum minimum NCC across all three template sizes**, requiring distinctive matches at every size. Selection uses no displacement, residual or sensitivity threshold. Eight patches supply such a tie; `r820-c650` does not. These eight ties are shown in `selected-spatial-ties.png`. Their five-fit/three-held-out translation diagnostic is **(+0.08695,−1.06643) m**; held-out RMS is **1.97195 m**, maximum **2.19346 m**. These statistics are conditional measurements from these image matches, not certified accuracy bounds.

| Traceable tie | Split | Native CTX centre row, column | Offset easting, northing (m) | Maximum template sensitivity (m) | Min. NCC |
| --- | --- | --- | --- | ---: | ---: |
| r660-c550-p13 | Fit | 2193, 1830 | +0.087, +0.823 | 1.908 | 0.908 |
| r660-c650-p7 | Held out | 2223, 2170 | +0.209, +0.735 | 0.660 | 0.897 |
| r660-c750-p17 | Fit | 2202, 2534 | +0.294, −0.053 | 2.392 | 0.916 |
| r740-c550-p0 | Held out | 2432, 1801 | −1.801, +0.050 | 0.133 | 0.845 |
| r740-c650-p15 | Fit | 2486, 2170 | +0.559, −3.844 | 2.019 | 0.941 |
| r740-c750-p6 | Held out | 2492, 2528 | +1.089, +0.543 | 1.076 | 0.923 |
| r820-c550-p6 | Fit | 2771, 1822 | −1.675, −1.652 | 0.935 | 0.856 |
| r820-c750-p0 | Fit | 2770, 2465 | −0.499, −1.066 | 1.213 | 0.960 |

The paired boards were visually inspected. They show corresponding scarp patterns and bright/dark terrain junctions at the marked locations, with illumination and fine texture differences. They are **image-texture ties identified by exact native coordinates**, not officially named survey landmarks, rover observations at these pixels or new target coordinates. No unchanged-feature age or physical hazard is inferred. `native-image-tie-board.png` retains all 159 nominal distinctive ties.

## Uncertainty and limits

The strongest subset's maximum template-size sensitivity is **2.39224 m**. Across the broader nominal set one tie (`r820-c750-p16`) changes by **47.79205 m** when its template changes. That tie remains visible in the full diagnostic and is absent from the multiscale subset because its variants fail the quality criterion. Repeated terrain texture and source radiometry therefore matter; low residual RMS alone cannot certify accuracy.

Subpixel peak positions describe correlation interpolation precision. They do not establish subpixel ground accuracy. Template sensitivity is an observed, conditional algorithm sensitivity, **not a confidence interval or a complete measurement uncertainty budget**. It cannot be combined by root-sum-square with the SIS's non-statistical expected 0.5 m map-relative accuracy. Shared HiRISE/CTX mission control lineage further prevents treating these image ties as independent absolute geodetic controls. The eight strong ties are held out only from the diagnostic translation fit, not from provider photogrammetric control. No numerical acceptance threshold has been supplied or invented.

This bounded result makes an implementable distinction:

1. **PLACES frame/pixel check: verified.** Version-matched actual observations, raw orbital ancestry, pixel convention and native-image geometry are reproducible.
2. **Relative PLACES ↔ controlled-CTX comparison: empirically supported in sampled overlap**, with explicit residuals, sensitivity and the unsampled/northern coverage limit. Keep the source transform; do not apply the diagnostic offset as a correction.
3. **Absolute named-feature registration: pending.** Jezero/Belva/Neretva Gazetteer centres use rounded MDIM control and identify feature centres rather than precise image points. These ties do not define feature geometry or provide a transform/uncertainty between MDIM and the mission map. To close that gate needs traceable feature geometries or exact independently defined image landmarks in the appropriate source frame, plus a justified acceptance/uncertainty contract. Do not create registered endpoints from the rounded centres or unlock A* from this audit.

## Exact-byte archive and reproduction

The native evidence is approximately **59.5 MB**, reduced from 74.6 MB of initially stored gzip/range files. Standard gzip wraps a reversible horizontal modulo-256 byte-difference prefilter. Every decoded native octet is checked against its original SHA-256; byte ranges and selected-data hashes remain in `native-patch-http-receipts.json.gz`. The prefilter is compression only. It changes no restored sample values. Range retrieval avoids downloading the 3.89 GB full PLACES RGB cutout. Partial-image native hashes are not claimed as whole-product hashes.

Run from the repository root:

```powershell
node docs/evidence/scientific-gate-resolution/registration/fetch-places-records.mjs --verify-saved
node docs/evidence/scientific-gate-resolution/registration/fetch-native-imagery.mjs --verify-saved
python docs/evidence/scientific-gate-resolution/registration/inspect-places-frame.py
node docs/evidence/scientific-gate-resolution/registration/fetch-native-patches.mjs --verify-saved
uv run --offline --with rasterio==1.5.2 --with opencv-python-headless==5.0.0.93 --with matplotlib==3.11.2 --with numpy==2.5.3 python docs/evidence/scientific-gate-resolution/registration/measure-native-registration.py
```

The last command requires those evidence-runtime packages already cached; omit `--offline` on a new machine to provision them. The installed OpenCV **distribution** is `opencv-python-headless==5.0.0.93`; `cv2.__version__` reports its internal library version `5.0.0`, which is not an installable distribution pin. Distribution versions were checked with `importlib.metadata.version`; the corrected exact-pinned command was rerun successfully with unchanged measurements and thresholds. These packages are not application dependencies. Fresh native-patch network retrieval produces the initial uncompressed receipt and gzip-native files; run `uv run --with numpy==2.5.3 python docs/evidence/scientific-gate-resolution/registration/compact-native-evidence.py` after a fresh retrieval and before verification/measurement. The compacting script is idempotent and operates only inside this evidence directory. The failed first masking attempt is retained as `native-image-match-blocker.json/png`: it incorrectly excluded ordinary PLACES 0/255 color values, was diagnosed by viewing native imagery and corrected without lowering the correlation quality settings.

Preserved app hashes remain manifest `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9`, binary `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8`; native DEM SHA-256 remains `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b`. Evidence verifiers check them. Application lint/typecheck/unit/build/browser checks and the milestone commit are owned by the parent task; no app-passing claim is made here.
