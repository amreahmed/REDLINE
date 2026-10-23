# REDLINE — Mars Mission Intelligence System
## AI Agent Project Specification & Build Brief

**Project type:** Web application / planetary mapping and mission-planning demonstrator  
**Challenge:** NASA Space Apps Challenge 2026 — *Interplanetary Survival Guide: Martian Map*  
**Prepared:** 23 October 2026  
**Primary audience:** AI coding agent / autonomous software development agent  
**Primary outcome:** A polished, working web prototype that combines Mars map layers from authoritative planetary-science sources and demonstrates transparent, terrain-aware Marswalk route comparison.

---

# 0. Instructions to the AI Agent

Act as a senior product designer, geospatial engineer, frontend engineer, and pragmatic full-stack developer. Build the application described in this document in the current project repository.

Do not respond with only a plan or mockup. First inspect the existing repository and available runtime, then implement the best working version that fits the environment. Preserve existing useful code. If the repository is empty, initialize a suitable project. Make sensible decisions without asking questions unless a genuine blocker makes implementation impossible.

**Non-negotiable requirements:**
1. Deliver a functioning, responsive application, not a static screenshot.
2. Use real, cited NASA/planetary data where it can be accessed reliably. Verify service URLs, layer identifiers, spatial reference systems, coverage, attribution, and terms before coding against them.
3. Never fabricate live NASA data, scientific measurements, source citations, slope values, coordinates, hazard observations, route metrics, or probability-of-survival figures.
4. Clearly label illustrative/sample content. If a data service is unavailable, the UI must show a graceful fallback and explain whether it is demonstration data.
5. Do not treat map-image RGB colors as a numerical digital elevation model (DEM). A route engine needs an actual elevation/terrain dataset or an explicitly labeled sample grid.
6. Explain that the prototype is a research and mission-planning aid, not a certified human-safety system.
7. Ensure the app starts locally, provide exact setup/run instructions, and verify the main user journey before finishing.
8. Read the official challenge page and current participant rules again before final submission. Full 2026 challenge statements/resources were announced for 28 October 2026; the event is scheduled for 14–15 November 2026. Follow official rules regarding when implementation and submission work may begin.

At completion, summarize what was actually implemented, what is data-backed, what is simulated, what remains incomplete, and how to run it. Do not claim success for a feature that has not been tested.

# 1. Executive Summary

**REDLINE** is an interactive Mars mission-intelligence workspace. It combines mapped planetary data, terrain context, points of scientific interest, and transparent route-comparison tools to help users explore a region of Mars and reason about a hypothetical surface traverse.

The product should feel like a mission-planning instrument rather than a generic marketing page. Its core experience is a layered map workspace with a clear route-planning workflow. Users can select a destination, toggle scientific layers, compare alternative routes, inspect risk factors, and understand the data and assumptions behind each recommendation.

**Core product promise:** “Explore the terrain. Understand the trade-offs. Plan with evidence.”

REDLINE should demonstrate one focused workflow exceptionally well: a user chooses an origin and a science target in a supported Mars region, selects a planning objective, and compares routes using the terrain data that is actually available. The initial demo may focus on Jezero Crater / Perseverance exploration context if compatible, well-documented datasets can be integrated. Do not imply that an astronaut has been validated as safe to traverse a proposed route.

# 2. Challenge Context and Problem Statement

NASA has explored Mars robotically for decades. Future human explorers will need integrated maps that combine data from multiple missions, explain route and destination details, help plan surface traverses, and support meaningful science along the way. The selected challenge asks teams to create a layered and integrated view of a location or route on Mars using data from multiple NASA science missions.

Common user problems include:
- Scientific information is distributed across mission archives, instruments, image products, and mapping services.
- A visually compelling map is not enough: users need to understand terrain, data coverage, and the limitations of the evidence.
- Route options involve trade-offs between distance, terrain difficulty, uncertainty, and scientific interest.
- Non-specialists need understandable explanations instead of unexplained technical overlays.

**Project goal:** Make these layers and trade-offs understandable through one coherent, accessible, interactive interface.

**Primary user:** A student, science communicator, mission-planning learner, or researcher exploring a hypothetical Mars traverse.

**Secondary users:** NASA Space Apps judges, educators, planetary-science enthusiasts, and future mission-planning teams evaluating the concept.

# 3. Product Positioning and Differentiator

