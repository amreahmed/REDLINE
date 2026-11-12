# Globe orientation and scripted approach

The cinematic Jezero approach uses an **approximate scripted globe rotation**, followed by the independently centered regional map. It does not transform a globe surface selection into a Mars coordinate. The regional map's sourced Jezero navigation reference is separate from the visual camera pose.

## Evidence rechecked before implementation

On 25 October 2026, the official [NASA Mars GLB](https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24881_Mars_1_6792.glb) was retrieved again with HTTP 200. Its 4,032,148 bytes have the same SHA-256 as the existing source evidence: `0d27fc65fe3e6a5847cf0cd3a5c951538afdd49bd0513607d8a70e8ab1d8d7ac`. Its base-color atlas was extracted to a temporary file and viewed locally. This was a source-image inspection, not a REDLINE browser render.

The atlas contains polar, dark-terrain and crater features in six cube-face patches. The [saved mesh/UV inspection](evidence/globe/alignment-mesh-inspection.json) places each model axis in a separate atlas patch, with 512 triangles per face. A single longitude/latitude UV formula is invalid. The GLB asset metadata still contains only the Blender exporter and glTF version, with the mesh node named `Cube.008`; there is no geographic axis transform, prime-meridian mapping, geographic UV contract or tie-point table.

The [prior alignment investigation](globe-alignment.md) checked the official NASA model page and authoritative USGS coordinate/feature references. Those references distinguish planetary latitude and longitude conventions, but do not attach a known geographic location to this GLB's triangles. Visual recognition of polar or other terrain features does not supply a validated mapping or an error bound. No independently tested multi-landmark fit was obtained. The implementation therefore uses the user's expressly permitted approximate animation, retaining the geographic limitation rather than inventing a Jezero pin or coordinate picker.

## Display motion

The official model geometry, base-color texture, normal texture, material and attribution remain unchanged. `src/features/globe/flightPose.ts` samples a spherical camera pose in arbitrary graphics units:

- Ease from the current camera distance to a complete-globe overview while preserving the current view direction, then begin the approach.
- Rotate by a modest scripted 0.65 radians of azimuth and at most 0.12 radians of polar tilt. These are graphics angles chosen for motion, not Martian longitude/latitude or a claimed Jezero orientation.
- Let rotation lead a logarithmic camera dolly, with quintic easing at the endpoints, finishing at display distance 1.9.
- Capture the current and overview radii once. Resizing updates canvas size and projection without changing the current sampled camera position or restarting the flight.

The explorer owns the animation clock, opacity and map handoff. The globe controller exposes `beginApproach()`, `setOverviewProgress(progress)`, `setApproachProgress(progress)` and `endApproach()`. Beginning captures the current pose without moving the camera. Overview progress eases the radius while preserving direction; its final pose matches approach progress zero exactly. Progress can run backward over the same sampled paths. Duplicate begins are ignored; reset, interruption, context loss and disposal prevent progress from moving or rendering the camera when no flight is active. The coordinator rejects callbacks from older flight generations. The controller can render flight frames while ordinary user input is disabled and suppresses zoom-threshold feedback during the scripted approach.

An explicit action that begins from a zoomed-in camera uses the overview-preparation path before the approach, avoiding an abrupt outward radius jump. The coordinating explorer is responsible for that staging and for reduced motion. The globe controller introduces no independent animation loop.

## Automated evidence and remaining verification

`npm test -- src/features/globe/flightPose.test.ts src/features/globe/createMarsGlobe.test.ts` passed all **14 tests**. The pose suite first failed because the implementation module did not yet exist, then passed after implementation. The added preparation-path tests failed against the previous controller's abrupt radius change and absent preparation method, then passed after the new hooks were implemented. Tests cover camera endpoints, exact preparation-to-approach continuity, monotonic motion, easing, reversible sampling, aspect-safe overview distances, captured-radius behavior, duplicate begin, interruption, reset/replay and disposal/context-loss guards. The controller tests explicitly mock the renderer and model loader with synthetic graphics fixtures; they do not prove browser or GPU rendering.

Focused ESLint passed for the four globe source/test files. Whole-application lint/typecheck/test/build verification belongs to the main milestone record after the other coordinated changes are complete. Actual animation quality, globe/map continuity, texture rendering and resizing remain subject to manual browser acceptance. The saved browser permission/managed-policy restriction was not bypassed.
