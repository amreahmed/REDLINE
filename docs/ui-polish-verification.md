# UI polish verification — 13 November 2026

The focused refinement passed fresh automated checks and agent-observed isolated-browser acceptance. The [previous UI redesign](ui-redesign-verification.md) was committed as `aa72bcb` with 319 tests. This milestone adds four terrain-status tests and retains the existing coverage.

## Scope and intended behavior

This is a frontend usability refinement. The Explore/Layers/Plan/Sources rail becomes the sole section navigation; redundant Mission Control tabs and repeated journey/region action buttons are removed. The selected drawer retains its real content and mounted mission/data state.

A single **Fly to Jezero** action in the viewport invokes the existing cinematic approach. The normal duplicate **Explore map context** action is removed, while the existing zoom handoff, model loading/error **Open map directly** fallback, **Reset view**, return, skip and cancel remain. **Navigation & limitations** groups the original navigation, marker and geographic qualifications; NASA attribution stays visible.

The footer separates Terrain data, Scientific validation and Route comparison. Terrain status reflects idle/loading/ready/error application state and reports the real loaded cell count when ready. Scientific validation remains pending; route comparison remains unavailable.

The NASA model, OpenLayers map, three real image layers, 65,536-cell terrain pipeline, native-grid and approximate-reference endpoints, all loading/error/retry handling and source metadata remain in scope for preservation. No coordinate transformation, DEM processing, elevation interpretation, scientific registration, terrain math, pathfinding or route comparison is introduced.

## Preservation evidence

Both runtime terrain assets still match the pinned controlled-grid hashes after the final implementation:

| Asset | SHA-256 |
| --- | --- |
| `public/data/jezero-terrain-grid.json` | `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9` |
| `public/data/jezero-terrain-grid.f32` | `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8` |

Static review and the final protected-path diff found no changes to `src/features/`, `src/data/`, `scripts/`, `public/data/`, dependencies or lockfile. Fly invokes App's existing `openJezero`, which calls `cancelPlanningNavigation()` before incrementing `jezeroRequest`; its unchanged effect invokes `exploreJezero()`. A five-second injected grid delay followed by Fly retained Jezero at 77.690° longitude, 18.410° latitude after all cells loaded, without opening the planning crop. Native-cell picking retains every `canPick` condition, including current rendered controlled imagery. Selections, source-window state, NoData rejection, O/D versus G-O/G-D identities and attribution remain intact. A separate agent reviewed the diff and pinned hashes without finding blocking issues.

Tablet drawers reserve at least 300 px of map width, so they cannot cover viewport controls. Mobile sheets use the actual remaining height; feedback and active picking receive additional map space. Picking layout follows raw user intent, independently of current-image readiness. Reopening Plan during a mobile pick held a stable 420 px viewport on two observations, then Use map center selected a native cell. Coordinate readout temporarily gives way to feedback/picking instructions and returns afterward; its values and calculations are unchanged.

## Automated verification

| Command | Final result |
| --- | --- |
| `npm run lint` | Exit 0, no warnings |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 323 tests in 27 files passed |
| `npm run build` | Exit 0; production assets built |
| `git diff --check` | Exit 0 |

These commands were run after the final source changes on 13 November 2026. The build retains the existing warning about chunks above 500 kB. No dependencies or bundling architecture were changed. Tests do not establish scientific feature registration, height-reference correctness, physical route math or live service availability.

## Browser acceptance

Used a temporary hidden isolated in-app browser against the local production preview at `127.0.0.1:4176`. Personal browser tabs and native applications were not used. NASA's real model and all three image layers rendered. No console warnings/errors were reported in the final normal-preview log check. Browser security was retained.

| Check | Observed result |
| --- | --- |
| Sole rail navigation, selection and collapse | Passed: contextual headings, no internal tabs, click/Escape/close collapse, focus restored to the rail |
| One Fly to Jezero CTA; cinematic/skip/cancel/return and zoom handoff | Passed: one button counted; keyboard activation, completed flight, map-origin flight, cancel, skip, return and globe-zoom map handoff observed |
| Model loading/error direct-map fallback | Passed: preparing/failed model disables Fly with an explanation; direct map remains usable; retry restored the model |
| Compact information, visible credit and three actual status fields | Passed: adjacent expandable qualifications, visible NASA credit, idle/loading/error/65,536 loaded-cell statuses separate from pending validation and unavailable routes |
| Desktop/tablet/mobile usability and overflow | Passed at 1600 × 1000, 768 × 1024, 320 × 800 and 390 × 844; one contextual panel, no horizontal overflow, shared drawer scrolling, feedback clear of navigation |
| Layers, sources, grid/reference controls and persistent state | Passed: all layer switches, native row/column assignment, swap/clear, source metadata expansion/loading, reference search/assignment/swap/clear/inspection; fields and loaded data persisted |
| Keyboard, focus, reduced motion and error/retry | Passed with the qualification below: visible focus, skip link, arrows/+−/Home/Enter, About/Escape, duplicate/outside-cell rejection, center picking and service retry |