Most basic Mars-map prototypes risk becoming an image viewer with a few pins. REDLINE must be an evidence-first decision-support prototype.

Its differentiators are:
1. **Integrated layers:** imagery, topography/relief, roughness or thermal layers, and localized high-resolution context where a real service provides coverage.
2. **Transparent route comparison:** show how a route is scored, which criteria affected it, and what trade-off the user is accepting.
3. **Science targets with provenance:** each point of interest explains why it is shown and links to the relevant data or mission source.
4. **Uncertainty by design:** show data coverage, missing data, age/mission context where known, and the difference between a terrain observation and an inferred hazard.
5. **Demo-ready narrative:** a guided scenario lets a judge change the target or objective and immediately see the map, route, and explanation respond.

Do not add AI chat merely for novelty. A lightweight explanatory assistant is optional and must ground answers in displayed data and application rules. Transparent deterministic logic is preferred over unsupported generative conclusions.

# 4. Experience and Information Architecture

## 4.1 Main screens

### A. Mission Workspace — primary screen
- Full-screen map workspace with a collapsible left control rail and right-hand detail panel.
- Global Mars locator or small 3D globe for orientation; a region-scale map for the actual traverse.
- Header with REDLINE brand, mission selector, active region, data status, and help/about controls.
- Layer controls grouped into Basemap, Terrain, Environment/Context, and Science.
- Origin and destination selectors.
- Route objective selector.
- Route alternatives and a compact comparison table/card stack.
- Legend, scale or distance reference, coordinate readout, and source/status indicators when supported by the map implementation.

### B. Mission Planner
- Choose origin and destination from supported, known coordinates or selectable map points.
- Choose objective: **Shortest**, **Lower terrain cost**, **Science-focused**, or **Balanced**.
- Set preference sliders only if the underlying scoring engine supports them transparently.
- Show the current assumptions and available data coverage before computing.

### C. Science Target Details
- Target name and coordinates.
- Why the target is scientifically interesting, based only on cited/grounded metadata.
- Related instrument, mission, product, or observation where known.
- Image/metadata source link and acquisition/product context if available.
- A visible confidence/provenance label: Verified dataset, sourced interpretation, or illustrative demo item.

### D. Route Analysis Panel
- Route name and the numeric metrics genuinely calculated by the app, such as route length and maximum/mean slope if true elevation samples exist.
- Terrain-cost or uncertainty indicators with explanatory tooltips.
- Route geometry on the map.
- Criteria breakdown with a concise “Why this route?” explanation.
- Side-by-side route selection.
- Data limitations and an explicit warning that computed scores are model outputs—not validated probabilities of safety.

### E. Mission Report / Share View
- Export or print a concise summary of selected origin, target, selected route, source layers, actual metrics, scoring configuration, limitations, and data timestamps when known.
- Make export optional if time is limited; first ensure the main map experience works.

### F. About & Sources
- Project intent and limitations.
- Data-provider links, attribution, and last successful fetch status.
- Clear statement that REDLINE is an independent hackathon prototype and is not an official NASA product unless explicitly authorized. Do not use NASA branding in a manner that implies endorsement.

## 4.2 Main user journey
1. User opens the app and sees Mars with a clearly marked “Open mission workspace” action.
2. The app loads a default example region and shows the currently available data layers.
3. User toggles one or more layers and can tell which data source each layer uses.
4. User chooses an origin and a scientific destination.
5. User chooses an objective and requests route comparison.
6. The system displays only routes and metrics it can actually compute from the available datasets.
7. User selects a route and sees an explanation of cost factors, uncertainties, and source data.
8. User exports or presents the mission summary.

# 5. Functional Requirements

## 5.1 Map and navigation
- Provide an interactive map with pan, zoom, reset-to-region, and clickable/selectable targets.
- Where practical, include a visual Mars globe/orientation view using a properly sourced global texture; the regional map remains the authoritative interaction surface.
- **Use NASA's official Planet Mars 3D Model as the default candidate visual globe asset:** https://science.nasa.gov/resource/planet-mars-3d-model/ . The NASA page provides a downloadable glTF model (listed as 3.85 MB) and USDZ alternative. Verify the current download, file contents, texture/material references, and usage guidance before integrating it.
- Load the glTF asset with Three.js `GLTFLoader` (or React Three Fiber with the compatible loader). Include a loading state, useful error fallback, responsive sizing, orbit/rotation controls, and sensible performance behavior. Do not assume the asset's material/texture maps or internal scale are suitable for quantitative analysis without inspection.
- Treat this downloaded globe as a **visual/orientation model only**. It does not replace the separate numeric elevation/DEM data required to calculate slope or terrain-based route costs. Keep the visual globe and quantitative regional map/data pipeline clearly separated unless a validated geospatial transformation connects them.
- Do not use Earth basemap defaults or Earth coordinates as if they were Mars.
- Respect the Mars spatial reference system/projection advertised by the selected data service. Do not assume Web Mercator works for every Mars service.
- Display missing-coverage areas as missing data, not as zero elevation or safe terrain.
- Keep the interface usable on desktop first, with responsive tablet/mobile fallbacks.

