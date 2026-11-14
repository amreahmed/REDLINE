# Scientific gate resolution implementation plan

> **For agentic workers:** Execute the evidence tasks with the current delegated agents and the support-comparison task in this session. The user's instruction to continue authorizes execution without another planning approval.

**Goal:** Resolve the public evidence available for the exact CTX height reference and feature registration, with reproducible checks and explicit remaining blockers.

**Architecture:** Keep source acquisition and validation outside the production application. Audit released PLACES localization/map records and exact-product processing records separately. Compare complete native HRSC support with the immutable CTX crop without converting, replacing or upsampling application terrain.

**Tech stack:** Existing Node.js tools, Python/Rasterio for independent source checks, existing React/TypeScript application checks. No application dependency changes.

**Spec:** `REDLINE_AI_Agent_Project_Spec.md`, sections 6–7; `AGENTS.md`; `docs/scientific-control-verification.md`.

## Global constraints

- Preserve all 65,536 original CTX cells, manifest bytes, mission controls and scientific blockers.
- Do not implement A*, routing, physical slope/cost authorization or an inferred CTX datum conversion.
- Do not fabricate landmark coordinates, uncertainty, acceptance tolerances or processing history.
- Use bounded source requests and exact receipt/body checksums. No external producer messages without explicit authorization.
- Review all changes, run fresh checks, create a local checkpoint, and do not push.

## Review focus

- Corner versus center pixel conventions: verify released CSV arithmetic against native labels, not just generic SIS wording.
- Different Mars radii: compare geographic footprints, not identical projected coordinates.
- Partial boundary support: reject reference footprints extending beyond the preserved crop.
- NoData/nonfinite support: reject affected comparisons without renormalizing away gaps.
- Shared source lineage: numerical agreement and relative image ties cannot establish independent absolute accuracy or final datum identity.

### Task 1: Public source and registration audit

**Files:** `docs/evidence/scientific-gate-resolution/{vertical,registration,hrsc}/` (owned by the three existing agents).

**Interfaces:** Receipt-backed public records and read-only verifiers; HRSC manifest `hrsc-native-reference.json`, paired little-endian int16 arrays and uint8 validity masks covering 103 × 103 native cells.

- [x] Complete exact-product catalogue/history/publication audit and verify saved response hashes.
- [x] Validate actual PLACES best_tactical frame/pixel arithmetic; attempt bounded native image ties with held-out diagnostics where sources support them.
- [x] Validate complete paired HRSC coverage, original sample encoding, horizontal frame and distinct vertical declarations with independent Rasterio/PROJ checks.
- [x] Prepare a specific unsent producer clarification draft if the exact final CTX equation remains absent.

### Task 2: Complete native-support diagnostic

**Files:** Create `scripts/native-support.mjs`, `scripts/test-native-support.mjs`, `scripts/compare-ctx-hrsc-support.mjs`; outputs under `docs/evidence/scientific-gate-resolution/comparison/`.

**Interfaces:** `aggregateNativeFootprint(grid, footprint)` returns either an area-weighted mean plus support counts or an explicit rejected reason. `grid` supplies native cell edges, spherical radius, samples and validity. `footprint` uses the same projected frame. The source-specific driver validates hashes and maps HRSC footprint edges into CTX projection by the documented sphere-radius ratio.

- [x] Write and run failing synthetic tests for constants, partial cells, spherical-area weighting, incomplete boundaries, NoData/nonfinite samples, and invalid inputs.
- [x] Implement a piecewise-constant area-weighted comparison model; no application terrain processing changes.
- [x] Run tests and generate comparisons only for completely supported, valid paired HRSC cells.
- [x] Verify saved output deterministically and inspect counts, ranges, published inter-product tilt and limitations without using them as accuracy or conversion evidence.

### Task 3: Review, documentation and checkpoint

**Files:** Create `docs/scientific-gate-resolution-verification.md`; update `README.md`, `.gitattributes`, and this plan. Production UI changes are unnecessary unless accepted findings require a correction.

- [x] Independently inspect delegated evidence and run all new saved-source verifiers.
- [x] Write a decision table distinguishing resolved source/frame/coverage questions from unresolved absolute landmark accuracy and exact CTX vertical definition.
- [x] Run lint, typecheck, automated tests, production build and a targeted isolated-browser smoke check if available; record actual outcomes.
- [x] Verify original terrain hashes, scoped diff and byte-identical staged evidence.
- [ ] Create the reviewed local checkpoint; its hash is reported by the executing agent after Git succeeds.

**Self-review:** Scope matches the requested scientific investigation. Missing producer records remain a named external dependency, not a reason to start routing. Each review-focus item has a source verifier or support-model test; no comparison result controls the production scientific gates.
