# Global Mars POI provenance

These are exploration references, not precise planning endpoints, live rover
positions, terrain observations, or certified safety results. This addition
does not change the existing science targets, terrain pipeline, coordinate
transformations, routing costs, or validation gates.

The catalog in `src/data/marsPois.ts` contains 15 source-backed records: seven
mission landing references, six geological landmarks, and two contextual
science-feature centers. No guessed impact or debris location is included.

## Coordinates and identities

All catalog longitudes are east-positive in the 0–360° domain; all latitudes
are planetocentric. Keep these values and reference definitions when rendering
or converting to signed longitude. Decimal precision does not establish
positional accuracy. No record is independently registered to the current
global CTX mosaic or the numerical DEM.

| POI ID | Longitude °E | Planetocentric latitude ° | Coordinate evidence |
| --- | ---: | ---: | --- |
| perseverance | 77.45088572 | 18.444627153952787 | NAIF M2020 landing vector; 2021-03-03 solution |
| curiosity | 137.4417 | -4.589499788236298 | NAIF MSL landing vector; 2012-08-08 solution |
| opportunity | 354.4734 | -1.9462 | PDS MER map-relative MOLA IAU 2000 frame |
| spirit | 175.4729 | -14.5692 | PDS MER map-relative MOLA IAU 2000 frame |
| viking-1 | 312.05 | 22.27 | NASA explicitly planetocentric rounded reference |
| viking-2 | 134.29 | 47.64 | NASA explicitly planetocentric rounded reference |
| insight | 135.623447 | 4.502383577390144 | NAIF landing vector; ops181206 reference |
| olympus | 226.20 | 18.65 | USGS/IAU Feature 4453, active MDIM 2.1 center |
| valles-marineris | 301.41 | -14.01 | USGS/IAU Feature 6288, active MDIM 2.1 center |
| elysium-mons | 147.21 | 25.02 | USGS/IAU Feature 1783, active MDIM 2.1 center |
| gale | 137.81 | -5.37 | USGS/IAU Feature 2071, active MDIM 2.1 center |
| hellas | 70.50 | -42.43 | USGS/IAU Feature 2432, active MDIM 2.1 center |
| jezero | 77.69 | 18.41 | Existing source-backed science-target record; Feature 14300 |
| belva | 77.38 | 18.48 | Existing source-backed science-target record; Feature 15872 |
| neretva | 77.20 | 18.55 | Existing source-backed science-target record; Feature 15879 |

### Mission landing references

