# REDLINE focused UI polish

Source brief: user attachment “REDLINE — UI/UX Polish: Final Usability Refinement”. Baseline: `aa72bcb`.

Keep the existing Segoe UI/Bahnschrift type hierarchy and palette: space `#080d13`, panel `#101923`, elevated `#1a2935`, text `#edf3f6`, Mars `#ed956c`, cyan `#83d7df`. The real planet/map remains the visual focus. Remove repeated navigation and permanent overview qualifications; keep the essential scientific limits in a nearby native disclosure and retain visible attribution.

```text
Compact identity + location                          Help
Rail | selected contextual panel | immersive explorer
     | Explore / Layers / Plan   | Fly + reset; navigation
     | or Sources               | Navigation & limitations
Terrain state       Scientific validation       Routes
```

Desktop uses one optional drawer; tablet reserves space for one narrower contextual drawer so it cannot cover viewport controls; mobile places the same content below a usable map viewport. Existing mounted planners and inspection state must survive navigation.

- [x] MissionControl: remove duplicate tabs and journey buttons, retain clear selected-section headings and all functional layers/planners.
- [x] App/MarsExplorer: single viewport Fly callback uses existing request mechanism and planning-navigation cancellation; retain transition stages, skip/cancel/return, direct fallback, zoom handoff and Home reset.
- [x] MissionStatusBar: separate actual terrain state from pending scientific validation and unavailable routes; verify idle/loading/error/ready presentation with four focused tests.
- [x] Styles: remove unused navigation styles, align static guidance, refine primary action and mobile spacing without changing renderers. Keep layout independent of transient image readiness.
- [x] Verification: lint, typecheck, 323 tests and build; isolated browser at desktop/tablet/mobile, keyboard, layers/sources, endpoint persistence, failure/retry and simulated reduced motion. Screenshots and checklist in `docs/ui-polish-verification.md`.
- [x] Review protected paths and pinned terrain hashes; update README and verification record. Scoped local checkpoint follows final review; no push.

Review focus: loading/error must not imply terrain success; Fly must cancel delayed planning navigation; globe unavailability must retain direct-map recovery; drawer switching must retain endpoint/inspection state; narrow layouts must keep controls, attribution and limits usable. No data, scientific service, calculation, coordinate, DEM, routing, dependency or lockfile changes are in scope.
