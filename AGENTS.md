# AGENTS.md — REDLINE Project Instructions

## Project purpose
REDLINE is a Mars exploration and hypothetical surface-route planning web prototype for NASA Space Apps Challenge 2026, “Interplanetary Survival Guide: Martian Map.” Its purpose is to help users explore sourced Mars map layers, inspect science targets, compare route options, and understand the evidence and limitations behind results.

## Read these sources first
- Read `REDLINE_AI_Agent_Project_Spec.md` before making product or architecture decisions.
- Inspect the repository, existing code, package scripts, tests, and current Git state before editing anything.
- Treat existing working code as valuable. Extend it instead of replacing it without a clear reason.
- Re-check the official challenge page and current rules before work tied to submission; do not assume old dates, challenge requirements, data access, or endpoints remain current.

## Working approach
- Work in small, reviewable milestones. Start with repository/data discovery, then implement one approved milestone at a time.
- Before a significant change, state briefly what will change and which files or areas are affected.
- Do not stop at a plan or static mockup when implementation has been requested. Build a functioning app and verify it.
- Do not silently skip blockers. Explain what is unavailable, what was tested, and which fallback is being used.
- After a milestone, report completed behavior, files changed, commands/tests run, results, limitations, and the next recommended milestone. Do not begin unrelated features before the current milestone is verified.

## Git and commit workflow
- Treat Git commits as recovery checkpoints. Inspect `git status` and the current branch before starting; never overwrite or discard pre-existing uncommitted user changes.
- Make small, reviewable changes and create a commit after each completed, verified milestone. Also create a separate commit for a meaningful, independently reviewable bug fix when its relevant checks pass. Do not create a commit for every tiny edit or individual line change.
- Before each commit, review `git diff` and `git status`, stage only files related to the current milestone (avoid blindly running `git add .`), and run the relevant tests/checks. Do not claim a check passed unless it was run.
- Use a clear, descriptive commit message, preferably Conventional Commits style, such as `feat(map): add verified Mars basemap` or `fix(routes): handle missing terrain cells`.
- If validation fails, investigate and fix it before marking the milestone complete or making a verified checkpoint. Report any unavoidable failing check honestly.
- Never use destructive Git commands, discard user changes, amend existing commits, rewrite history, force-push, or push to a remote without explicit user approval. Do not create a remote or publish code unless requested.
- After each milestone, report the commit hash and message, files changed, checks run and their actual results, and any known limitations. If Git is not initialized or a commit cannot be created, explain why and provide the exact next step instead of pretending it was committed.

## Preferred technical direction
- Prefer React + TypeScript + Vite for the application foundation, and Tailwind CSS for styling, unless repository discovery gives a strong reason to retain a different working stack.
- Use OpenLayers for the regional geospatial map where it fits the verified data services.
- Use Three.js with a suitable glTF loader for the optional visual Mars globe.
- Use a documented graph/grid pathfinding algorithm such as Dijkstra or A* only after valid route inputs and terrain-cost data are available.
- Avoid adding dependencies without a clear requirement. Use the repository’s existing package manager and scripts; do not replace lockfiles or migrate the stack casually.
- Keep data access, geospatial transformations, route calculations, and UI components separated into understandable modules.

## Scientific integrity — non-negotiable
- Never fabricate NASA observations, citations, product identifiers, coordinate values, elevation/slope measurements, hazard detections, data timestamps, route metrics, or safety probabilities.
- Verify data providers, exact service endpoints/layer names, spatial reference systems/projections, coverage, resolution, units, attribution, terms, and browser/network access before relying on a source. Do not claim an endpoint works unless it has actually been tested.
- Keep a clear distinction between (a) a rendered map tile or image, (b) a visual 3D globe/model, and (c) a numerical digital elevation model (DEM). RGB image colors are not elevation values unless the source explicitly documents a valid encoding and a correct decoding method.
- NASA’s downloadable Mars glTF model is for visual/orientation use unless its contents are separately validated for another purpose. It does not replace a numerical DEM for slope or terrain-cost calculations.
- Respect the dataset’s coordinate reference system. Do not assume Earth/Web Mercator conventions apply to Mars. Validate coordinate transformations and units before calculating distance or slope.
- Handle NoData, missing coverage, failed requests, and out-of-range coordinates explicitly. Never treat missing terrain as zero elevation or as safe/low-cost terrain.
- Label synthetic, example, placeholder, and simulated data conspicuously in the UI and reports. Never mix demo data with real measurements without clear separation.
- Explain route scoring criteria, weights, assumptions, and limits. A route score is a model output, not proof that a route is safe for astronauts. REDLINE is not a certified human-safety system and must not be described as an official NASA product or NASA-endorsed tool.
- Show source/provenance information near each data layer or target when practical, and include attribution and limitations in the source panel and README.

## Product and UX expectations
- Build a mission-planning workspace, not just a marketing landing page or decorative globe.
- Prioritize a working regional map, verified layer controls, source/status information, selectable origin/destination, route comparison based on valid inputs, and clear explanations.
- Every visible control must work or be clearly disabled with an explanation. Do not leave fake buttons or interactions that only look functional.
- Include loading, empty, error, missing-data, and offline/unavailable-service states as appropriate.
- Make the app responsive and accessible: semantic controls, keyboard access, visible focus, readable contrast, helpful labels, and status not conveyed by color alone.
- Use restrained, coherent mission-control styling. Avoid decorative complexity that harms map readability, usability, or performance.

## Code quality and safety
- Use TypeScript types for important application and geospatial data. Avoid `any` unless justified and documented.
- Keep functions focused and test route math, coordinate conversions, score calculations, and NoData handling where applicable.
- Do not hard-code credentials, private tokens, or secrets in client code. Use environment variables only where appropriate, document required variables, and provide safe defaults.
- Do not run destructive commands, delete user work, or overwrite substantial existing files without checking the impact first.
- Do not claim tests/builds pass unless their commands were executed and the outcomes observed.

## Verification before calling a milestone complete
1. Run the relevant lint command, if configured.
2. Run TypeScript/type checking, if configured.
3. Run relevant unit/integration tests, if configured.
4. Run a production build.
5. Smoke-test the main user journey in the available environment: open the app, load the map/layers, interact with controls, and inspect any route workflow that is implemented.
6. Report any command that could not be run and why; do not substitute assumptions for results.

## Documentation and handoff
- Keep `README.md` current with setup, run, build, tests, verified data sources, attribution, configuration, and known limitations.
- Keep `REDLINE_AI_Agent_Project_Spec.md` as the detailed product specification. Do not duplicate the entire spec in this file; this file is the durable set of working rules.
- At handoff, clearly separate: implemented and tested; data-backed and verified; simulated/demo-only; and incomplete/unverified.