- [NASA Viking mission](https://science.nasa.gov/mission/viking/) explicitly
  publishes planetocentric north/east coordinates and the landing dates July
  20, 1976 and September 3, 1976. The coordinates are rounded to 0.01°; no metre
  uncertainty or current-imagery registration is supplied.
- [PDS MER mission catalog](https://pds-geosciences.wustl.edu/mer/mer1-m-pancam-3-radcal-sci-v2/mer1pc_1002/catalog/mission.cat)
  distinguishes inertial radio-navigation solutions from map-relative
  surface-feature coordinates in the MOLA IAU 2000 cartographic frame. This
  catalog uses the latter. [USGS Mars coordinate guidance](https://planetarynames.wr.usgs.gov/Page/MARS/system)
  documents MOLA and modern-map planetocentric/east-positive conventions.
  The PDS catalog also supplies January 4 and January 25, 2004 **UTC** landing
  dates. [Spirit](https://science.nasa.gov/mission/mer-spirit/) and
  [Opportunity](https://science.nasa.gov/mission/mer-opportunity/) pages
  supply mission context. These markers are landing references, not the
  rovers' final positions; four published decimals are not an uncertainty.
- [Curiosity landing kernel](https://naif.jpl.nasa.gov/pub/naif/MSL/kernels/spk/msl_ls_ops120808_iau2000_v1.bsp):
  target -76900, `MSL_LANDING_SITE`, actual 2012-08-08 solution, fixed
  `IAU_MARS` vector. Its **Gaussian input latitude -4.643851°** is different
  from the planetocentric latitude obtained from the XYZ vector.
  [NASA Curiosity mission](https://science.nasa.gov/mission/msl-curiosity/)
  supplies the August 6, 2012 landing date and mission purpose.
- [Perseverance landing kernel](https://naif.jpl.nasa.gov/pub/naif/pds/pds4/mars2020/mars2020_spice/spice_kernels/spk/m2020_ls_ops210303_iau2000_v1.bsp):
  target -168900, `M2020_LANDING_SITE`, 2021-03-03 solution. Its Gaussian
  input latitude 18.64875816° is different from its planetocentric latitude.
  The unchanged prior `scientific-resolution-2026-11-14/registration/`
  evidence contains the actual kernel, PDS label, HTTP receipt and coordinate
  derivation. This point lies **outside the preserved 65,536-cell terrain
  crop**. It is not a current rover position or a validated mission endpoint.
  [NASA Perseverance mission](https://science.nasa.gov/mission/mars-2020-perseverance/)
  supplies the February 18, 2021 landing date and mission purpose.
- [InSight landing kernel](https://naif.jpl.nasa.gov/pub/naif/INSIGHT/kernels/spk/insight_ls_ops181206_iau2000_v1.bsp):
  target -189900, `INSIGHT_LANDING_SITE`. Its comments identify an actual
  landing-site reference based on the December 6, 2018 MRO HiRISE image;
  they do not quantify positional uncertainty. Gaussian input latitude
  4.555681° must not be used as planetocentric latitude.
  [NASA InSight mission](https://science.nasa.gov/mission/insight/) supports
  the November 26, 2018 landing date, Elysium Planitia location and interior
  science context.

`inspect-landing-kernels.py` loads the archived fixed IAU_MARS vectors using
SpiceyPy/CSPICE and derives longitude/planetocentric latitude with `reclat`.
It reuses unchanged `pck00010.tpc` and `naif0012.tls` from the prior audit;
the Curiosity kernel comments cite `pck00008.tpc` for its original PINPOINT
ellipsoid construction. The extraction uses the stored Cartesian vector
and does not reconstruct Gaussian coordinates or infer an elevation datum.
Kernel coverage spanning 2000–2100 is validity coverage for a fixed vector,
not an observation date. No landing kernel supplies positional uncertainty.

### Named landmarks and science context

Gazetteer pages contain older networks and multiple latitude/longitude
conventions. `inspect-gazetteer.mjs` explicitly extracts each selected
**MDIM 2.1** network and the **cs-6** planetocentric/east-positive rows.
For example, Olympus' older network center differs from its selected
18.65°/226.20° center. Only the selected network is used.

Gazetteer descriptors support the concise mountain/valley/low-plain
descriptions. These approximate centers are neither whole footprints,
summit surveys, rover positions nor precisely registered science targets.
The Jezero, Belva and Neretva records reuse the existing immutable
`scienceTargets.ts` descriptions and first positional qualifications,
with NASA science links retained in `references`. Their full earlier
evidence and qualifications remain under `docs/evidence/phase-3-targets/`.

The related layer IDs are discovery associations, **not coverage promises**.
The layer registry's actual bounds and missing-data policies decide whether
imagery is available at any selected coordinate. Imagery is not elevation.

## Access evidence and reproducibility

`source-http.json` records actual November 14–15, 2026 UTC requests, final
URLs, HTTP outcomes, byte counts and SHA-256 hashes. Included current
coordinate/mission sources returned HTTP 200. Belva/Neretva references and
Perseverance's PDS kernel reuse the cited earlier archived HTTP receipts.
Dates of retrieval are not dates of mission events or imagery acquisition.
The catalog is local, curated metadata; no browser CORS dependency or live
source availability is implied by those HTTP checks.

Run offline from the repository root:

```powershell
node docs/evidence/global-globe/pois/verify-snapshot.mjs
node docs/evidence/global-globe/pois/inspect-gazetteer.mjs
uv run --offline --with spiceypy==8.4.0 python docs/evidence/global-globe/pois/inspect-landing-kernels.py
npm test -- src/data/marsPois.test.ts
npx eslint src/data/marsPois.ts src/data/marsPois.test.ts --max-warnings 0
```

SpiceyPy 8.4.0 was available in the local uv cache; this is an evidence-only
tool and adds no production dependency. The older `fetch-*` research helpers
show how sources were obtained; their historical outputs and failures are
retained. Inspectors and hash verification, rather than refetching provider
HTML over snapshots, reproduce this catalog's coordinate evidence.

### Investigated but excluded

- NASA NSSDCA's `mars_mileage_guide.html` returned HTTP 200, but its
  Spirit/Opportunity longitudes conflict with the PDS map-frame locations.
  Its values are not used.
- NASA GISS Mars24 lander HTML returned HTTP 200 via PowerShell after the
  Node TLS request failed before a response (`UND_ERR_SOCKET`). Its saved
  UTF-8 Content capture is explicitly identified in the receipt. It does
  not explicitly establish latitude convention for the rounded lander
  table, so its coordinates are not used.
- The investigated NAIF `/pub/naif/MPF/kernels/spk/` URL returned HTTP 404.
  No independently established Pathfinder/Sojourner landing-coordinate
  contract was obtained in this work, so those POIs are omitted.
- No credible, coordinate-qualified impact/debris record was established
  here. None is fabricated or labeled confirmed.

## Verification boundary

Source publication, catalog transcription and the documented fixed-vector
planetocentric extraction are checked. Absolute feature-to-DEM or
feature-to-global-CTX registration remains unverified, as does the physical
accuracy of any displayed globe alignment. These POIs do not resolve
vertical-reference questions or unlock terrain-aware routing. Browser
marker visibility, fly-to behavior, camera alignment and accessibility
belong to the parent globe-integration verification.