The existing loopback-only harnesses at ports 4174 and 4177 injected labelled test failures/delays. These were test responses, not claims of NASA outages: model failure, numerical-window failure, terrain manifest failure, delayed terrain and controlled-image tile failure. Retrying restored each tested source. Loaded numerical terrain stayed distinct from failed imagery; grid picking was disabled until controlled tiles rendered again.

**Reduced-motion qualification:** the browser does not expose native OS preference emulation. A labelled local fixture simulated `prefers-reduced-motion` and disabled CSS motion; Fly arrived directly with no cinematic sequence. Native OS preference testing remains a manual check. No browser security restriction was bypassed.

### Visual evidence

- [Final polished overview with loaded-terrain status](evidence/ui-polish/browser/desktop-1600-polished.jpg)
- [Desktop overview with keyboard focus](evidence/ui-polish/browser/desktop-1600-overview.jpg)
- [Desktop Jezero workspace](evidence/ui-polish/browser/desktop-1600-jezero.jpg)
- [Tablet Sources drawer](evidence/ui-polish/browser/tablet-768-sources.jpg)
- [390 px planning and feedback](evidence/ui-polish/browser/mobile-390-planning.jpg)
- [390 px empty-layer state](evidence/ui-polish/browser/mobile-390-empty.jpg)
- [320 px limitations disclosure](evidence/ui-polish/browser/mobile-320-limitations.jpg)
- [Injected model failure](evidence/ui-polish/browser/fixture-globe-failure.jpg)
- [Injected terrain loading](evidence/ui-polish/browser/fixture-terrain-loading.jpg), [failure](evidence/ui-polish/browser/fixture-terrain-failure.jpg), [delayed-flight result](evidence/ui-polish/browser/fixture-delayed-flight-result.jpg)
- [Controlled-imagery picking gate](evidence/ui-polish/browser/fixture-controlled-imagery-gate.jpg)
- [Simulated reduced motion](evidence/ui-polish/browser/fixture-reduced-motion.jpg)

### Focused manual checklist

- [x] **Desktop:** spacious viewport with one collapsible drawer; single Fly action, visible attribution and separate statuses.
- [x] **Tablet:** one narrower drawer reserves map space; source details and map controls remain usable.
- [x] **Mobile:** compact rail below map, bottom sheet uses remaining space, no horizontal overflow; disclosure summary stays accessible. The opened disclosure intentionally overlays the map.
- [x] **Panels and sources:** switch/close/collapse sections; preserve typed fields, endpoints and numerical-window state; expand coordinates, source links and limitations.
- [x] **Layers:** toggle all three real sources; check empty feedback, controlled-tile failure and retry; failed/currently unrendered controlled imagery blocks selections.
- [x] **Mission controls:** assign, swap and clear both endpoint systems; search/inspect references; keyboard and map-center selection; duplicate/outside-crop rejection retains endpoints.
- [x] **Globe/map navigation:** Fly from overview/map, complete/skip/cancel, return, globe zoom handoff, pan, zoom and reset.
- [x] **Keyboard:** visible focus, logical rail-to-Fly order, skip link, arrows/+−/Home/Enter, drawer Escape and About dialog dismissal.
- [ ] **Native reduced-motion preference:** test with the operating system preference enabled; only the labelled simulated fixture was available here.

Reference-marker precedence and additional NoData/math cases remain covered by the existing passing automated suite; no additional manual pointer-precedence claim is made in this milestone.

Scientific feature registration, height-reference validation, physical distance/slope/terrain-cost validation and route algorithms remain separate upcoming work. This milestone does not establish safety, traversability, competition eligibility or NASA endorsement.

Checkpoint message: `feat(ui): refine REDLINE exploration experience`. The commit hash is reported in the handoff and Git history. No push, deployment, submission or A* work is included.
