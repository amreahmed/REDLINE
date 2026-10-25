# Globe-to-map alignment investigation

Investigated on 25 October 2026 before implementing the unified explorer handoff. **A geographic mapping for the official NASA GLB has not been validated.** The model is suitable for a visual overview, but the present evidence does not justify treating the camera direction, mesh positions or texture coordinates as a Mars longitude/latitude selection.

## What was inspected

The exact [NASA GLB](https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24881_Mars_1_6792.glb) was fetched again: HTTP 200, CORS `*`, 4,032,148 bytes, with the same SHA-256 recorded in [the source report](globe-source.md). The binary accessors for all 2,034 vertex records, their UV coordinates and the 3,072 indexed triangles were decoded. The embedded 2048 × 1536 base-color texture was extracted to a temporary location and visually inspected; it was not added to the app or repository. This was source-asset inspection, not a browser render of REDLINE.

The mesh/UV evidence is preserved in [alignment-mesh-inspection.json](evidence/globe/alignment-mesh-inspection.json). Important findings:

- The texture is a six-face atlas with padded unused areas, not a rectangular longitude/latitude image. Grouping triangles by the dominant mesh-space axis gives six patches of 512 triangles each. The four side patches lie across the middle texture row; the other two occupy different columns above and below it.
- The GLB metadata contains a Blender glTF exporter name, glTF version, a scene name and a node named `Cube.008`. It has no geographic axis labels, prime-meridian orientation, source-map projection, latitude convention, geographic transform or control-point table.
- Vertex distances from the model origin range approximately 497.056–503.365 in model units. These do not establish a planetary radius, ellipsoid or elevation encoding. Centering or scaling for display cannot supply missing georeferencing.

For example, the nearest vertices on the six **model axes** have these UV values. They are rendering coordinates only:

| Model direction | U | V |
| --- | --- | --- |
| +X | 0.8745 | 0.5000 |
| −X | 0.3767 | 0.4999 |
| +Y | 0.6268 | 0.1686 |
| −Y | 0.1248 | 0.8321 |
| +Z | 0.6268 | 0.5000 |
| −Z | 0.1245 | 0.4999 |

A global `longitude = 360 × U − 180` / `latitude = 90 − 180 × V` conversion would therefore be invalid. Ray-to-triangle intersection could recover a model-space point or atlas UV, but it would not by itself attach that point to a planetary coordinate system. Three.js/glTF axis conventions define graphics orientation, not Martian north and the prime meridian.

## Geographic reference check

The [NASA model page](https://science.nasa.gov/resource/planet-mars-3d-model/) supplies the download and NASA/JPL-Caltech credit, but no geographic calibration or tie-point instructions. The atlas visibly contains recognizable Martian terrain and polar features; visual recognition alone does not establish an axis transform or an accuracy bound.

Authoritative references exist for a future calibration. The [USGS Mars coordinate guidance](https://planetarynames.wr.usgs.gov/Page/MARS/system) distinguishes planetographic/west-positive and planetocentric/east-positive systems. The [USGS Olympus Mons record](https://planetarynames.wr.usgs.gov/Feature/4453) provides feature locations under different control-network/coordinate selections and cautions that its feature boundaries are approximate. These references were inspected, but no measured multi-landmark fit or residual validation against this GLB was completed. No feature location from those pages is introduced into the application as a globe control point. Reference retrieval evidence is in [alignment-reference-evidence.json](evidence/globe/alignment-reference-evidence.json).

## Honest handoff for this milestone

Use zoom to move between the visual overview and a labeled **Jezero map context**, or to resume the previously explored map area. State before the handoff that globe orientation does not determine the destination. Keep a short shared-viewport transition, but do not describe it as a spatially registered fly-to. Returning to the globe restores an overview, without asserting that its center matches the map's location.

The regional map retains its inspected Mars Trek angular grid and service bounds. MOLA provides broad context where available; CTX is limited to its real coverage and appropriate detail zoom. The fallback is a navigation policy, not invented geographic evidence. No globe-to-map coordinate conversion or precise surface pin should be implemented from the present model.

## Evidence needed for a precise handoff

Either obtain the model author's georeferencing contract (atlas face layout/projection, axis transform, longitude direction/domain, latitude convention and datum), or use an independently georeferenced global texture/grid with that metadata. For calibration of this existing asset, identify multiple well-distributed geographic control points on its actual triangles/texture, fit a declared transform, then test independent hold-out points, seam crossings and polar regions with recorded residuals appropriate to the intended display scale. A single recognizable crater or successful coordinate round-trip is insufficient.

Registration with Mars Trek, particularly the still-unverified native Jezero CTX convention, must be checked separately. Even a validated navigation transform would not turn the visual mesh or its normal map into a numerical DEM. The user later reported all six unified explorer browser checks PASS; that display-workflow evidence is recorded in [the verification record](unified-explorer-verification.md) and does not establish geographic alignment.
