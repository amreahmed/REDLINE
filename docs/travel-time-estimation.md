# Provisional terrain-dependent travel time

This milestone estimates travel duration from every consecutive cell of the existing HRSC route. It does not implement another search, optimize for shortest time, change route geometry, or use cost-equivalent metres as time. All vehicle parameters are hypothetical assumptions. Scientific validation remains **Partial**; ETA is **provisional**, not measured rover performance, a NASA mission prediction, human travel guidance or a safety assessment.

## Use the implemented workflow

1. Open **Plan**, then **Open planning terrain**. Select hypothetical native-grid origin and destination cells. A reproducible supported example is CTX row/column **(662, 598) → (762, 698)**.
2. Choose **Load HRSC DEM**, then **Compare DEM routes**. Both the shortest permitted distance and lower terrain cost paths use the existing qualified numerical terrain graph. The selected path's **Travel time** section displays its provisional ETA automatically.
3. Select a hypothetical survey/transit vehicle or edit a custom profile. Supply an optional departure in **Earth UTC** and an explicit stationary hold, default zero. Choose **Apply travel assumptions** to update both existing route estimates. Draft changes are visibly distinct from applied results; invalid drafts cannot be applied.
4. Inspect **Timing, speed & route limits**, **Route segment timeline** and **ETA model & scientific limitations**. All actual route movements are accessible in pages of ten segments. The timeline resets to the first page when its route estimate changes.
5. **Export DEM model report** includes both exact paths, every segment, applied assumptions, full source/provenance, time reference, scenario model and scientific limitations. Route/data changes clear old durations and arrivals until a current route is available.

CTX remains a separate distance-only workflow. Its terrain height interpretation is unresolved, so it has **no terrain-dependent ETA**, constant-speed fallback or borrowed HRSC duration. HRSC endpoints are snapped from the selected CTX endpoint coordinates to containing HRSC cells using the existing disclosed adapter; this does not validate feature registration.

## Source and units

The unchanged cached **HMC_13E10_DT5** Mars Express HRSC numerical DEM has **103 × 103 / 10,609 native cells**, 50 m projected posts, positive-up heights above the documented **3,396,000 m sphere**, and a separate validity mask. Source credit is **ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO**. Nominal post spacing is not a claim of effective resolution or measurement accuracy. The original **65,536 CTX cells** are unchanged.

ETA retrieves horizontal ground distance, directional grade, endpoint gradient, roughness and movement restrictions from the existing `terrainMovement` adapter. Distance uses the source sphere, not degrees, map pixels or an Earth radius. Roughness is the existing neighborhood height standard deviation and includes broad terrain grade; it is not rock-scale roughness. See [source authorization](evidence/terrain-model/source-authorization.md) and [terrain model](terrain-model-routing.md).

## Mathematical model

For a supported segment, define:

```text
p = uphillSensitivity × max(0, gradeDeg) / maxUphillDeg
  + downhillSensitivity × max(0, -gradeDeg) / maxDownhillDeg
  + gradientSensitivity × maxEndpointGradient / max(maxUphillDeg, maxDownhillDeg)
  + roughnessSensitivity × maxEndpointRoughness / maxRoughnessM
  + highCostPenalty × isHighCost

speed = clamp(nominalSpeed / (1 + p), minimumSpeed, maximumSpeed)
segmentTime = segmentHorizontalDistance / speed
movementTime = sum(all actual segment times)
totalDuration = movementTime + explicitUserHold
arrival = suppliedEarthUtcDeparture + totalDuration
```

Speeds are m/s; durations are SI seconds internally; grade/gradient are degrees; roughness is metres. Downhill movement has its own nonnegative slowdown; it never grants a speed bonus. The permitted grade, roughness and unknown-support limits remain those of the existing applied terrain profile. ETA configuration neither changes those limits nor starts A*. These limits are visible beside the mobility configuration and retained in exports.

The nominal baseline is route distance divided by nominal speed. The modeled terrain penalty is the sum of segment time above that baseline. The optional hold is separate, applied once after movement; average speed is distance divided by **movement time**, excluding the hold. Minimum/maximum speeds and the most time-consuming segment use the exact segment list. The API supports a stationary one-cell route with no segments, zero movement time and null speed statistics; the existing interactive route planner continues to require distinct endpoints.

## Hypothetical mobility assumptions

| Profile | Nominal | Minimum | Maximum | Unknown support |
| --- | ---: | ---: | ---: | ---: |
| Survey vehicle | 0.10 m/s | 0.02 m/s | 0.20 m/s | 0.03 m/s |
| Transit vehicle | 0.30 m/s | 0.05 m/s | 0.50 m/s | 0.08 m/s |

Both presets use uphill/downhill/gradient/roughness sensitivities **3 / 1 / 1 / 2**, a high-cost slowdown **0.5**, and speed scenario sensitivity **30%**. All ten numeric speed/model parameters can be edited; doing so creates a clearly named hypothetical custom vehicle. These are design assumptions, not specifications for Perseverance, Curiosity or any NASA vehicle.

Speeds must be finite and positive, with `minimum ≤ nominal ≤ maximum` and `minimum ≤ unknown ≤ nominal`. Slowdown factors must be finite and nonnegative. Scenario sensitivity must be at least zero and below 100%. Optional UTC input requires an actual calendar date and minute; malformed/rolled-over dates are rejected. The UI accepts an explicit hold from zero to 10,080 minutes (7 Earth days). Non-finite arithmetic, invalid provenance, inconsistent route metrics, mismatched source/terrain profile or nonadjacent cells yield an unavailable result.

