# Existing A* and terrain arithmetic audit

This audit preserves `distanceRoutes.ts`, its heap/search procedure, the route worker/client/hook, terrain algorithms, UI controls and all 65,536 source cells. Only a diagnostic test suite and this evidence package were added. No second A*, new route mode, weight change, DEM correction or scientific gate change was made.

## Evidence and reproduction

Read implementation: `src/features/routing/{distanceRoutes,routeWorker,routeTask,useDistanceRouting,types}.ts`, `src/components/mission/RoutePlanner.tsx`, `src/features/terrain/{terrainMath,terrainMetrics,terrainGrid}.ts`, `src/data/terrainScience.ts`, endpoint selection and associated existing tests. Project rules and the detailed specification were read; accessible `mars-data-integrity` and `verification-before-completion` skills were used.

```powershell
$env:REDLINE_WRITE_ROUTING_AUDIT='1'
npx vitest run src/features/routing/routingAudit.test.ts --reporter=verbose
npx eslint src/features/routing/routingAudit.test.ts --max-warnings 0
```

Observed: **12 diagnostic tests passed**, zero failures; scoped ESLint exit 0. The first command regenerates [algorithm-cost-results.json](algorithm-cost-results.json) from the preserved source grid and synthetic fixtures. Normal test runs do not write evidence. No browser was used by this audit lane. Full project checks are reported separately by the parent audit.

The grid hash reproduced by the diagnostic suite is `4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8`. Synthetic heights, obstacles, NoData masks, costs and datum examples are test inputs only, never Mars observations or application data.

## Search and reconstruction

The existing A* kernel uses a binary min-heap ordered by estimated total cost, then discovered cost, then node number. Lazy duplicates are filtered against the current best distance. A newly improved route reopens a previously expanded node; the `visited` array counts distinct expanded nodes rather than suppressing reopening. The goal is accepted when the best current score is popped. Predecessors reconstruct a source-to-goal path, with a bounded chain and endpoint check. Invalid indices, nonfinite/negative costs, unsupported node counts and arithmetic overflow return unavailable. Empty reachable frontiers return an explicit disconnected result.

The native product adapter checks the exact manifest/storage contract and finite native cells. It offers eight-neighbor edges, excluding missing cells and diagonals with missing flank cells. The application rejects identical origin/destination cells; the reusable mathematical kernel correctly returns a one-node zero-cost path for an identical valid graph node. Those are separate API policies, not a conflict.

The new suite compares A* with independent linear-scan Dijkstra using a separately evaluated closed-form edge cost, and independently reconstructs the cost of each returned path. Five grids use weights `0, 0.25, 1, 4, 16`: open/flat, obstacle detour, NoData gaps, disconnected halves and an analytical plane. **4,120 valid endpoint-pair/weight comparisons** passed, including **360 disconnected pairs**. Additional tests cover equal-cost deterministic alternatives, boundary nodes, same-cell/product-blocked endpoints and a directed graph with asymmetric nonnegative costs. Existing tests additionally cover invalid controls/costs, node reopening under an admissible inconsistent heuristic, full crop boundaries, native missing flanks, independent Floyd–Warshall and masked native Dijkstra fixtures.

No reproducible production algorithm defect was found under the documented graph/cost/heuristic contract. The invalid-heuristic test is a deliberate synthetic caller-contract violation: a node heuristic of 10 exceeds its true remaining cost 1, so A* returns cost 3 while Dijkstra gives 2. It demonstrates why arbitrary future discounts or bonuses require a new proven lower bound; it does not describe the native graph's heuristic.

## Heuristic validity

Current native edges use `d(u,v)`, the shortest sphere arc on the source reference sphere, in metres. The heuristic is `h(u)=alpha*d(u,goal)`, where `alpha=1-1e-9`. The sphere metric's triangle inequality gives:

`h(u) <= alpha*d(u,v) + h(v) <= d(u,v) + h(v)`.

