# REDLINE — Modern Glass UI, Planning UX Redesign & Floating Map Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform REDLINE's interface into a modern, transparent glassmorphism UI with rounded corners and refined spacing, completely redesign the mission planning UX into an intuitive staged workflow, and add a Google Maps-inspired floating Layers menu under the manual map controls.

**Architecture:** 
- Centralized CSS glassmorphism token system in `src/styles/index.css` applied to panels, cards, and controls with `backdrop-filter: blur(16px)` while keeping WebGL and OpenLayers canvases 100% crisp.
- New `FloatingLayerMenu.tsx` component mounted in `MarsExplorer.tsx` beneath manual map controls with click-outside and Escape dismiss, bound directly to active layer visibility and basemap selection.
- Guided `MissionPlanningExperience.tsx` container component integrating `GridPlanner`, `RoutePlanner`, `TerrainRoutePlanner`, and `FeaturePlanner` into an intuitive 4-stage workflow (Endpoints -> Rover Profile -> Calculate & Compare -> Route Analysis).

**Tech Stack:** React 19, TypeScript, OpenLayers 10, Three.js, Tailwind CSS / Vanilla CSS Variables, Vitest.

**Spec:** User prompt in conversation `e4c41f2f-70be-49f0-bf6d-95af02256171` referencing `REDLINE_AI_Agent_Project_Spec.md` and `AGENTS.md`.

## Global Constraints
- Preserve all existing pathfinding algorithms and workers (`distanceRoutes.ts`, `terrainRoutes.ts`, `routeWorker.ts`, `terrainRouteWorker.ts`).
- Never fabricate scientific citations, coordinates, or safety claims; preserve all disclaimers and qualifiers.
- Do not apply blur or opacity to the map canvas or WebGL canvas itself.
- Retain all test-covered element IDs, attributes, and accessibility contracts for existing planners.
- Ensure full keyboard accessibility and visible focus indicators.

## Review Focus
1. Floating layer menu toggling must update actual OpenLayers and Three.js map layers without state divergence.
2. Glass panels must maintain readable contrast for muted text against bright or variegated map terrain.
3. Mobile layout (< 640px) must keep floating menu and side panels usable without obstructing viewport navigation.
4. Route calculation flow must cleanly transition from endpoint selection through calculation to comparison.
5. Escape key and outside clicks must close the floating menu without triggering map clicks.

---

### Task 1: Modern Glassmorphism Styling System & Primitives

**Files:**
- Modify: `src/styles/index.css`
- Test: `src/styles/index.css` (visual & lint check)

**Steps:**
- [ ] Add glass design tokens to `:root`:
  - `--glass-bg: rgba(12, 20, 30, 0.72);`
  - `--glass-panel: rgba(14, 22, 34, 0.76);`
  - `--glass-card: rgba(22, 35, 49, 0.55);`
  - `--glass-card-hover: rgba(30, 48, 68, 0.65);`
  - `--glass-border: rgba(255, 255, 255, 0.08);`
  - `--glass-border-subtle: rgba(255, 255, 255, 0.05);`
  - `--glass-border-highlight: rgba(131, 215, 223, 0.35);`
  - `--glass-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), 0 1px 1px rgba(255, 255, 255, 0.06) inset;`
  - `--glass-card-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);`
  - `--glass-blur: blur(16px);`
  - Corner radii: `--radius-panel: 20px;`, `--radius-card: 14px;`, `--radius-control: 10px;`.
- [ ] Apply glass styling to `.app-header` (glass backdrop blur, subtle bottom border).
- [ ] Update `.workspace-rail` and `.rail-button` with glass styling, rounded corners, and glowing active states.
- [ ] Inset `.mission-sidebar` and `.sources-panel` as floating glass panels (`margin: 12px; height: calc(100% - 24px); border-radius: var(--radius-panel); backdrop-filter: var(--glass-blur); box-shadow: var(--glass-shadow); border: 1px solid var(--glass-border);`).
- [ ] Update buttons (`.grid-button`, `.open-region-button`, `.quiet-button`, `.reference-button`) to use `border-radius: var(--radius-control);` with translucent glass styling and smooth hover/active transitions.
- [ ] Update inputs and selects with `border-radius: var(--radius-control);` and translucent backgrounds.
- [ ] Verify that `.explorer-surface`, `.ol-host`, `.globe-host`, and canvas elements have no blur or opacity.
- [ ] Run `npm run lint` and `npm run typecheck`.

---

### Task 2: Floating Google Maps-Inspired Layer Selection Menu

**Files:**
- Create: `src/components/explorer/FloatingLayerMenu.tsx`
- Create: `src/components/explorer/FloatingLayerMenu.test.tsx`
- Modify: `src/components/explorer/MarsExplorer.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/index.css`

