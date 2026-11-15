# Separate HRSC native DEM model authorization — 15 November 2026

The new source is the **HRSC Mars Express HMC-30 Level-5 DT5 native DTM subset**, product `HMC_13E10_DT5`, credited to **ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO**. Its exact provider-declared numerical band and horizontal model support a separately qualified **sphere-relative provider DEM model**. They do not establish independently validated physical slopes, precise named-feature routing, terrain hazards, traversability, or rover/human safety. The authorization identifier is `provider-dem-model`, never a physical-validation status.

This model retains all **10,609 cells** in the separately preserved 103 × 103 HRSC rectangle. The original **65,536 CTX cells**, crop, manifests, source transforms, historical evidence and CTX scientific gates are unchanged. This source does not resolve, relabel or correct the CTX DEM.

## Exact source and native contract

- Original numerical asset: [HMC_13E10_dt5.tif](https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_dt5.tif), **638,313,017 bytes**.
- Authoritative saved contract: `docs/evidence/scientific-gate-resolution/hrsc/hrsc-native-reference.json`; exact TIFF key **4097** declares `Height above spheroid with radius 3396.0 km|`; vertical unit key **4099** is metres (**9001**). Positive height is outward/up from that named sphere.
- Horizontal CRS: spherical EQC/equirectangular, **R = 3,396,000 m**, standard parallel, central meridian, latitude origin and false offsets all zero; longitude then latitude, east-positive longitude, planetocentric latitude on the defined sphere. The provider longitude range is 0–360°.
- Native grid: original rows **13605–13707**, columns **11661–11763**, inclusive. Cropped upper-left **edge** is X **4,583,825 m**, Y **1,097,925.0000000002 m**. Column step is **+50 m**, row step **−50 m**. Centres use local index + 0.5. This cropped origin must not be combined with global indices a second time.
- Heights: little-endian signed **int16**, row-major, scale **1**, offset **0**, units **m**, stored quantization **1 m**. NoData sentinel is **−32768**, with separate uint8 validity **0 = NoData**, **1 = valid**. The actual crop has **10,609 valid cells, zero NoData**, range **−4039 to −3854 m**.
- No reprojection, resampling, interpolation, upsampling, vertical correction or source-height replacement occurs. Converting native int16 values into the shared float32 API is exact for every stored value, including the sentinel; masks are retained separately.

The documented source rectangle's geographic outer edges are **[77.33622689238946, 18.43680667179286, 77.4231153683884, 18.52369514779179]°**, ordered west, south, east, north. It includes **408 border-overhang cells** beyond the original CTX footprint; none is discarded from the HRSC model. The **10,201 wholly covered cells** used in older CTX comparisons are a different comparison extent, not this model's size. These are declared grid bounds, not surveyed feature boundaries. Out-of-bounds cells and incomplete derivative/roughness neighborhoods must remain unknown rather than flat or low-cost terrain.

The **50 m projected step is not an identical physical east–west and north–south ground distance**. Model calculations must use the declared Mars sphere and each geographic baseline, retaining the distinction between reference-sphere distances and actual gravity/surface geometry. The API's `referenceRadiusM` is 3,396,000 m; the CTX sphere of 3,396,190 m must not be substituted.

## Integrity scope and reproducible assets

`sourceHash` identifies the SHA-256 of the **preserved HRSC evidence manifest**, which binds the exact TIFF metadata, original HTTP range receipts, native samples, masks and scientific qualifications. It is **not a checksum of the full 638 MB TIFF**. That whole file was not downloaded or hashed; `fullResourceSha256` remains null. Exact crop acquisition/contributor dates and scientific release version remain null. The `10` in the filename is a sub-tile index, not a recovered release version. HTTP modification dates are not acquisition dates.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| Preserved evidence manifest (`sourceHash`) | Existing evidence | `5d7c16b7589df237b3dbb45365cff2b94fc28ffd46764b336783f58bb60c4fdc` |
| `public/data/hrsc-terrain-model.json` | 2,467 | `36f932f7abbb9d193c058187c41219bbd417155dad64d83b86e1eab11573d5bb` |
| `public/data/hrsc-terrain-model.i16` (`gridHash`) | 21,218 | `e385f36da8ea9137bdd7cece3ac858a64de1bbf5e036ecc01e942d7e9a5439f2` |
| `public/data/hrsc-terrain-model.u8` | 10,609 | `c7129c480eb63e9537de9c8b4678fcbebcabac8ae3450a35bdec8e2a0a63da67` |

`node scripts/prepare-hrsc-model.mjs` verifies preserved input hashes, DT5 identity/reference, grid/CRS, every mask/sample and the source summary before copying the native bytes. It rejects existing outputs that differ. It checks unchanged CTX binary/manifest hashes before and after preparation. `--verify-saved` only validates existing inputs and outputs and writes nothing.

