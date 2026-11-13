# Jezero target-source evidence

Read-only source discovery for Phase 3, retrieved on 13 November 2026 in Africa/Cairo. Request receipts preserve UTC timestamps. No application source or existing documentation was edited by this research task.

## Verified reference records

`target-records.json` contains three proposed **approximate feature references**, not exact landing or sample sites. The source coordinates are explicitly planetocentric latitude, positive-east longitude, 0–360°. All three longitudes already lie in the map's −180–180° domain, so normalization leaves them unchanged. Their active Gazetteer control network is **MDIM 2.1**.

| Reference | Longitude E | Latitude N | Coordinate source | Science context source |
|---|---:|---:|---|---|
| Jezero crater center | 77.69° | 18.41° | USGS/IAU feature 14300 | NASA Mastcam-Z delta description |
| Belva crater center | 77.38° | 18.48° | USGS/IAU feature 15872 | NASA Belva panorama and exposed bedrock interpretation |
| Neretva Vallis center | 77.20° | 18.55° | USGS/IAU feature 15879 | NASA Photojournal PIA26335, river-channel context |

The fourth inspected record, Sava Vallis (feature 15904), is 77.13° E / 19.09° N. It is retained in `gazetteer-inspection.json` as a geographic candidate. No specific science-description source is proposed for it in the compact index.

Jezero's page contains both MDIM 2.1 and older MDIM 2.0 rows. `inspect-sources.mjs` selects the explicitly selected control network before extracting the planetocentric/east-positive rows. Reading every `Center Latitude` field would mix different geometry versions. The selected source gives 77.69° E / 18.41° N; the older hidden version differs.

## Coordinate validation boundary

Matching latitude/longitude convention is established by the live Gazetteer records and source geometry inspection. It is **not** proof that MDIM 2.1 geometry is accurately registered to `Jezero_CTX_BlockAdj_dd`. That preliminary mosaic's precise native latitude convention and control network remain unverified in `docs/data-sources.md`.

The audited controlled CTX and HiRISE labels explicitly establish planetocentric, positive-east equirectangular coordinates on a Mars sphere of radius 3,396,190 m. Their geographic VRTs support the Mars degree display grid. Those sources would remove the unresolved latitude-convention issue for the imagery itself, but no demonstrated MDIM 2.1-to-controlled-mosaic fine-registration test has been performed. They cannot retroactively establish the current preliminary mosaic's coordinate convention.

These centers may be used for **approximate geographic feature inspection and hypothetical endpoint selection**, with that limitation visible beside the marker and details. They must not be represented as pixel-accurate science targets, traversable landing/sample locations, or inputs to validated terrain-based routes. Use source precision (two decimal places) for reference coordinates; do not imply the values have additional physical accuracy by rendering many decimal places. Exact quantitative planning requires validated terrain and coordinate registration in a later milestone.

The smallest honest integration retains the existing imagery and globe, adds a local index of these three source-backed references, allows inspection and assigning different references as a hypothetical origin/destination, and keeps route calculation unavailable with a visible reason. A new controlled imagery layer is a separate source integration rather than a hidden substitute for the current mosaic.

## Source access and terms

All four Gazetteer pages, Mars coordinate guidance, Gazetteer FAQ, USGS copyright page, NASA use guidance, and the three proposed NASA science-context pages returned HTTP 200. Receipts are in `source-http.json` and `additional-source-http.json`. Gazetteer and article pages do not return CORS headers; the proposed index is bundled verified metadata with source hyperlinks, not browser fetches of their HTML.

The Gazetteer FAQ explicitly says that everything in the Gazetteer is in the public domain and proposes this attribution: **International Astronomical Union Working Group for Planetary System Nomenclature. “Gazetteer of Planetary Nomenclature.” (access date).** USGS likewise asks for credit for its information. Source facts and small paraphrased summaries with direct citations are proposed; no logos or republished images are needed. NASA's use guidance permits factual educational/informational use consistent with its guidelines, requests acknowledgement, and does not confer endorsement or rights in third-party material.

The JPL Belva article and landing press-kit HTML probes returned HTTP 403. An initial guessed NASA Neretva news path returned HTTP 404. Those failure receipts and response bodies are retained. They are not used as successful source-access evidence; corresponding accessible NASA Science descriptions supply the proposed context.

The exploratory NASA M20 waypoint feed returned HTTP 200 and CORS `*`, with 708 records in the fetched snapshot. It has **no explicit CRS object in its top-level JSON**. The first record is sol 13/RMC 3_0, not an asserted touchdown coordinate. No exact sol 772 or sol 1155 drive record appears in this snapshot. Therefore the feed is not used to invent precise coordinates for the Belva or Neretva science observations. Its elevation/distance values are not imported as a DEM or recomputed route metrics.

## Reproducibility and actual checks

Commands run: `node docs/evidence/phase-3-targets/fetch-sources.mjs`, `node docs/evidence/phase-3-targets/fetch-additional.mjs`, and `node docs/evidence/phase-3-targets/inspect-sources.mjs`; all final script executions exited 0. HTTP status outcomes must be assessed individually, including the explicit 403/404 results above.

`verify-evidence.mjs` verifies response-byte hashes against receipts, the three selected-network coordinate records against parsed source rows, positive-east/planetocentric conventions, source context phrases, and public-domain Gazetteer attribution. This is evidence validation, not browser smoke testing, fine-registration acceptance, application unit testing, or production-build verification. The root task owns those checks.