**Steps:**
- [ ] Write unit test `src/components/explorer/FloatingLayerMenu.test.tsx` testing:
  - Renders the floating trigger button with layers icon and accessible label.
  - Opens menu on click; lists Planet Basemaps, Jezero Imagery, and Topography/Terrain.
  - Toggling layer invokes callback.
  - Escape key or outside click closes menu.
- [ ] Implement `FloatingLayerMenu.tsx`:
  - Categories:
    - **Global Basemaps** (radio group: Viking, Global CTX, MOLA).
    - **High-Resolution Jezero Imagery** (switches: Jezero CTX, Controlled CTX, HiRISE).
    - **Topography & Terrain Overlays** (HRSC DEM overlay & mode selector).
    - **Mission Context** (Feature markers, Route lines).
  - Clean card for each layer showing name, resolution, status, and active toggle.
  - Translucent glass styling with `backdrop-filter: blur(16px)`, rounded corners (18px), and soft shadow.
  - Focus trap / Escape key handling and click-outside dismissal.
- [ ] Mount `FloatingLayerMenu` in `MarsExplorer.tsx` inside `.explorer-navigation` directly below manual pan/zoom buttons.
- [ ] Connect props in `App.tsx` and `MarsExplorer.tsx` so toggles directly call `onToggle`, `selectGlobeLayer`, and `terrainRouting.setVisible`.
- [ ] Run `npm test` and verify unit tests pass.

---

### Task 3: Redesigned Planning User Experience

**Files:**
- Create: `src/components/mission/MissionPlanningExperience.tsx`
- Create: `src/components/mission/MissionPlanningExperience.test.tsx`
- Modify: `src/components/layout/MissionControl.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/index.css`

**Steps:**
- [ ] Write unit test `src/components/mission/MissionPlanningExperience.test.tsx` verifying:
  - Stage navigation (Endpoints, Rover Profile, Calculate & Compare, Route Analysis).
  - Preset endpoint selection sets origin/destination coordinates.
  - Preserves all accessibility labels and test contracts for `GridPlanner`, `RoutePlanner`, `TerrainRoutePlanner`, and `FeaturePlanner`.
  - Calculate button triggers calculation and displays results.
- [ ] Implement `MissionPlanningExperience.tsx`:
  - Stage 1: **Define Route (Endpoints & Waypoint)**:
    - Quick presets: "Belva Rim -> Floor", "Neretva Delta Traverse", "Custom Map Pick".
    - Origin & Destination summary cards with coordinates, elevation, and "Pick on Map" button.
    - Swap and Clear actions.
    - Collapsible Optional Waypoint with map pick.
    - Collapsible Feature References (Jezero, Belva, Neretva) for exploration and inspection.
  - Stage 2: **Rover Profile & Terrain Constraints**:
    - Rover selection: Standard Science Rover (15° grade) vs Rugged Explorer (25° grade) vs Custom.
    - 10 fine-grained sliders/inputs for uphill, downhill, roughness, unknown policy.
    - HRSC DEM dataset status (Load / Loaded indicator).
  - Stage 3: **Calculate & Compare**:
    - Unified CTA: "Calculate & Compare Routes" (or "Calculate Distance Route").
    - Background worker progress bar / calculating state.
  - Stage 4: **Route Analysis & Review**:
    - Comparison cards: Distance-Optimal vs Terrain-Optimal.
    - Distance, cost-m, max slope, roughness, and hazard cells bypassed.
    - Interactive selection: click card to highlight route on map.
    - Sol/hour travel time estimates.
    - Scientific model qualification banner.
- [ ] Mount `MissionPlanningExperience` into `MissionControl.tsx` for the `plan` section.
- [ ] Run `npm test`, `npm run lint`, and `npm run typecheck`.

---

### Task 4: Responsive Verification, Accessibility & End-to-End Testing

**Files:**
- Modify: `src/styles/index.css` (responsive adjustments, mobile drawer polish)
- Test: Live browser testing on desktop, tablet, and mobile with `browser` subagent

**Steps:**
- [ ] Verify desktop layout (> 1024px):
  - Glass sidebar floating smoothly beside the map.
  - Floating Layers button and popup menu cleanly positioned without obstructing controls.
  - Map and globe rendering remains 100% sharp and crisp.
- [ ] Verify tablet & mobile layout (< 640px):
  - Sidebar collapses and slides out cleanly.
  - Floating layer menu centers or hugs bottom/side gracefully.
  - Touch targets meet 44px minimum.
- [ ] Run full automated verification suite:
  - `npm run typecheck`
  - `npm test`
  - `npm run lint`
  - `npm run build`
- [ ] Live browser walkthrough with `browser` subagent:
  - Verify glass visual appearance.
  - Open floating layer menu, toggle layers, verify map updates.
  - Complete full Planning workflow: choose preset, view rover profile, calculate routes, inspect comparison metrics, and switch routes.
- [ ] Commit with Conventional Commits: `feat(ui): implement modern glass UI, redesigned planning UX, and floating layers menu`.
