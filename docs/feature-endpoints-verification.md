# Jezero feature references and endpoint verification

Verified on 13 November 2026 against explorer checkpoint `8116beb` (`feat(explorer): verify cinematic Jezero navigation and imagery readiness`) on `main`. This milestone implements the feature/endpoint portion of Phase 3. The [implementation plan](superpowers/plans/2026-11-13-feature-endpoints.md) records the scope; numerical terrain and routing remain subsequent work.

## Implemented and tested

- A local index of Jezero crater, Belva crater and Neretva Vallis supports name search, an explicit no-match state and inspection from native buttons or selectable map markers.
- Inspection directly enters the regional map, cancels an active scripted approach, centers the selected approximate reference and opens Sources & status. Repeated inspection returns the source content to the selected feature's details.
- Native selectors assign distinct hypothetical origin/destination references. Duplicate assignments preserve the existing selection and explain the error. Swap, individual clearing and Clear endpoints are supported. Swap/Clear are disabled when both endpoints are empty.
- OpenLayers renders longitude-first point geometry on the existing custom Mars display grid. An O circle, D square and reference diamond distinguish roles independently of color; labels say approximate. There is no connecting route geometry.
- References remain independent of imagery visibility. The empty/unavailable imagery notice is above the centered marker, rather than obscuring it. The retained controller initializes reference state and active visibility when recreated and disposes the vector source, layer and hit handler on teardown.
- Endpoint choices persist through inspection, overview/map transitions and layer retry. They are in-memory state and reset on reload.
- Calculate routes remains disabled with its terrain/registration explanation. No objective controls, route alternatives, distance, slope, hazard or safety scores are presented as functioning.

## Data-backed and verified

| Reference | Published center (east longitude, north latitude) | Coordinate citation |
| --- | --- | --- |
| Jezero crater | 77.69°, 18.41° | USGS/IAU Gazetteer feature 14300 |
| Belva crater | 77.38°, 18.48° | USGS/IAU Gazetteer feature 15872 |
| Neretva Vallis | 77.20°, 18.55° | USGS/IAU Gazetteer feature 15879 |

The records explicitly use planetocentric latitude, positive-east longitude, the 0–360° source domain and the selected MDIM 2.1 control network. Source display precision is two decimal places. They are feature centers, not landing sites, rover samples, panorama locations or precise traversable endpoints. Separate NASA science descriptions support the paraphrased rationale for each feature. Coordinate and science links, attributions and individual limits appear beside the details.

`node docs/evidence/phase-3-targets/verify-evidence.mjs` exited 0 and reported PASS for **15 response receipts and three selected reference records**. It checks saved response hashes, selected-network coordinate rows, conventions, science-context phrases and Gazetteer public-domain attribution. This is source-evidence validation, not image-registration validation. The [source evidence README](evidence/phase-3-targets/README.md) distinguishes successful source requests from exploratory 403/404 responses and explains why the rover feed is not used for precise positions.

A separate pre-commit check read all 15 raw responses from the Git index with `git show :<path>` and confirmed their byte counts and SHA-256 hashes against the receipts. This verifies that the checkpoint preserves the original responses after applying the raw-evidence attributes.

## Isolated browser verification

The agent used the isolated ChatGPT in-app browser, without testing in personal Chrome or native apps. Development checks used the separate loopback QA Vite server at `127.0.0.1:5174`; the built app was tested at `127.0.0.1:4173`. The existing [QA harness](evidence/cinematic-jezero/browser-qa-server.mjs) adds a visible in-memory disclosure and can inject network failure. It does not modify the application files or replace NASA data. Normal mode uses real NASA requests; the production preview contains no injection.