## 5.2 Layer manager
Implement at least three data layers if services/data permit:
- **Global or regional imagery:** for visual context.
- **Topography / shaded relief:** MOLA/HRSC products where supported.
- **Local high-resolution image/context:** e.g., HiRISE or CTX over a supported region.

Optional further layers, only if correctly integrated:
- THEMIS day/night infrared mosaics or related thermal context.
- Surface roughness product.
- Published geologic units or sourced science targets.

Every layer needs: human-readable name, short explanation, source/provider, service/product identifier, coverage limitations, loading/error state, and a legend if its symbols/colors require interpretation. Layer toggles must visibly affect the map.

## 5.3 Targets and waypoints
- Include a small number of sourced example targets, preferably within one well-supported study region.
- Use distinct map symbols for origin, destination, science target, and caution/uncertainty marker.
- Clicking a target opens a details panel and updates the coordinate readout.
- Provide a legend; do not communicate status through color alone.
- Any sample target without verified scientific provenance must be labeled as a demo waypoint.

## 5.4 Route planner
- Compare a minimum of two alternatives when valid terrain/graph data are available; three route profiles are preferred.
- Provide objective modes: shortest route, lower terrain cost, science-focused, and balanced. If one mode cannot be scientifically justified by the available data, disable it and explain why rather than inventing capability.
- Show route length only when computed from route geometry in a consistent Mars coordinate system.
- Show slope statistics only when calculated from a real DEM or validated elevation samples with correct units and spatial reference.
- Show a cost breakdown and explain the units and normalization used.
- If a route depends on a sample grid, mark it “Illustrative terrain simulation” throughout the UI and in exports.

## 5.5 Search and exploration
- Allow search for known regions/targets included in the local index.
- If implementing free-text planetary place search, use a real source or local dataset; otherwise use a clearly labeled supported-region selector.
- Provide a “data available in this view” indicator.

## 5.6 State, feedback, and errors
- Display loading skeletons/spinners during requests.
- Offer retry and a graceful fallback when external data services fail, time out, or block browser requests.
- Never fail the entire app because one optional layer fails.
- Cache stable metadata where appropriate; respect the service provider's usage guidance.
- Show when a layer is offline, cached, sample-based, or newly fetched.

# 6. Data Strategy and Scientific Integrity

## 6.1 Candidate authoritative sources
Verify access and metadata before implementation. These are starting points, not a claim that every layer is guaranteed to work in a browser.

1. **NASA official Planet Mars 3D Model** — https://science.nasa.gov/resource/planet-mars-3d-model/  
   The page offers a downloadable glTF model and a USDZ alternative. Use the glTF for a Three.js visual globe after checking the current download, textures/materials, attribution, usage guidance, and loading behavior. This is a display asset, not the numeric DEM used for slope/route calculations.
2. **NASA Mars Trek** — https://trek.nasa.gov/mars/  
   Map exploration tool for Mars products.
3. **Mars Trek WMTS/API documentation** — https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars  
   Documents WMTS tile services and lists layers, extents, and projection identifiers. The documentation describes discovery through GetCapabilities and notes that missing tiles indicate missing coverage.
4. **NASA Planetary Data portal** — https://planetary.data.nasa.gov/  
   Discovery hub for planetary mission data, archives, and software.
5. **USGS Astrogeology CTX data guide** — https://astrogeology.usgs.gov/docs/concepts/missions/mro/ctx-data/  
   Describes CTX as wider-context imagery that complements narrower, higher-detail imagery.
6. **NASA/JPL/Planetary Data System archives** — find authoritative product data and metadata through the NASA planetary-data portal rather than assuming a legacy endpoint is current.
7. **NASA official challenge page** — https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/  
   Re-read for final challenge requirements, data links, submission format, and rules.

