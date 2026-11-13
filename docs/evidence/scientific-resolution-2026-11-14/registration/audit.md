# Mars 2020 registration-control audit — 14 November 2026

**Result: authoritative control candidates found; current named-feature/CTX registration remains pending.** This evidence does not create registered waypoints, fit a transformation, or change any application code or terrain cells.

## Verified candidate controls

The NAIF/JPL PDS4 Mars 2020 SPICE archive supplies reproducible positions in `IAU_MARS` using IAU 2000 rotation constants. Both downloaded SPK binaries match their PDS4-label MD5 checksums. HTTP retrieval byte hashes, URLs and actual UTC retrieval times are retained in `http-receipts.json`; retrieval time is not an observation date.

Landing-site kernel `m2020_ls_ops210303_iau2000_v1.bsp`, solution dated **2021-03-03**, contains the following **Gaussian/ellipsoid-normal** inputs:

- Longitude 77.45088572° east, latitude 18.64875816° north.
- Ellipsoid-normal altitude −2.236421 km.
- PCK Mars radii 3396.19 / 3396.19 / 3376.2 km.

Those latitude/altitude inputs must not be copied into a planetocentric map. Using CSPICE `georec` reproduces the stored Cartesian vector to less than 1e−9 km; `reclat` then yields longitude **77.45088572° east**, planetocentric latitude **18.444627153952787° north**, and radius **3,391,936.52991685 m**. This numerical conversion check is not a claim of millimetre geolocation accuracy. The kernel supplies no coordinate uncertainty.

The landing coordinate maps arithmetically to native DEM row **819**, column **860**. It is inside the source raster and outside the preserved planning crop. The native provider value at that cell is −2567.191650390625 m. Its difference from an ellipsoidal altitude or SPICE radius is **not** a validated datum correction.

Localized rover kernel `m2020_surf_rover_loc_0659_0779_v1.bsp` contains **41 fixed site definitions**. **21 sites, numbered 21–41, fall inside the preserved crop**. Its rover coverage is 2022-12-27T07:12:21.603 through 2023-04-30T15:02:26.125 UTC, covering sols 659–779. Fixed-site segment coverage is not the date that a site was observed. The kernel comments identify its source as OPGS PLACES `localized_interp`; the archive warns that rover values during motion are interpolated.

| Candidate | Longitude east | Planetocentric latitude north | Native DEM row, column |
| --- | ---: | ---: | --- |
| Site 21 | 77.42178250103575° | 18.45707810773771° | 782, 774 |
| Site 30 | 77.40125790238015° | 18.451329955244407° | 799, 713 |
| Site 41 | 77.36582826823548° | 18.481441926702452° | 710, 608 |

Full coordinates, Cartesian vectors, native-cell mappings, provenance and qualifications are in `spice-control-candidates.json`. Decimal precision is not accuracy. No per-site uncertainty, independently observed image landmark residual, or fitted inter-map transform has been established.

## PLACES qualifications and useful next evidence

The archived JPL **Mars 2020 Rover PLACES SIS v1.0, 2022-02-22** was retrieved successfully and saved as PDF plus searchable text. `places-sis-http-receipt.json` preserves its HTTP 200 response and SHA-256. The SIS makes the limits of transferring these controls explicit:

- **§1.2, p4:** locations are estimates, can conflict, and are valid for their intended purpose.
- **§5.1.1.2, p30:** `best_tactical` positions have an expected **0.5 m accuracy relative to the PLACES base map**. This is not absolute/global accuracy, a bound for interpolated SPK positions, or accuracy relative to REDLINE's CTX raster.
- **§5.1.1.3, pp31–32:** `best_interp` adds intermediate positions between localized endpoints. Use localized endpoint records rather than treating interpolation as an observation.
- **§5.1.3, pp33–35:** per-view CSV includes planetocentric and planetodetic latitude, longitude, 0-based map/DEM pixel line and sample, spacecraft-clock context and sol. Those are a concrete path to traceable image-space controls.
- **§5.2, pp38–39:** the PLACES locations are created using its own HiRISE/CTX base map. The provider explicitly says transfer to another map is limited by coregistration of the two maps. Its DEM is a HiRISE mosaic backfilled by a JPL CTX DEM; exact identity with REDLINE's 20 m DeltaGeoid TIFF has not been demonstrated.
- **§3.9.1, p23:** PLACES orbital mapping uses standard parallel 18.4663°. REDLINE's preserved TIFF uses 0°. Similar equirectangular labels do not make the pixel grids interchangeable. Read exact map labels and orbital metadata before converting pixel coordinates.
- **§3.9.3, pp23–24:** PLACES elevation is positive up relative to the MOLA areoid, with radius = areoid + elevation; its internal Z is positive down. These declarations concern PLACES and cannot be transferred to REDLINE's TIFF without product lineage.

The SIS contains example values and labels. They are documentation examples, not downloaded localization observations or definitive current map labels. No large PLACES raster or CSV was downloaded in this bounded audit.

## Why the existing feature gate stays pending

These are localized rover/site controls, not independent delineations of Jezero, Belva or Neretva Vallis. Rounded Gazetteer feature centers do not identify an exact image landmark; they cannot serve as quantified raster control points. Arithmetic mapping of SPICE coordinates into the current TIFF establishes reproducibility, not empirical image alignment. There is no defensible residual or acceptance threshold to report yet.

The next registration procedure is:

1. Obtain matching PLACES `best_tactical` CSV, map/DEM PDS4 labels and orbital metadata for one delivery; retain identifiers, view, localization clock/sol and pixel convention.
2. Verify the precise base-map/controlled-CTX lineage and latitude/projection differences. Use compatible native images and identify spatially distributed stable features inside this crop.
3. Record paired image landmarks with explicit selection uncertainty, retain independent check points, and fit a transformation only if justified by the products. Report individual residuals, held-out residuals and uncertainty at their actual resolution; do not invent a tolerance from pixel size or decimal precision.
4. Relate named targets to independently defined points or feature geometries and source-specific accuracy. Keep feature registration pending until its evidence and acceptance criteria are met.

## Integrity, access and reproduction

`inspect-spice-controls.py` checks the preserved **65,536-cell** binary and manifest hashes, provider TIFF hash, native shape/geotransform, kernel provenance/checksums, Gaussian conversion, and all 41 candidate cell mappings. No DEM interpolation, resampling, datum change, route calculation or application edit occurs.

- Manifest SHA-256: `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9`.
- Binary SHA-256: `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8`.
- TIFF SHA-256: `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b`.

Fresh access recorded **11 HTTP 200 responses** for the SPICE archive/index/kernel sources, **one NASA NTRS direct-fetch timeout**, and **one Wiley HTTP 403 challenge response**. The saved publisher response is evidence of restricted access, not article content. The separate SIS request returned **HTTP 200**. HTTP success is not browser/CORS verification. This audit did not operate any personal browser or device.

Reproduce from the repository root (use `--offline` with `uv run` when dependencies have been cached):

```powershell
node docs/evidence/scientific-resolution-2026-11-14/registration/fetch-control-sources.mjs --verify-saved
node docs/evidence/scientific-resolution-2026-11-14/registration/fetch-places-sis.mjs --verify-saved
uv run --with spiceypy==8.4.0 --with rasterio python docs/evidence/scientific-resolution-2026-11-14/registration/inspect-spice-controls.py
uv run --with pypdf python docs/evidence/scientific-resolution-2026-11-14/registration/extract-places-sis.py
```

Saved-source verification requires no provider network request. The Python commands require CSPICE/SpiceyPy, Rasterio and pypdf in the evidence runtime; no application dependency is added. Automated app checks, UI integration and the milestone commit are owned by the parent task.