| Browser check | Observed result |
| --- | --- |
| Search/inspection | All three references inspected; unmatched text displayed a useful no-match state. Neretva and Belva details showed the correct coordinates, separate citations and registration limits. |
| Keyboard | Home/ArrowDown/Enter selected Jezero as origin and retained focus on the native selector. Enter activated Swap, Clear and Inspect. |
| Endpoint invariants | Duplicate destination assignment retained the previous endpoint and showed the different-references message. Swap exchanged the roles; Clear emptied both selectors and disabled Swap/Clear. |
| Hidden layers | Both-hidden displayed the no-imagery explanation while keeping qualified feature markers. Moving the notice above the map center made the inspected marker visible. |
| Failure/recovery | The existing injected network failure left references/details usable. Restoring normal mode and Retry recovered real MOLA/CTX tiles. This is a controlled failure simulation, not a genuine NASA outage or CORS-policy test. |
| Responsive layout | At viewport widths 1280, 768 and 320 px, document client/scroll widths matched: 1265/1265, 753/753 and 305/305 px. Search/select/button text remained readable in sampled screenshots; no horizontal page overflow was observed. |
| Production workflow | Selecting Jezero origin and Belva destination directly opened the map and reopened a closed source panel. Return/replay retained endpoints; inspecting Neretva during an approach removed the transition and settled at `77.200,18.550`, globe opacity 0 and map opacity 1. |
| Production map hit | Clicking the centered Neretva marker reopened the collapsed source panel after OpenLayers emitted its singleclick event. This confirms the actual canvas hit workflow, separately from the planner buttons. |
| Production imagery/console | Real grayscale CTX and O/D/reference markers rendered. The final captured warning/error console entries were empty. No fatal console error was captured in the normal production journey. |

The [production workspace screenshot](evidence/phase-3-targets/production-workspace.png) shows all three markers, actual imagery, endpoint selection and the selected feature's provenance. These are functional smoke checks with sampled DOM/accessibility/screenshot observations, not a comprehensive accessibility audit, performance benchmark or planetary-registration test. Temporary viewport overrides were reset afterward.

## Configured checks and changes

| Command | Actual result |
| --- | --- |
| `npm run lint` | Exit 0, no ESLint errors or warnings. |
| `npm run typecheck` | Exit 0. |
| `npm test` | Exit 0; **175 tests passed across 18 files**, zero failures. |
| `npm run build` | Exit 0; **240 modules**. CSS 35.80 kB, main JS 592.96 kB, lazy globe JS 637.33 kB. Vite warns that chunks exceed 500 kB; this warning remains. |
| `node docs/evidence/phase-3-targets/verify-evidence.mjs` | Exit 0; PASS, 15 receipts and three records. |
| `git diff --check` | Exit 0. |

Changed application areas: App and layout wiring; FeaturePlanner/FeatureDetails; the science reference index; typed coordinate/selection modules and tests; OpenLayers markers/tests/controller; the retained explorer lifecycle and marker legend; and stylesheet additions. README, this record, the plan and source evidence document the handoff. `.gitattributes` extends the existing raw-evidence rule to preserve response bytes and hashes through Windows checkouts, including source whitespace. No dependency, lockfile, imagery source, projection or existing scientific audit was replaced.

An independent read-only Phase 3 review found no remaining actionable issue. Browser testing identified the centered-notice occlusion and verified its visual correction; no implementation-mirroring test was added for that CSS adjustment.

## Incomplete and next milestone

MDIM 2.1 centers are not independently registered to the preliminary CTX mosaic. Its native latitude convention and fine cross-layer alignment remain unresolved. Neither the MOLA/CTX RGB tiles nor the NASA visual globe is a numerical DEM. No synthetic terrain or substitute map data was introduced; the endpoints are explicitly hypothetical.

Next, discover and validate a bounded numerical terrain product: provider/product identity, regional coverage, projection/datum, physical units, resolution, NoData encoding, access/terms and registration to the imagery/reference system. Verify real elevation samples and missing coverage before implementing slope/terrain costs, then add documented route objectives and comparison. Controlled CTX/HiRISE integration and mission-report export also remain incomplete.

This local milestone is a recovery checkpoint, not a remote publication or final challenge submission. Official challenge rules must be rechecked before submission-related work.