Examples of layer identifiers listed by the Mars Trek service documentation include a global Viking color mosaic, MOLA color hillshade, MOLA roughness, THEMIS day/night infrared mosaics, and localized HiRISE/CTX mosaics. Before use, confirm each exact layer ID, projection, endpoint, supported zoom levels, coordinate extent, image format, CORS policy, and attribution from the current GetCapabilities/metadata response.

## 6.2 Recommended initial area
Start with **Jezero Crater** as a candidate demonstration area because it has well-known rover exploration context and documented orbital image products. Confirm the actual spatial overlap and availability of required data layers. If robust terrain elevation data cannot be accessed for the chosen area within the build window, pick a region with more reliable available data instead of simulating coverage as real.

## 6.3 Data pipeline
For every dataset, store a compact registry with:
- `id`
- `displayName`
- `mission` / `instrument`
- `provider`
- `productId` / layer ID
- `serviceUrl` / archive URL
- `spatialReference` / projection
- `coverage` / bounding box
- `units` if numerical
- `acquiredAt` or product date when known
- `accessedAt` for retrieval status
- `attribution`
- `licenseOrUseNotes` where applicable
- `isSampleData`
- `limitations`

Use a typed adapter per source so map components do not need to know source-specific details. A failed source adapter must return a typed error/status rather than crash the whole screen.

## 6.4 Important distinction: map tiles versus numerical data
Rendered WMTS tiles are images. They are suitable for a visual layer, but their pixels are not a dependable source of measured elevation or slope unless the service explicitly documents a numerical encoding and the decoder follows that specification. Do not derive DEM values from colorized hillshade images. For numeric route costs, obtain a real DEM/raster dataset and understand its units, nodata value, pixel spacing, projection, and conversion to physical distance. If this is too large for the prototype, use a preprocessed, cited sample of actual DEM values or a clearly marked synthetic test grid.

## 6.5 Attribution and data provenance
- Attribute the specific data products and providers, not only “NASA data”.
- Include direct source links beside layer metadata or in a source drawer.
- Distinguish raw observation, derived product, app-calculated statistic, and explanatory interpretation.
- Record limitations and gaps.
- Do not imply that NASA endorses REDLINE.
- Check current usage terms for every dataset, library, image, and icon set.

# 7. Terrain and Route-Scoring Design

## 7.1 Preferred algorithm
If valid terrain/elevation samples are available, represent the selected study area as a grid or navigable graph. Use Dijkstra or A* over an 8-connected grid/graph, with geodesic/planet-aware distance costs where appropriate. Avoid naïve Euclidean distance in latitude/longitude for large or high-latitude regions.

A transparent generic cost function may be structured as:

`edgeCost = distanceCost + slopePenalty + roughnessPenalty + uncertaintyPenalty - sciencePreferenceBonus`

All terms must be defined, normalized, and explained. Any hard exclusion or high-cost threshold must be documented. Use actual available factors only; never present a factor as measured if it is a user-defined assumption.

## 7.2 Route profiles
- **Shortest:** minimize computed path distance; do not label it safest.
- **Lower terrain cost:** minimize a defined slope/roughness cost if those datasets exist.
- **Science-focused:** optimize a published or clearly documented science-interest score while respecting defined terrain constraints. If science scores are not grounded, disable this route mode or make it an explicitly illustrative demonstration.
- **Balanced:** trade off route distance, terrain cost, and eligible science targets using user-visible weights.

## 7.3 Route metrics and semantics
- **Distance:** computed along the returned route from a consistent spatial model.
- **Slope:** computed from DEM elevation differences and true horizontal distances; report degrees or percent and state which.
- **Roughness:** use a documented product or an explicit derived calculation with units/scale.
- **Hazard:** use only as a cautious label for mapped or inferred terrain concerns. Do not infer rockfalls, dust storms, radiation, or traffic hazards from imagery without appropriate evidence.
- **Science value:** use citation-backed target/metadata or an explicitly user-set preference, not an invented scientific truth score.
- **Confidence:** describe data coverage/quality or model certainty—not a false probability of human survival.

## 7.4 Missing data and safety semantics
If a route crosses a no-data cell, either block it, penalize it transparently, or mark the route incomplete according to the data policy. Never treat nodata as flat terrain. Use “terrain-cost estimate,” “mapped concern,” or “data gap” instead of “safe/unsafe” unless evidence and thresholds justify the language. Display: **“Decision-support prototype only. Route scores are model outputs and are not validated human-safety predictions.”**