Thus the current heuristic is admissible and consistent in exact arithmetic, equals zero at the goal, and uses the same units as its costs. The contraction is a conservative numerical margin, not a terrain weight or a scientific uncertainty estimate. The diagnostic checked **2,606,100 directed-edge/goal inequalities** over every adjacent native edge for four crop-corner goals and one center goal. Minimum computed consistency slack was **1.8929881662188563e-8 m**, with zero negative inequalities. This is a numerical exercise for those five goals; the metric proof supplies the exact-arithmetic general argument. It is not an independent measurement of source positional accuracy or a formal bound for every floating-point input.

The preserved squared-grade model satisfies `c=d*(1+w*g²) >= d` for finite `w>=0`, so the same geometric lower bound also remains valid for that proposed model when its inputs are authorized. The current production adapter does **not** call it. Nonnegative directional costs are compatible with A* when a valid lower bound is supplied, but merely being nonnegative does not guarantee `c>=d`: discounted movement, factors below one or science bonuses can invalidate the geometric heuristic and require a smaller proven bound or zero/Dijkstra. Negative costs remain unsupported.

## Grade calculation and scientific gate

`calculateGrade(rise, run)` gives directional `g=rise/run`, signed degrees `atan2(rise,run)*180/pi`, and percent `100*g`. `inspectTerrainEdge` reads distinct adjacent native cells, enforces diagonal flanks, then requires the exact scientific height contract before subtracting elevations. It is an **edge grade**, not a two-dimensional finite-difference gradient, maximum neighborhood slope, hazard threshold or terrain profile. There is no current derivative stencil to validate or silently truncate at boundaries. A future gradient feature needs its own documented stencil, valid-neighbor policy, physical horizontal spacings and boundary behavior.

Existing tests cover flat/inclined/reversed rise/run, units, invalid/NoData support, boundaries, absent diagonal flanks, exact zero grade and overflow/underflow. The new analytical plane `z=0.25*x-0.5*y+C` verifies cardinal and diagonal directions and reverse signs. An eastward edge has grade `0.25` (14.036243467926477 degrees); the northward test edge has `-0.5` (-26.56505117707799 degrees); the `(20,20)` diagonal has `-0.17677669529663687` (-10.024987862075742 degrees). These are synthetic plane values, not sampled Mars slopes.

A **common constant vertical offset cancels from height differences** and therefore from directional grades and this squared-grade cost, provided horizontal runs and the local height quantity are otherwise valid. Tests with exact common offsets `0, 1024, 3396190` retain identical grades and costs; they are algebraic fixtures and do not authorize adding a Mars radius to a product. Absolute elevation/radius comparisons and altitude thresholds still require the correct vertical reference. Requantizing corrected data into float32 can introduce new rounding even when the underlying mathematical offset is constant.

For a spatially varying correction `N(x,y)`, differences become `delta-z + delta-N`, so the gradient changes by `grad-N`. The synthetic correction `N(x,y)=0.02*x` changes the 20 m east-edge ratio from `0.25` to `0.27`. It demonstrates why an undocumented areoid/sphere relation or inter-product tilt cannot be assumed to be harmless. The actual CTX band's supported local height interpretation remains unresolved; **real-Mars grades stay gated**. Numerical finite samples alone cannot resolve that scientific prerequisite.

NoData is filtered at the source-cell adapter before differences/costs; the pure arithmetic helpers accept already authorized finite rise/run values and cannot identify a source mask from a lone number. The application does not synthesize flat terrain, partial stencils or inferred interpolation at missing locations. No per-cell original stereo/interpolation/fill provenance mask is present in the route data, so finite coverage is not proof of a direct measurement at every cell.

## Terrain cost and sensitivity

The existing preference model is `c=d*(1+w*g²)`, equivalently `d+w*rise²/d`. It reports distance, penalty and total in **cost-equivalent metres**. Weight `w` is finite, nonnegative and dimensionless; it is a proposed preference, not a measured terrain property. No calibrated human effort, energy, risk, survival threshold or hazard score is defined. Squaring makes the proposed uphill and downhill edge penalty symmetric when the endpoint heights and run reverse. There is no observed directional human-traversal calibration.

Balanced multiplication avoids preventable intermediate overflow/underflow. Existing tests exercise extreme representable factors, true overflow/underflow rejection, exact zero penalties, nonnegative costs and monotonicity. Missing/invalid source support is unavailable rather than low cost. A filled/interpolated sample would need additional quality provenance and a documented policy before physical interpretation; no such new policy was fabricated.