## Unknown support, delays and uncertainty

Missing heights and blocked movements never contribute to a valid ETA. Incomplete derivative/neighborhood support is blocked by the existing default policy. Only its explicitly selected **penalize** policy permits such movements. Those segments use the configured hypothetical unknown-support speed and retain **null grade, gradient and roughness**; the result identifies their count and incomplete support.

With selected speed sensitivity `f`, each segment's faster scenario is `min(maximumSpeed, speed × (1 + f))`; its slower scenario is `max(minimumSpeed, speed × (1 - f))`. Duration bounds sum distance divided by each scenario speed and add the same explicit hold. These are **user-selected speed sensitivity scenarios**, not statistical confidence intervals, validated physical limits, source error bars or a guarantee that actual travel falls within them.

Duration and arrival displays round to minutes; sub-minute values display `<1 min`. Numerical report internals retain reproducible calculations, not a claim of measured timing precision. Arrival uses explicitly entered **Earth UTC**, regardless of the browser timezone. No Mars civil calendar, automatic current departure or live mission clock is inferred.

No automatic weather, dust, visibility, thermal, charging, rest or maintenance delays are applied. The report separately records that no environmental delay model is available; zero applied delay is not evidence that environmental effects are absent. Step heights, rocks, sand, traction and actual traversability are not modeled without validated inputs. Physical slope accuracy, precise feature registration and safety remain unresolved. The routes minimize distance or hypothetical terrain cost, **not ETA**.

## Implementation and verification

New modules are `travelTime.ts` (pure model/gates), `useTravelTime.ts` (applied state), `travelTimeDisplay.ts` (rounded display), `travelTimeReport.ts` (full report) and `TravelTimePanel.tsx` (configuration/results/timeline), with model, display, report and component tests. Integration changes are limited to `TerrainRoutePlanner`, the CTX explanation in `RoutePlanner`, the optional `terrainModelReport` extension and scoped styles. No dependency was added.

Fresh verification on 15 November 2026:

| Check | Actual result |
| --- | --- |
| `npm run lint` | PASS, no warnings/errors |
| `npm run typecheck` | PASS |
| `npm test` | PASS, **825 tests / 59 files**; 63 added ETA tests |
| `npm run build` | PASS; existing large-chunk advisory remains |
| `node scripts/prepare-hrsc-model.mjs --verify-saved` | PASS, pinned HRSC assets and preserved CTX grid |
| `node docs/evidence/travel-time/verify-preservation.mjs` | PASS, **704 existing files byte-identical to 48410ca** |
| Isolated Chromium acceptance | PASS, **19 acceptance groups**, desktop/tablet/mobile/320 px |

Model tests include flat constant speed, bent actual waypoint paths, directional grade, roughness, alternate/custom profiles, speed bounds, scenario sums, stationary behavior, missing/blocked/unknown terrain, exact source/node identities, UTC calendars, overflow and route/departure changes. The report test independently evaluates the exported formula and haversine ground baselines for real native HRSC segments. Browser acceptance verifies profile/date/hold edits start **no new terrain worker** and leave exact routes, cells and costs unchanged.

The [browser replay](evidence/travel-time/browser/acceptance.mjs) launches fresh headless Chromium with no personal profile or security bypass, using the production preview on port 4174 and a Cairo timezone to test explicit UTC. [Final results](evidence/travel-time/browser/results.json), exported reports and hashed screenshots are saved alongside it. Only the intentionally injected source HTTP 503 generated a console error; there were no page exceptions. Independent model/report/UI review found no material scientific issue.

The first browser attempt stopped on an incorrect single-Tab expectation for Chromium's segmented native date control. Visual review also found the date field too narrow; it was given a full-width row and nested panel padding was removed. The second attempt stopped on a test expecting two CTX routes without a waypoint; the existing workflow correctly provides one in that case. The corrected complete replay passed. Attempt result records are retained; final screenshots supersede preliminary captures.

### Visual acceptance checklist

- [x] Desktop: map and actual routes remain visible beside a compact, readable ETA section.
- [x] Tablet: UTC input and numeric assumptions remain readable, with aligned field pairs.
- [x] Mobile 390 px and 320 px: bottom-sheet scroll works, no horizontal overflow, controls at least 44 px high.
- [x] Vehicle, UTC departure and hold controls work by keyboard; native date subfields lead to the next logical control.
- [x] Invalid drafts cannot replace applied estimates; pending/changed routes clear stale arrival.
- [x] Selected HRSC path, exact segment pagination and time breakdown update correctly.
- [x] Unknown terrain is blocked by default; explicit permission retains unknown metrics and an assumption label.
- [x] NASA/HRSC attribution, scientific details and all unresolved physical status gates remain accessible.
- [x] Original globe navigation, CTX distance routes, HRSC routes and map switching remain functional.
- [x] Exports retain exact segments, source IDs/hash scopes, assumptions, null unknowns and scientific limitations.

Reproduce browser acceptance with the production preview running:

```sh
npm run build
npm run preview -- --port 4174
node docs/evidence/travel-time/browser/acceptance.mjs
node docs/evidence/travel-time/verify-preservation.mjs --verify-saved
```

Playwright is available from the agent's isolated runtime, not a new application dependency. Set `REDLINE_BROWSER_MODULES` to a directory containing Playwright if reproducing in another environment. Existing source/evidence records are preserved; this milestone does not resolve their scientific gaps.
