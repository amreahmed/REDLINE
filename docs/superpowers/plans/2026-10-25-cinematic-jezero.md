# Cinematic Jezero Approach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the explicitly requested globe approach and gradual transition to real Jezero imagery in the existing viewport.

**Architecture:** A cancellable requestAnimationFrame sequence coordinates the retained globe and OpenLayers controllers. The globe uses an explicitly approximate scripted pose; the map uses the sourced approximate crater center. The camera approach, imagery-readiness gate, map fade, and regional zoom are separate sequence stages with testable cancellation and timeout behavior.

**Tech Stack:** Existing React, TypeScript, Three.js, OpenLayers, Vite, Vitest and CSS; no new dependency.

**Spec:** User's attached “REDLINE — Implement the Cinematic Fly-to-Jezero Transition”; `REDLINE_AI_Agent_Project_Spec.md`; `docs/terrain-detail-audit.md`; `docs/globe-alignment.md`.

**Execution:** The user explicitly requests implementation now. Execute in this session with bounded controller delegation and an independent review; do not stop for another discovery or plan-approval cycle. Keep the pre-existing untracked audit reports/images intact. Visual acceptance remains a checkpoint gate.

## Global Constraints

- Preserve `Mars_MGS_MOLA_ClrShade_merge_global_463m` and `Jezero_CTX_BlockAdj_dd`, layer preferences, custom Mars angular grid, and level-12 ceiling.
- Use the published approximate crater center `[77.69, 18.41]` only as a navigation reference; no science-target or GLB georeferencing claim.
- No DEM processing, routing, colorization, fabricated tiles, new map engine or dependencies.
- No browser-policy bypass or inferred visual PASS. No push. Commit only after required acceptance.

## Design

Retain space `#0B0F14`, panel `#121922`, elevated `#18222D`, ink `#F2F5F7`, rust `#E06B45`, cyan `#58C7D8`; Segoe UI/system sans-serif; left-aligned labels. The imagery and one user-triggered movement carry the experience. Keep both renderers in place; fade the opaque map above the retained globe to avoid a dark gap. Use a compact progress/status strip with Skip and Cancel, not additional panels or decorative effects.

```text
Mission + layers | One globe / map viewport | Sources + status
                 | Approaching Jezero      |
                 | Same navigation strip   |
```

Design review: preserve the established mission-control shell; concentrate motion in the requested approach and reverse transition. Do not add unrelated visual treatments.

## Review Focus

- Duplicate destination actions or stale animation callbacks must not start another flight.
- Slow/failed tiles must retain a meaningful visual or readable fallback, with bounded waiting.
- CTX-only/both-hidden choices must persist without silently enabling MOLA.
- Reduced motion, Escape, unmount and mid-flight graphics failure must stop animation safely.
- Resizing and returning to the globe must not create another renderer or immediately trigger re-entry.

### Task 1: Controller support and cited framing

**Files:** `src/data/jezero.ts`, `src/features/map/jezeroView.ts` and tests, `src/features/map/createMarsMap.ts`; `src/features/globe/flightPose.ts` and tests, `src/features/globe/createMarsGlobe.ts`; `docs/globe-flight-orientation.md`.

**Interfaces:** Map adds `prepareJezeroApproach()`, `setApproachZoom(zoom)`, `setDetailOpacity(opacity)`, `hasRenderedImagery(id?)`. Globe adds `beginApproach()`, `setApproachProgress(progress)`, `endApproach()`. Export `JEZERO_DETAIL_ZOOM = 10` and sourced `JEZERO_NAVIGATION` metadata.

- [x] Verify the retained authoritative target/model evidence, adding an explicit orientation decision.
- [x] Add tests for target/conventions/coverage, matrices 10–12, opacity/zoom bounds, readiness and display-pose endpoints.
- [x] Implement the narrow controller APIs; preserve existing source/error/lifecycle paths.
- [x] Run the focused controller tests.

### Task 2: Coordinated approach, return and accessibility

**Files:** `src/features/explorer/animation.ts` and tests, `src/features/explorer/jezeroFlight.ts` and tests, `src/features/explorer/transition.ts` and tests; `src/components/explorer/MarsExplorer.tsx`; `src/components/layout/MissionControl.tsx`; `src/styles/index.css`.

**Interfaces:** `createAnimationPlayer(clock)` accepts typed stages with start/frame/readiness/timeout callbacks; exposes `start`, `cancel`, `dispose`. `createJezeroStages(...)` coordinates controller APIs. Explorer state adds a guarded explicit-flight phase and cancellation/settling events.

- [x] Add failing tests for duplicate starts, interruption, stale frames, cleanup, staged map reveal, timeout, CTX-only choices, and reverse behavior.
- [x] Implement one rAF owner with bounded readiness waits; animate globe approach, fade to context, zoom 4–10 and gradually reveal CTX at supported zoom.
- [x] Wire every explicit Jezero action to the same sequence, with full-globe preparation from a map view. Preserve existing gesture navigation.
- [x] Add reduced-motion direct arrival, Skip, Escape/Cancel, and map/globe failure fallbacks; retain readable source and integrity notices.
- [x] Run focused tests and review lifecycle/input isolation.

### Task 3: Verification and handoff

**Files:** `README.md`, `docs/cinematic-jezero-verification.md`.

- [x] Run lint, typecheck, full tests and production build; fix implementation failures.
- [x] Verify the dev app starts/serves the implementation; do not call that browser rendering.
- [x] Independently review the diff, source-preservation evidence and integration edge cases.
- [x] Provide a concise manual checklist for animation, center/zoom, MOLA/CTX, reverse/cancellation, failures and responsive/reduced-motion access.
- [ ] Review Git status/diff and create a milestone commit only when required visual acceptance passes; otherwise preserve the implementation uncommitted and identify the remaining gate.