# 8. Visual Design System

## 8.1 Art direction
A premium mission-control interface: dark charcoal/navy panels, warm Martian rust/orange accents, restrained cyan for selected data and navigation states, and neutral typography. The map must remain the hero; avoid making every panel a glowing neon card.

Suggested color tokens:
- App background: `#0B0F14`
- Panel background: `#121922`
- Elevated surface: `#18222D`
- Primary text: `#F2F5F7`
- Secondary text: `#A8B3BE`
- Mars accent: `#E06B45`
- Science cyan: `#58C7D8`
- Success/available: `#58B88A`
- Warning: `#E6B35C`
- Error: `#ED6A6A`

Use color tokens consistently. Ensure contrast meets WCAG AA where feasible. Add symbols or labels alongside color-coded state.

## 8.2 Typography and layout
- Use a modern, legible sans-serif such as Inter or a bundled system equivalent.
- Clear type hierarchy: title, panel heading, metric, label, helper text.
- Use compact information density appropriate for a mission tool, but allow panel scrolling and keep important controls easy to find.
- Use a consistent spacing scale and medium radii. Avoid unnecessary gradients, oversized empty hero sections, heavy glassmorphism, and decorative animations that distract from analysis.
- Add hover, focus, selected, loading, empty, and error states.

## 8.3 Motion
- Subtle transitions for panel opening, layer toggles, and route changes.
- Respect `prefers-reduced-motion`.
- No motion that blocks map interaction or delays the task.

## 8.4 Brand
Use the wordmark **REDLINE** with a simple orbital/route-line motif. Do not create a fake official NASA insignia, misuse agency marks, or claim NASA endorsement.

# 9. Suggested Technical Architecture

Select the simplest reliable stack supported by the repository. Recommended default:
- **Frontend:** React + TypeScript + Vite.
- **UI/styling:** Tailwind CSS or existing design system; accessible headless components if useful.
- **Maps:** OpenLayers for regional 2D map layers, provided its projection/tile support is configured from the actual Mars Trek service metadata. Do not assume generic Earth map projections. If another tool is better supported by the selected Mars CRS, use it and document the decision.
- **3D orientation (optional):** Three.js sphere with a properly attributed global Mars texture. Keep this separate from the quantitative regional route calculations unless the 3D scene uses the same validated coordinate/geometry model.
- **Data fetching:** typed source adapters using `fetch`, request timeout/abort, error boundaries, and loading states.
- **Terrain processing:** Python preprocessing is optional for DEM clipping/resampling, if a backend or build-time script is appropriate. Do not ship huge raw rasters to the browser unnecessarily.
- **Routing:** run grid-based route search on an appropriate client worker or backend depending on grid size. Avoid freezing the UI.
- **Testing:** unit tests for coordinate conversion, scoring, pathfinding, nodata handling, and route metrics; smoke test for key user workflow.

A backend is not mandatory for an MVP. Do not add a database, authentication, cloud infrastructure, or LLM service unless a real requirement justifies it. No API secrets should be embedded in public frontend code.

# 10. Suggested Project Structure

Adapt to the existing repository; do not force this exact structure if an equivalent structure already exists.

```text
src/
  app/
    App.tsx
    routes.tsx
  components/
    layout/
    map/
    layers/
    mission-planner/
    route-analysis/
    science-targets/
    shared/
  features/
    mission/
    routing/
    datasets/
  data/
    layerRegistry.ts
    demoScenario.ts
    scienceTargets.ts
  services/
    marsTrekClient.ts
    datasetMetadata.ts
  lib/
    coordinates/
    terrain/
    route-cost.ts
    pathfinding.ts
    validation.ts
  styles/
  tests/
public/
  icons/
  textures/
scripts/
  preprocess-dem.*
README.md
.env.example
```

# 11. Core Data Models

Use typed domain models similar to these (adjust as needed):

