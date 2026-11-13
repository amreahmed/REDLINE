# REDLINE exploration interface redesign

Scope: presentation and UI state only. The current repository is the baseline, including 65,536 native terrain cells and existing hypothetical endpoints. Scientific validation and A* remain future milestones.

## Design

- Palette: deep space `#080d13`, navigation `#101923`, raised surface `#1a2935`, text `#edf3f6`, Mars `#ed956c`, interaction `#83d7df`. Amber qualifications remain readable on dark surfaces.
- Typography: locally available Bahnschrift for exploration titles/identity; Segoe UI for controls and reading, with system fallbacks. Body text 14px; source text at least 13px.
- Layout: compact header, narrow navigation rail, full-height canvas, one contextual drawer. Left-align controls and source content. Desktop drawers dock beside the canvas; tablet uses one overlay drawer; mobile uses a bounded bottom sheet while retaining a usable map area.
- The memorable element is the real NASA globe and imagery. Quiet navigation and one warm destination action frame it; no decorative telemetry or repeated card grids.
- Mission sections: Explore (destination and real workflow), Layers (switches/status/retry), Plan (native endpoints, retained approximate references, disabled route comparison).
- Sources: essential source/status/resolution/coverage summaries; progressive metadata, provenance and citations. Critical scientific qualifications remain immediate.

Review against brief: use a single active drawer rather than the current simultaneous panels; consolidate map navigation over the viewport and move lengthy guidance into a disclosure. Keep a persistent scientific-validation status and attribution visible. This preserves usable interactions rather than producing a static visual.

## Implementation gates

1. Refactor App shell and panel state; refactor MissionControl/planner and Sources presentation independently. Keep stateful components mounted when hidden.
2. Consolidate style tokens and responsive rules; preserve explorer effects/controller/transition code. Add focused panel-state tests.
3. Run lint, typecheck, all tests and production build. Review protected scientific/data/engine paths and pinned terrain hashes.
4. Use a hidden isolated in-app browser on loopback, with normal security settings: desktop/tablet/mobile, drawer/tab persistence, layers, numerical load/retry, native/reference endpoints, globe/map controls, reduced motion, keyboard, errors/retry. Save screenshots and an acceptance record.
5. Update README, review scoped diff/status, create a local UI milestone commit only after acceptance. Do not push. Stop before scientific calculations or routing.
