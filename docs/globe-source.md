# NASA visual Mars globe: source and verification

Source retrieval was performed on 25 October 2026. The globe is a visual orientation asset, independent of the Mars Trek regional image layers and any future numerical terrain pipeline.

## Exact asset

- Provider page: [Planet Mars, 3D Model](https://science.nasa.gov/resource/planet-mars-3d-model/).
- Asset: [24881_Mars_1_6792.glb](https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24881_Mars_1_6792.glb).
- Credit on the provider page: **NASA/JPL-Caltech**.
- The page labels the download as glTF, 3.85 MB. The actual resource is binary glTF 2.0 (GLB), with a decoded HTTP body of **4,032,148 bytes**.
- The page's download link appends a changing `emrc` query parameter. The exact link retrieved and the stable URL without that query were both tested. Their SHA-256 hashes matched: `0d27fc65fe3e6a5847cf0cd3a5c951538afdd49bd0513607d8a70e8ab1d8d7ac`.
- Both returned HTTP **200**, `Content-Type: model/gltf-binary`, and `Access-Control-Allow-Origin: *` when requested with `Origin: http://127.0.0.1:5173`.

The page shows 27 April 2019 and a glTF download entry dated 8 March 2024; the asset HTTP response reports `Last-Modified: Fri, 18 Oct 2024 23:30:52 GMT`. These are publication/resource metadata, not verified Mars observation dates.

The saved [HTTP and structure evidence](evidence/globe/asset-http.json) contains actual request times, URLs, headers, body hash, GLB structure, and embedded-image inspection. The asset bytes were inspected in memory; the repository does not include a copy of the model or its textures.

## Inspected contents and loading constraints

- One scene, one mesh, one triangle primitive, one PBR material, and one embedded binary buffer.
- 2,034 vertex records and 9,216 indices (3,072 triangles).
- Base-color and normal textures are embedded PNGs, each **2048 × 1536**. Their internal names end in `.jpg`, but their MIME declarations and binary signatures are PNG.
- There are no external texture/buffer URLs and no required glTF extensions. The model does not require a Draco or KTX decoder.
- The material's metallic factor is 0 and roughness is approximately 0.9. Retain the supplied textures and material; illumination is a display choice, not a claim about current Martian daylight.
- Native vertex bounds are approximately −500 to +500 along X/Z and −497.056 to +497.056 along Y. These are unvalidated visual mesh units, not physical distances. Centering and uniform display scaling must not become a geospatial conversion.

The HTTP requests and binary checks establish availability and structure at retrieval time. They do **not** establish GPU rendering, browser texture decoding, control behavior, or future service availability. Those acceptance checks belong to the application's browser verification record.

## Usage and attribution

NASA's [3D Resources hub](https://science.nasa.gov/3d-resources/) states that its assets are free to download and use and points to the [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). Those guidelines explicitly address polygon data and texture maps used for 3D models, permit educational/informational use on webpages subject to the stated conditions, require source acknowledgment, and prohibit implying NASA endorsement. Marked third-party copyright material has separate restrictions.

No asset-specific third-party copyright notice was found on the inspected model page or in the GLB asset metadata. This is use under NASA's published guidance, not an invented SPDX license or a blanket claim about all NASA content. Credit the visual asset as **NASA/JPL-Caltech**, link its source and usage guidance near the globe, retain REDLINE's independent-project disclaimer, and do not use NASA emblems as product branding. See also the [NASA Brand Center](https://www.nasa.gov/nasa-brand-center/).

## Scientific boundary

The glTF metadata does not establish a scientific datum, a latitude convention, prime-meridian orientation, geographic UV mapping, mesh elevation units, or registration with the Jezero Mars Trek mosaic. Its normal map and polygon geometry are visual content, **not numerical elevation data**.

Do not derive coordinates, elevation, slopes, distances, hazards, or routes from this globe. A Jezero action may open the existing regional workspace as a navigation shortcut; it must not suggest a precise surface target was selected. There is no validated globe-to-regional-map coordinate transform in this milestone. The existing Phase 2 coordinate qualifications remain in force.