The browser API is `loadHrscModel(options?: { signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number }): Promise<TerrainModelGrid>`. It fetches the three bounded local assets, requires Web Crypto SHA-256 verification, rejects altered source or qualification text, checks exact byte counts and native masks, and propagates network failures, timeouts and cancellation. It never substitutes terrain or downloads the full remote TIFF. Cached local delivery is distinct from live provider/CORS availability; browser acceptance belongs to the combined integration milestone.

## Supported model outputs and unresolved scientific claims

| Capability | Evidence and permitted interpretation |
| --- | --- |
| Native heights and source-to-model preservation | Exact retained provider DT5 values and named sphere-height definition; independently decoded native samples are available as saved evidence. |
| Declared native-cell positioning | Provider EQC arithmetic validated against PROJ and GDAL; not empirical landmark registration. |
| Local height differences and sphere-relative model grades | Supported as derivatives of the declared DT5 height band over the declared horizontal baseline. Method, neighborhood and boundary support must be documented. They are DEM estimates, not independent measurements of local gravity slope or confirmed traversability. |
| Neighborhood roughness/relief and coarse shape indicators | Supported as explicitly defined statistics of native provider samples at native scale. A 50 m posting and 1 m quantization do not imply metre-scale terrain accuracy, rock detection or physical step detection. |
| Hypothetical relative-grid terrain routes | Supported as optimization of nonnegative user-configured model costs on these native data, subject to tested algorithm assumptions and unknown-data policy. Profile thresholds are mission assumptions; accumulated cost is not verified energy, travel time or safety. |
| Precise named-feature endpoints | **Unverified.** Native-cell hypothetical endpoints cannot establish precise arrival at an independently registered landmark. |
| Physical/gravity slope accuracy, actual hazards and traversability | **Unverified.** Exact local stereo support, interpolation history, horizontal/vertical errors, per-cell uncertainties and independent registration are unavailable in the inspected asset metadata. |
| Existing CTX physical terrain routing | **Still unavailable.** The exact CTX final-height interpretation remains conflicted. No HRSC-based offset/tilt is applied to CTX and no CTX validation gate is opened. |

The paired HRSC DA5 product independently names its GMM3 areoid reference. The saved DT5−DA5 difference is **−1505 to −1489 m**, so reference conversion varies spatially across this crop. It cannot justify assuming the missing CTX correction is constant. DA5 is retained in historical evidence but is not silently substituted or merged into this DT5 model. HRSC participates in CTX control lineage and cannot supply independent CTX ground truth.

Every derived model or route must retain `source.authorization`, product ID, both hash scopes, named vertical reference, attribution and this persistent qualification:

> Sphere-relative provider DEM model. Physical slope accuracy, local uncertainty, precise feature registration, hazards, and rover/human safety remain unverified.

The existing overall scientific-status distinctions remain unchanged. In particular a qualified model route is not a `VERIFIED` physical terrain route or safety assessment. Synthetic fixtures remain separately labelled `synthetic-test` and cannot serve as Mars evidence.

## Source attribution and verification

Retain [CC BY-SA 3.0 IGO](https://creativecommons.org/licenses/by-sa/3.0/igo/), [HRSC provider terms](https://hrscteam.dlr.de/imprint_hrsc_en.php), legible **ESA/DLR/FU Berlin** credit and the native-subset/validity-mask change notice when distributing these source-derived assets. Cite the provider's methodology: **Gwinner et al. (2016), Planetary and Space Science 126, 93–138, doi:10.1016/j.pss.2016.02.014**. REDLINE remains an independent prototype.

Executed source-evidence checks: the saved native HRSC verifier passed all **6 contract tests**, independently matched **21,218 raw samples** and complete masks, checked declared projection and paired vertical arithmetic; the saved documentation verifier matched all **3 provider documentation bodies**; the independent support review matched **6 real comparison cells**. These are cached evidence checks, not new live-source or browser access claims.

Executed new-adapter check: `npm test -- src/features/terrain/hrscModel.test.ts src/features/terrain/loadHrscModel.test.ts` passed **35 tests** across **2 files**, including full native preservation, forged source/CRS/status rejection, malformed masks, changed same-size data, asset failures, bounded reads, Web Crypto failure, timeout and cancellation. Both suites were first run before their respective implementations and failed on the missing module, then passed after implementation.

Further combined metric/routing tests, app lint/typecheck/full tests/build, browser route/overlay acceptance and the Git checkpoint belong to the root milestone; this source-authorization record does not claim those outcomes.