```ts
type DataStatus = "live" | "cached" | "sample" | "unavailable";

type MarsCoordinate = {
  lat: number;     // planetographic or planetocentric convention must be declared
  lon: number;     // east/west convention must be declared
  datum?: string;
  crs?: string;
};

type LayerDefinition = {
  id: string;
  name: string;
  description: string;
  provider: string;
  mission?: string;
  instrument?: string;
  productId?: string;
  serviceUrl: string;
  layerId?: string;
  projection: string;
  coverage?: [west: number, south: number, east: number, north: number];
  units?: string;
  attribution: string;
  status: DataStatus;
  sampleData: boolean;
  limitations: string[];
};

type ScienceTarget = {
  id: string;
  name: string;
  coordinate: MarsCoordinate;
  summary: string;
  scientificRationale: string;
  sourceUrl: string;
  sourceLabel: string;
  provenance: "verified" | "interpretation" | "demo";
};

type RouteMetric = {
  label: string;
  value: number | string;
  unit?: string;
  source: string;
  isEstimated: boolean;
  explanation: string;
};

type RouteAlternative = {
  id: string;
  name: string;
  objective: "shortest" | "lower-terrain-cost" | "science-focused" | "balanced";
  coordinates: MarsCoordinate[];
  metrics: RouteMetric[];
  totalCost?: number;
  costBreakdown: Record<string, number>;
  assumptions: string[];
  warnings: string[];
  isDemonstration: boolean;
};
```

Document any coordinate convention conversions explicitly; Mars coordinate systems are not interchangeable by assumption.

# 12. Accessibility, Performance, and Resilience

- Full keyboard access for all inputs, buttons, tabs, and dialogs.
- Visible focus indicators, semantic headings, labels for controls, and screen-reader-friendly status messages.
- Do not rely only on color to communicate routes or statuses.
- Respect reduced-motion preferences.
- Lazy-load large map/3D components where useful.
- Cancel stale requests when users switch layers quickly.
- Debounce search inputs and avoid uncontrolled tile/data re-fetching.
- Avoid blocking the UI during pathfinding; use a worker for substantial searches.
- Show a meaningful empty state when no data exists for the selected area.
- Catch CORS/network/service errors and explain what is unavailable.

# 13. Demo Scenario and Storytelling

Create one polished scenario that can be presented in under two minutes:
1. Open the selected Mars region (Jezero Crater if validated).
2. Point out the base imagery and terrain layer, showing their sources.
3. Select a known science target from a sourced list.
4. Run the route alternatives.
5. Select “Lower terrain cost” or “Balanced” and show the actual factors used.
6. Toggle a second layer and show how context changes the interpretation.
7. Open “Why this route?” and show a plain-language explanation, assumptions, data coverage, and limitations.
8. Open the report view and show reproducible source links.

The story should focus on **better decisions through integrated evidence**, not on claiming that the prototype can guarantee astronaut survival.

# 14. Implementation Plan and Priorities

## Phase 1 — Verify and establish
- Inspect project structure and rules.
- Re-check current official challenge details and resources.
- Test the target data endpoints and document exact working layers/CRS/coverage/CORS.
- Choose a study region based on data availability, not appearance alone.
- Build the application shell and map viewport.

## Phase 2 — First functional map
- Integrate at least one authoritative base layer.
- Add a working layer manager with two or more genuinely distinct layers where available.
- Add region framing, pan/zoom, coordinate readout if supported, legend, and source panel.
- Add loading, missing-data, and service-error states.

## Phase 3 — Waypoints and route demo
- Add sourced waypoints.
- Add origin/destination selection.
- Implement a valid pathfinding method on real terrain data or label a sample grid as demonstration data.
- Add two or three route objectives only where supported by real factors.
- Add the route cost explanation and limitations.

## Phase 4 — Finish and polish
- Responsive design and accessibility pass.
- Mission report/print view if time permits.
- Source/metadata drawer.
- Unit tests, lint, typecheck, production build, and smoke test.
- Record exact setup instructions and known limitations.

**Priority order:** scientific data integrity and one working end-to-end journey > more layer types > advanced 3D effects > optional AI assistant.

# 15. Acceptance Criteria / Definition of Done

A release is acceptable only if the following have been checked:

- [ ] The project can be installed and started using documented commands.
- [ ] The initial page loads without a fatal error.
- [ ] A Mars region/map is visible and navigable.
- [ ] If the optional 3D globe is implemented, the official NASA glTF asset (or a clearly documented substitute) loads with working materials/textures, controls, responsive sizing, and a graceful error fallback.
- [ ] The 3D globe is clearly treated as a visual asset and is not incorrectly used as a numeric DEM.
- [ ] At least one authoritative data layer renders; source and attribution are visible.
- [ ] At least one additional genuinely distinct layer can be toggled, or the UI explicitly explains the current availability limitation.
- [ ] Map projections and coordinate conventions are documented and not silently treated as Earth defaults.
- [ ] Users can select or inspect known targets.
- [ ] Origin and destination can be chosen in the supported workflow.
- [ ] Route calculations use validated terrain/graph data, or every route is visibly labeled as a simulation.
- [ ] Route metrics have correct units and can be reproduced from the code/data.
- [ ] No-data areas are not interpreted as flat/safe terrain.
- [ ] Route alternatives have a clear breakdown of objectives and assumptions.
- [ ] The app distinguishes live/cached/sample/unavailable content.
- [ ] Service failures are handled without crashing the entire app.
- [ ] Main panels are responsive and keyboard-accessible.
- [ ] There are no placeholder controls that appear functional but do nothing.
- [ ] There are no invented statistics, unsupported scientific claims, or survival probabilities.
- [ ] README includes project overview, architecture, data sources, setup, usage, and limitations.
- [ ] Production build, lint/typecheck (where configured), and core tests run successfully.

# 16. Out of Scope for the Initial Hackathon MVP

Do not spend MVP time on:
- Certified astronaut safety decisions or operational mission certification.
- Predicting live weather or environmental conditions without a validated source and time context.
- Claiming real-time observations where only archived mission products are available.
- Complete planet-wide high-resolution DEM processing.
- User accounts, payments, social feeds, or unrelated landing-page sections.
- Unverifiable “AI risk predictions” or invented science scores.
- Elaborate 3D simulation that does not improve the route-planning task.

# 17. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| NASA layer endpoint or browser CORS access fails | Test early, read service capabilities, use a server-side proxy only when appropriate and permitted, and provide a transparent fallback. |
| Layer projections do not align | Read GetCapabilities, configure the actual CRS/tile matrix, test landmark alignment, and document any transformation. |
| Only rendered map imagery is available | Use imagery only for visualization; do not use it as numerical DEM data. Find a real elevation raster or mark a sample grid as simulation. |
| Dataset lacks target-area coverage | Choose another supported study area and show coverage bounds. |
| Route output looks scientifically authoritative when it is not | Explain cost weights, provenance, assumptions, and limitations directly next to the result. |
| External service changes or rate limits | Add timeout/retry, cache where allowed, isolate service adapters, and avoid excessive requests. |
| UI becomes crowded | Prioritize map + layer controls + route comparison; place advanced metadata in expandable panels. |
| Final build is incomplete | Prioritize the core journey and test installation/build commands before optional effects. |

# 18. README and Handoff Deliverables

The repository must include:
1. `README.md` with one-paragraph overview, setup, run/build/test commands, architecture, data providers, coordinate/projection notes, attribution, and known limitations.
2. `.env.example` only if environment variables are required; no real secrets.
3. A registry or documentation file listing actual layers used and their exact product/service IDs.
4. Testable sample scenario and any included sample data with provenance and license notes.
5. A concise list of implemented versus unimplemented features.
6. A final demo script of approximately 90–120 seconds.

# 19. Final Direction to the Agent

Build REDLINE as a polished, honest, map-first mission-planning prototype. Prioritize the scientific correctness of the layers and the clarity of route comparisons over visual gimmicks. The application should be impressive because it turns disparate planetary data into a useful, explainable workflow—not because it makes unsupported claims.

Before finishing, run the app, use the primary user journey, fix visible or console-breaking issues, and report the exact validation performed. If a feature could not be made real within the available environment, mark it explicitly as unavailable or illustrative rather than pretending it is complete.

# 20. Reference Links

- Official 2026 challenge: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/
- NASA Planet Mars 3D Model (glTF/USDZ): https://science.nasa.gov/resource/planet-mars-3d-model/
- NASA Mars Trek: https://trek.nasa.gov/mars/
- Mars Trek WMTS layer/API documentation: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- NASA planetary data discovery portal: https://planetary.data.nasa.gov/
- USGS Astrogeology CTX data guide: https://astrogeology.usgs.gov/docs/concepts/missions/mro/ctx-data/
- NASA Space Apps 2026 local-event/date information example: https://www.spaceappschallenge.org/2026/local-events/santiago-dominican-republic/

**Planning note (verified 23 October 2026):** the public event information states that full 2026 challenge statements and resources are scheduled to be released on 28 October 2026, with the event on 14–15 November 2026. Re-check the official page because event details and challenge resources may change.
