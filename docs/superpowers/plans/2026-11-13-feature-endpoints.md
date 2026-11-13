# Jezero feature references and hypothetical endpoints implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Inspect three sourced Jezero-area features and assign distinct hypothetical origin/destination references in the existing workspace.

**Architecture:** Retain the globe, regional map, imagery adapters and transition lifecycle. A typed local reference index carries published coordinates and independent science citations. App-level mission state drives accessible controls, source details and selectable OpenLayers point markers; no route or terrain calculation depends on these approximate centers.

**Tech Stack:** Existing React, TypeScript, OpenLayers, Tailwind/Vite and Vitest; no new dependencies.

**Spec:** `REDLINE_AI_Agent_Project_Spec.md`, sections 4.1 B/C, 5.3, 5.5, 6, 11, 12 and 15. This is the target/endpoint portion of Phase 3; terrain-backed routing is a subsequent milestone.

## Global constraints

- Preserve all existing working code, imagery sources and user changes. Do not push.
- Never fabricate coordinates, observations, metrics or citations.
- Published source centers: Jezero `[77.69,18.41]`, Belva `[77.38,18.48]`, Neretva `[77.20,18.55]`, longitude first. Sources explicitly state planetocentric, east-positive, MDIM 2.1.
- Normalize valid 0–360 longitudes into −180–180; reject non-finite, invalid ranges and unsupported latitude conventions. No Earth transform or metre conversion.
- These are approximate source-backed feature references, not precise landing, sample or rover sites. The MDIM 2.1 to preliminary CTX registration remains unverified. Keep the qualification near the controls, markers and details.
- Keep route calculation disabled with a visible explanation: no validated numerical DEM or coordinate registration. No synthetic terrain is introduced.
- Verify and checkpoint the existing cinematic milestone before editing the next phase's app code. The user explicitly requested autonomous checking and continuation; use native implementation with independent review rather than stopping for a plan approval.

## File responsibilities

- `src/features/mission/types.ts`: reference and selection types.
- `src/data/scienceTargets.ts`: three verified local records, citations, precision and limitations.
- `src/features/mission/coordinates.ts`, `selection.ts` and their tests: display-coordinate validation and endpoint invariants.
- `src/components/mission/FeaturePlanner.tsx`, `FeatureDetails.tsx`: local search, inspect/focus, endpoint controls and provenance.
- `src/features/map/featureMarkers.ts` and tests: OpenLayers feature/style factory and selection hit IDs.
- `src/features/map/createMarsMap.ts`: retained vector layer, focus and hit callback lifecycle.
- `src/components/explorer/MarsExplorer.tsx`: direct map focusing plus marker updates; no globe geographic picking.
- `src/app/App.tsx`, layout components: shared selection state and existing panel integration.
- `src/styles/index.css`: restrained existing design styles, responsive controls and marker legend.
- `docs/feature-endpoints-verification.md`, README: exact implemented behavior, evidence, test results and limits.

## Review focus

- Unknown reference IDs: reject assignments; do not silently pick another feature.
- Same origin and destination: retain the prior selection and show a useful message.
- Hidden/unavailable imagery: reference coordinates remain qualified; do not claim terrain or image coverage.
- Focusing from globe/during transition: end the transition safely, enter the map directly, then focus the selected reference.
- Empty search and keyboard use: show an explicit no-match state; native select/button controls remain accessible and no content overflows at 320px.

### Task 1: Verify and checkpoint the explorer

- [x] Verify animation, final imagery, coverage/toggles, reverse/replay, Skip/Cancel, failure/recovery and reduced motion in the isolated browser.
- [x] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; inspect results and browser console.
- [x] Record the 320px overflow and visible-alpha crop regression fixes with their observed checks.
- [x] Review diff/status; stage only cinematic files/evidence and its source audit dependencies; create the verified checkpoint. Keep newly discovered target evidence for Phase 3.

### Task 2: Typed references and selection

**Interfaces:** `ScienceTarget`, `TargetId`, `MissionSelection`; `toDisplayCoordinate(coordinate): [number, number] | null`; `assignEndpoint(selection, role, id, targets): { selection, error }`; `swapEndpoints(selection)`.

- [x] Tests pin source-reference coordinates, wrapping of 359° to −1°, rejection of invalid latitude/longitude/non-finite values and unsupported conventions.
- [x] Tests pin unknown IDs, duplicate endpoints, clearing and swapping partial/complete selections.
- [x] Implement the focused modules and records from `docs/evidence/phase-3-targets/target-records.json` with two-decimal coordinate display and individual source links.
- [x] Run focused Vitest suites and verify source receipts with `node docs/evidence/phase-3-targets/verify-evidence.mjs`.

### Task 3: Working inspection and endpoint workflow

**Interfaces:** planner consumes targets, selection, selected ID and callbacks `onInspect(id)`, `onAssign(role,id|null)`, `onSwap()`, `onClear()`; map consumes reference list/selection and `onInspect(id)` and exposes `focusReference(id)`, `setMissionFeatures(...)`.

- [x] Create the OpenLayers point features using validated display coordinates. Origin is labeled O, destination D, other references diamond; no connecting route line. Test geometry, roles and rejected coordinates with actual OpenLayers classes.
- [x] Add selectable markers and retain/dispose the vector layer and hit handler with the existing controller. Preserve layer visibility/opacity, tile readiness and map keyboard behavior.
- [x] Replace the planning empty section with local search and inspect controls, native origin/destination selectors, swap/clear, a textual legend and disabled route action with its data reason.
- [x] Show selected reference science rationale, coordinate/science citations, source precision, control network and individual limitations in the existing information panel.
- [x] Direct focus from the globe cancels animation, activates the real map and centers the requested reference. Endpoint assignments persist through return/replay and layer retries. Selecting an endpoint exposes its details; inspect also opens the information panel.
- [x] Browser-test every visible control, point selection, empty search, duplicate/clear/swap, transition interruption, hidden layers, responsive widths and keyboard focus.

### Task 4: Review, handoff and checkpoint

- [x] Independent review checks coordinate/precision claims, source content, marker and state lifecycle, error/empty states and feature scope; resolve actionable findings.
- [x] Update README and verification record, including a brief reproducible target-selection demo and no terrain/routing claims.
- [x] Run configured lint/typecheck/tests/build, production-preview browser smoke and console inspection. Record actual results and the existing globe chunk-size warning.
- [x] Review diff/status, stage only Phase 3 files/evidence, commit `feat(mission): add sourced feature inspection and endpoints` and report hash, changes, checks and remaining terrain/registration work.

## Self-review

The plan covers this approved milestone's sourced target inspection, distinct endpoint selection, functional controls, provenance, resilience and accessibility. Source convention and feature centers are verified; fine image registration and numerical DEM work are explicitly excluded from quantitative use. Routes, export and extra imagery are not silently treated as implemented. Interfaces consistently use target IDs and shared selection state; test cases cover the five listed failure classes. Existing user-authorized execution continues in this chat.
