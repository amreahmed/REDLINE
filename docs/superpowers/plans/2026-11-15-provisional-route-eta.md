# Provisional Terrain ETA Implementation Plan

> **For agentic workers:** Execute the scoped tasks with the available collaboration tools; review the integrated model/UI/report before the local recovery checkpoint.

**Goal:** Estimate provisional travel duration, segment speeds, arrival and scenario bounds from existing actual HRSC grid paths and explicit hypothetical mobility assumptions.

**Architecture:** A pure ETA module consumes the existing terrain analysis and reconstructed route, validates every adjacent movement, and accumulates distance divided by modeled speed. UI configuration postprocesses both existing route alternatives without rerunning A* or altering terrain costs. Export retains the full ETA model and source/route provenance; unsupported CTX terrain ETA stays unavailable.

**Tech Stack:** Existing React, TypeScript, Vitest, OpenLayers and isolated Playwright Chromium; no added dependencies.

**Spec:** `C:/Users/LOQ/.codex/attachments/9f50a5db-4e23-4dc2-814a-8459b889adbb/Pasted text.txt`.

## Global Constraints

- Preserve native HRSC/CTX data, scientific gates, transformations, terrain algorithms, A* costs/search and exact path rendering.
- Mobility presets are hypothetical assumptions, never NASA rover specifications or measured performance.
- ETA is provisional; current source/physical-terrain qualifications remain attached. No speed inferred from the cost-equivalent-m score.
- Unknown support follows the existing uncertainty policy; no blocked or missing-height movement contributes to valid ETA.
- Arrival uses an explicitly supplied Earth UTC departure, not inferred Mars civil time or automatic current time.
- Scenario bounds use configurable speed sensitivity, not empirical confidence intervals. No unsupported weather, charging, maintenance or safety model.
- Planned holds are optional user-defined delays, default zero, kept separate from terrain movement.
- No remote push, personal-browser access or changes to historical evidence.

## Review Focus

- Repeated or missing route vertices must not silently turn the ETA into a direct-line calculation.
- Vehicle/departure changes must recalculate both existing paths without changing their geometry or triggering new A* work.
- Incomplete support must never silently use nominal speed or acquire fabricated terrain measurements.
- Invalid speed ordering, UTC date rollover and arithmetic overflow must fail closed.
- UI and export must retain provisional labels and rounded presentation while preserving reproducible numerical internals.

### Task 1: Pure mobility and segment-time model

**Files:** Create `src/features/routing/travelTime.ts`, `travelTime.test.ts`.

**Interfaces:** `MobilityProfile`; `MOBILITY_PROFILES`; `validateMobilityProfile`; `parseDepartureUtc`; `estimateRouteTravelTime(analysis, route, profile, options): TravelTimeResult`.

- [x] Test flat constant-speed geometry, directional grade/roughness/classification penalties, alternate hypothetical profiles, sums, scenario bounds, blocked/unknown/missing cells, zero-route duration, invalid inputs and departure changes.
- [x] Validate source/route identity and every adjacent edge through the existing movement adapter. Sum each segment's ground distance divided by modeled speed.
- [x] Use the documented nonnegative normalized terrain sensitivities, minimum/maximum bounds and explicit unknown-support speed. Preserve null unknown metrics.
- [x] Separately report nominal duration, terrain penalty, user hold, total duration, slowest segment, speed extrema and UTC arrival bounds.

### Task 2: Applied mission configuration and timeline

**Files:** Create `src/features/routing/useTravelTime.ts`; `src/components/mission/TravelTimePanel.tsx` and tests; scoped changes to `TerrainRoutePlanner.tsx` and styles. Add unavailable context to the existing CTX `RoutePlanner`.

- [x] Offer hypothetical survey, transit and custom profiles, editable speed/sensitivity/bounds, existing displayed grade limits, optional UTC departure and zero-default planned hold.
- [x] Recalculate both existing path ETAs after applied configuration or route changes; show pending/unavailable reasons without retaining stale arrivals.
- [x] Present rounded duration and scenario range prominently; average/min/max speed, terrain penalty, explicit hold and most time-consuming segment in expandable detail.
- [x] Provide an actual segment-duration timeline and pagination, preserving every segment rather than sampling it as if complete.
- [x] Keep controls keyboard/mobile usable and show provisional source/assumption qualifications near results.

### Task 3: Report and acceptance

**Files:** Scoped `terrainModelReport.ts`/tests; new `docs/travel-time-estimation.md`, `docs/evidence/travel-time/`; README and asset attributes.

- [x] Export mobility configuration, each exact segment and both route ETAs, uncertainty assumptions, source/route provenance and unresolved scientific limits.
- [x] Test report completeness, gate rejection, timing/rounding and route/departure recalculation; independently audit the model.
- [x] Run lint, typecheck, full tests and production build. In isolated Chromium test real HRSC routes, profiles, changed departure, timeline, export, unknown/blocked states, responsive/keyboard layout and unchanged route geometry.
- [x] Verify protected source/scientific/routing bytes, review and stage only this milestone, then create the local checkpoint. Do not push.

Design: keep the existing dark Mars interface and typography. A quiet travel-time section follows route metrics, with a readable duration/range, one applied mobility form and an expandable segment timeline. Warm route color and cyan focus remain restrained; no new permanent sidebar or animated telemetry.
