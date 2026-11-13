# UI/UX redesign milestone — 13 November 2026

The redesigned interface was verified with fresh automated checks and a temporary hidden isolated in-app browser. The previous controlled-grid milestone's 311-test and browser results remain historical evidence; the results below verify this redesign.

This milestone changes frontend presentation and navigation only. It does not implement A*, distance, slope, terrain costs, hazard detection or route comparison.

## Design and behavior

- Compact REDLINE header with exploration location, current mode and About access.
- Map/globe occupies the main viewport. Explore, Layers, Plan and Sources open one contextual drawer at a time. Desktop docks the active drawer, tablet overlays it, and mobile uses a bottom sheet with a navigation bar.
- Mission control groups the destination and journey, real layer controls, native-grid planning and separate approximate-reference planning. Reference assignment keeps Plan open; explicit inspection opens Sources.
- Sources show dataset, instrument, availability, nominal resolution and coverage before expandable metadata, coordinates, limits and citations. Required attribution and primary scientific warnings remain visible.
- Native-cell forms, reference search, terrain inspection and the renderers stay mounted across drawer/section changes. Selections, entered values and on-demand loaded data persist until page reload.
- Viewport navigation has labelled controls and tooltips. Navigation & map legend contains marker definitions, keyboard guidance and full handoff qualifications.
- Starting a map pick on mobile closes the sheet and focuses the full map. A visible cancel action and source-cell rejection message remain in the map view. Generic regional headings do not assert that a panned map center is still inside Jezero.
- The persistent status distinguishes terrain loading from scientific validation. Plan contains a disabled route-comparison entry with its outstanding prerequisites.
- Focus styles, semantic controls and reduced-motion handling are retained. Drawer dismissal avoids taking Escape from an active transition, grid-picking workflow or About dialog.

## Preserved scientific and functional baseline

The NASA GLB/Three.js globe, scripted globe-to-Jezero handoff, OpenLayers regional map, MOLA imagery, preliminary CTX, controlled Jezero CTX, coverage/error/retry behavior, source attribution and geographic qualifications remain in place. The entire native terrain pipeline and all **65,536 cells** are preserved.

Static diff review found no changes under `src/features/`, `src/data/`, `scripts/` or `public/data/`, or in `package.json` and `package-lock.json`. MarsExplorer changes are presentation JSX, labels, tooltips and disclosure; transition functions, controller effects and calculations are unchanged. The existing `canPick` conditions still require a ready grid, selected/available controlled imagery, local active map, supported coverage and **current rendered controlled-image readiness**. The delayed-load navigation token remains intact.

Asset hashes checked during the redesign:

| Asset | SHA-256 |
| --- | --- |
| `public/data/jezero-terrain-grid.json` | `fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9` |
| `public/data/jezero-terrain-grid.f32` | `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8` |

These match the [controlled-grid checkpoint](controlled-jezero-grid-verification.md). Hash preservation confirms unchanged runtime assets; it adds no new landmark or height-reference validation.

## Automated verification

Final verification after visual refinements passed **319 tests** (the original 311 plus eight drawer-state tests), lint, typecheck and production build.

| Final command | Result |
| --- | --- |
| `npm run lint` | Exit 0; no errors or warnings |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 319 tests across 26 files |
| `npm run build` | Exit 0; 251 modules; 39.32 kB CSS, 635.17 kB main JS, 637.33 kB lazy globe JS |
| `git diff --check` | Exit 0 |
| `node --check docs/evidence/ui-redesign/browser/qa-server.mjs` | Exit 0 |

The existing production warning about chunks above 500 kB remains. No dependency or lockfile changes were made. Production preview ran on loopback port 4176; failure harnesses used 4174 and 4177. No browser security settings or personal browser sessions were changed.

Drawer tests cover unobstructed initial state, opening each requested section, toggling the active entry, switching sections, mutual exclusion of mission/sources and retaining the remembered section after closing. Browser checks cover mounted form/data state and rendered interactions separately; no automated DOM browser suite is configured.

## Browser acceptance and visual evidence

Agent-observed checks used a background isolated in-app browser against the production build, with normal browser security. No personal Chrome tabs or native device applications were controlled. Final normal-preview console inspection returned no error entries. Temporary tabs were closed and the viewport override was reset after verification.

| Main journey | Observed result |
| --- | --- |
| Desktop layout and globe/map journey | 1600 × 1000 checked; NASA model loaded; rotate/reset, guided Jezero approach, skip, cancel, map context and return worked |
| Tablet single-drawer interaction | 768 × 1024 checked; exactly one drawer active; switching to Sources replaced Mission; document width remained 768 px |
| Mobile bottom sheet and horizontal overflow | 320 × 800 and 390 × 844 checked; no horizontal overflow or controls outside the viewport; closing sheet restores map; picking closes sheet and focuses map |
| Drawer/section state and form persistence | Native inputs, selections, reference search text, disclosure state and loaded numerical windows survived section/drawer changes |
| All three layer controls and sources | Independent MOLA/preliminary CTX/controlled CTX toggles worked; received, hidden, enlarged, partial-coverage and failure states observed; native metadata, coordinate-reference disclosure and DEM citation remained accessible |
| Native-grid form, map and keyboard endpoint selection | Origin 714/650 and destination 800/730 selected; duplicate, empty and row 585 rejected with previous endpoints retained; swap/clear and center actions worked; keyboard selected 714/715; mouse selected 740/581; outside map point rejected |
| Approximate reference inspection and endpoints | Search/inspect Belva worked; origin/destination reference selection retained Plan; swap worked; explicit inspection opened Sources with retained source windows; clicking Belva while picking inspected its reference and retained grid endpoints |
| Loading, errors and retries | Pinned grid loaded with 65,536 valid cells; manifest HTTP 503 exposed retry and recovered; controlled tile failure at a new zoom disabled picking despite earlier downloads and retry restored readiness; model HTTP 503 retained direct-map fallback and retry recovered; numerical-window HTTP 503 and retry recovery observed |
| Keyboard focus and About | Row-to-column Tab focus visibly outlined; skip link focused explorer; arrows/Enter and Home worked; drawer Escape restored Sources opener focus; About opened with close focus and Escape restored About opener |
| Reduced motion | Labelled local matchMedia preference fixture opened Jezero directly with no flight panel; existing reduced-motion unit tests and CSS branch retained. Native OS/browser preference switching was not tested because the isolated-browser API exposes no such setting |

