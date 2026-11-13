# Scientific Control Evidence Implementation Plan

> **For agentic workers:** Execute task-by-task with the available collaboration tools; independently review scientific evidence before changing capability status.

**Goal:** Reproduce independent registration and height controls, expose their qualified findings, and make the remaining scientific gates actionable without enabling unsupported terrain results.

**Architecture:** Keep audit data and reproducible tools under `docs/evidence/scientific-resolution-2026-11-14/`. A small typed evidence registry and reusable scientific-status component summarize the accepted findings. Scientific authorization stays in the existing fail-closed registry; source assets and math/engine implementations remain untouched.

**Tech Stack:** React, TypeScript, existing Vite/Vitest; build-time Node, Rasterio and SpiceyPy only. No new application dependencies.

**Spec:** `REDLINE_AI_Agent_Project_Spec.md`, sections 6, 7, 12 and 15; current contract in `docs/scientific-metrics-verification.md`.

## Global Constraints

- Preserve all 65,536 cells, both pinned asset hashes, native transforms, map/globe engines and existing mission controls.
- Never transfer a different product's datum or registration claims to the current CTX TIFF.
- Distinguish coordinate-to-cell mappings and diagnostic height differences from empirical registration and DEM accuracy.
- Do not implement A*, Dijkstra, routes, source-height corrections or new terrain algorithms.
- Do not push; create a scoped local checkpoint only after fresh verification and review.

## Review Focus

- Gaussian kernel latitude must not be mistaken for planetocentric latitude.
- Rover kernel coverage must not be presented as a fixed site's observation time or uncertainty.
- Different HRSC sphere, cell spacing and provenance must remain explicit; comparison arithmetic must not alter CTX values.
- Candidate-source discovery must never change physical grade/cost authorization or reference endpoint behavior.
- Collapsed evidence must leave essential unresolved scientific status visible on narrow screens and by keyboard.

### Task 1: Independently reproduce source controls

**Files:** `docs/evidence/scientific-resolution-2026-11-14/{registration,height}/`, `method-review.md`, `verify-method-evidence.mjs`.

- [x] Verify saved source receipts and metadata; decode archived SPICE vectors and cross-check current native-cell mappings.
- [x] Reproduce paired HRSC TIFF metadata and numerical probes from bounded saved HTTP ranges; verify masks, units, CRS and hashes.
- [x] Review conclusions independently, preserve unavailable/unsuitable responses as such, and document exact missing evidence.

### Task 2: Expose qualified evidence and next requirements

**Files:** create `src/data/scientificEvidence.ts`, `src/data/scientificEvidence.test.ts`, `src/components/mission/ScientificValidation.tsx`, `src/components/mission/ScientificValidation.test.tsx`; modify `src/data/terrainScience.ts`, `src/components/layout/InformationPanel.tsx`, `src/styles/index.css`.

**Interfaces:** `SCIENTIFIC_CONTROL_EVIDENCE` is a read-only summary of accepted offline audits; `ScientificValidation()` renders the current findings, expandable evidence and remaining requirements. Neither authorizes measurements.

- [x] Write and run failing tests that bind counts/contracts to the audit, preserve unresolved scientific gates, require visible limitations, and verify functional disclosure/source links without route or endpoint controls.
- [x] Implement the typed summary and disclosure component; replace only the existing scientific-summary block.
- [x] Run focused tests and confirm all original terrain and mission behavior remains preserved.

### Task 3: Verify and checkpoint

**Files:** `README.md`, `docs/scientific-control-verification.md`, this plan.

- [x] Run lint, typecheck, all tests, production build, saved-evidence validators and source-asset preservation checks.
- [x] Smoke-test production in a hidden isolated browser: desktop/mobile disclosure and keyboard controls, terrain loading/endpoints/separation, source qualifications and disabled routes. Record only observed results.
- [x] Update documentation and review scoped diff/status. Record the local checkpoint in Git history and report scientific gates still unresolved.

## Execution decision

The user's instruction to start the next phase authorizes implementation in this session. Use the existing audit agents for independent evidence work and review; the parent implements the focused presentation change. No additional execution-choice approval is required.