The synthetic 3 × 5 grid has one 20 m high cell, 20 m planar spacing, start/end at the middle row boundaries and otherwise zero test heights. Direct cost is `80+40*w`; the shortest flat detour costs `40+40*sqrt(2)=96.5685424949238`. The independent transition weight is `sqrt(2)-1=0.41421356237309515`.

| Synthetic weight | Optimal cost-equivalent m | Visits the synthetic hill |
| --- | --- | --- |
| 0 | 80 | Yes |
| 0.25 | 90 | Yes |
| 0.5 | 96.5685424949238 | No |
| 1 | 96.5685424949238 | No |
| 4 | 96.5685424949238 | No |
| 16 | 96.5685424949238 | No |

A* and independent Dijkstra agree on every sensitivity case. These arbitrary weights illustrate the effect of a modeling preference; none is recommended as a calibrated Mars-traverse setting. No scientifically invalid CTX sample was used to generate physical terrain costs.

## Worker, input state and displayed metrics

The client owns one worker per request and terminates it on settlement, explicit cancel, obsolete input effect cleanup, timeout/error or unmount. It validates provenance, endpoints, native coordinates, adjacent edges, both diagonal flanks and the independently summed path distance. It rejects a shorter-than-shortest waypoint comparison beyond the explicit rounding tolerance. Requests clone the original float32 buffer without a transfer list, preserving the source buffer. Input-bound keys include the loaded grid instance, terrain phase, native endpoints and active waypoint; mismatched stored results are hidden immediately. Worker identity checks ignore obsolete completions.

The overlay and existing UI preserve hypothetical/simulation labels, distinct native G-O/G-D versus approximate reference O/D, active waypoint versus draft fields, route selection and scientific limitations. Displayed distance is the sum of source-sphere edge distances, not a surface-following length. Via routes can revisit cells, and the UI uses **cell visits**. Worker `visitedCells` counts expanded nodes, not path length or scientific confidence; it is not displayed as such. Existing lifecycle/protocol tests were inspected; browser observations and full project checks belong to the parent report.

## Separate capability findings

| Property | Status and reason |
| --- | --- |
| Existing A* mathematical correctness | **VERIFIED under its documented contract**: independent synthetic optimality/reconstruction checks, reopening and validated finite nonnegative costs. No scientific terrain inference follows. |
| Current heuristic admissibility/consistency | **VERIFIED for the stated sphere-distance model in exact arithmetic**; numerical inequalities exercised across all native edges for five goals. |
| Reconstruction and metric reproduction | **VERIFIED for the mathematical graph**: independent edge-sum checks, native client/provenance guard and existing reconstruction tests. |
| Grade arithmetic | **VERIFIED on synthetic authorized rise/run fixtures**; current API is directional edge grade. |
| Native real-Mars slope inputs/results | **UNVERIFIED / gated**: exact local height interpretation and variable datum effects are unresolved. |
| Two-dimensional slope stencil | **NOT APPLICABLE to current directional edge-grade API**; no maximum-slope raster feature exists. |
| Cost arithmetic/nonnegativity | **VERIFIED for finite synthetic inputs and w>=0**; consistent cost-equivalent units and numerical failure behavior. |
| Cost scientific calibration/real-Mars terrain routing | **UNVERIFIED / gated**: preference weights are assumptions and valid local height inputs are absent. |
| NoData/invalid adjacency rules | **VERIFIED for the source-cell/graph contract**; per-cell original interpolation/measurement quality remains a separate evidence gap. |
| Production path/waypoint comparison | **VERIFIED as a hypothetical distance-only graph calculation**, not scientifically validated traversability or precise named-site routing. |
| Safety/effort/survival prediction | **NOT APPLICABLE**: no calibrated safety model is implemented or claimed. |

Keep the existing hypothetical distance-only modes enabled with their disclosures. Keep physical slopes, terrain costs and precise named-feature routing unavailable until their scientific prerequisites are resolved. The next small algorithm task is evidence integration and full project verification by the parent; no production correction is justified by this audit's results.