Evidence: [overview](evidence/ui-redesign/browser/overview.jpg), [desktop mission](evidence/ui-redesign/browser/desktop.jpg), [tablet layers](evidence/ui-redesign/browser/tablet.jpg), [320 px sheet](evidence/ui-redesign/browser/mobile.jpg), [390 px map](evidence/ui-redesign/browser/mobile-map.jpg), [sources](evidence/ui-redesign/browser/sources.jpg), [terrain unavailable](evidence/ui-redesign/browser/terrain-unavailable.jpg), [controlled imagery unavailable](evidence/ui-redesign/browser/controlled-imagery-unavailable.jpg), [globe unavailable](evidence/ui-redesign/browser/globe-unavailable.jpg), [reduced-motion fixture](evidence/ui-redesign/browser/reduced-motion-fixture.jpg), and [observations](evidence/ui-redesign/browser/observations.json).

## Manual visual acceptance checklist

The observed rows above are the completed agent acceptance. This checklist is retained for repeat acceptance on another browser/device; additional touch gestures and native reduced-motion switching require that environment.

- [ ] **Desktop (1600 × 1000):** map/globe dominates the layout; opening a drawer leaves usable exploration space; closing it restores the viewport; attribution, scientific status and controls remain readable.
- [ ] **Tablet (768 × 1024):** only one drawer is active; mission and sources switch cleanly; map controls remain reachable when the drawer is closed; no horizontal document overflow.
- [ ] **Mobile (320 × 800 and a typical phone width):** map-first layout, bottom navigation and sheet remain usable; no horizontal overflow; one scrolling surface per drawer; map overlays do not obscure critical controls, attribution or failure notices.
- [ ] **Sidebar interactions:** Explore/Layers/Plan sections, rail toggles, close and Escape work; form values, selections, search text and loaded terrain persist after switching or closing; hidden sections receive no keyboard focus.
- [ ] **Layer controls:** MOLA, preliminary CTX and controlled CTX toggle independently; selections survive globe/map changes; local zoom and outside-coverage states are honest; controlled CTX draws above preliminary CTX; hidden/unavailable/currently unrendered controlled imagery disables grid picking.
- [ ] **Source details:** dataset/instrument/status/resolution/coverage are readable; advanced metadata expands; source URLs and attribution remain available; globe orientation, feature registration and vertical-reference limits remain clear; numerical inspection loads and survives drawer changes.
- [ ] **Globe and map:** drag/rotate/pan, zoom buttons, arrows and reset work; guided Jezero approach, skip, cancel, direct-map fallback and return to overview retain their behavior; map imagery and crop outline remain real integrations.
- [ ] **Mission endpoints:** choose origin 714/650 and destination 800/730; duplicate, empty and outside row 585 reject without changing prior selections; swap, clear, cancel, inside/outside map picking and Use map center work; reference-marker inspection takes precedence over a grid pick; O/D and G-O/G-D remain distinct.
- [ ] **Reference workflow:** search Jezero/Belva/Neretva, verify empty search, inspect a reference, assign distinct reference endpoints while Plan stays open, reject duplicates and preserve swap/clear behavior.
- [ ] **Keyboard/accessibility:** visible focus and logical tab order; skip link enters the explorer; arrows, +/−, Home and picking Enter work with map focus; controls have accessible names; About traps/restores focus and closes with Escape; reduced motion removes purposeful transitions.
- [ ] **Loading/failure/retry:** terrain-loading status, missing/failed imagery and source-unavailable states remain readable; terrain asset error offers retry; controlled imagery failure disables picking despite previously loaded tiles; restoring requests and retrying recovers without losing endpoints.
- [ ] **Science boundary:** 65,536 loaded terrain cells are separate from pending scientific validation; hypothetical endpoints remain labelled; route comparison is disabled with its prerequisites; no invented route metrics, elevation interpretation, hazard or safety results appear.

The existing labelled [grid/imagery failure harness](evidence/controlled-jezero-grid/browser/qa-server.mjs) and the new labelled [UI failure/preference harness](evidence/ui-redesign/browser/qa-server.mjs) test loopback production responses without modifying production services or weakening browser security. The motion fixture overrides matchMedia and disables fixture transitions; it is not a change to the user's native preference and is not a live OS-preference test.

## Limits and handoff

Scientific feature registration, independent elevation height-reference interpretation, physical distance/slope/terrain-cost validation and pathfinding remain pending. Shared controlled-image/DEM source geometry does not certify absolute landmark placement or registration of MDIM 2.1 named centers. The real terrain cells and all-valid crop do not establish traversability or astronaut safety. REDLINE remains an independent prototype.

Local UI checkpoint: `feat(ui): redesign Mars exploration workspace`. The commit hash is reported at handoff and available in Git history. No push, deployment, submission or route-algorithm work was performed.
