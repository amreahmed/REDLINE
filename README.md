# REDLINE

REDLINE is an independent Mars exploration and hypothetical surface-route planning prototype. **Step 1 implements only the application foundation and initial mission-control UI shell.** The central viewport is explicitly labeled as a map placeholder; it displays no geographic or scientific data.

## Setup and run

Use Node.js **20.19+ in the 20.x line, or 22.12+**, with npm. This milestone was developed with Node 26.3.1 and npm 11.16.0. Keep the supplied npm lockfile; no other package manager is required.

```powershell
npm ci
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The server binds to loopback and reports an error if its port is occupied. Choose another port with `npm run dev -- --port 5174` if needed. No credentials or environment variables are required.

## Checks and production preview

```powershell
npm run lint
npm run typecheck
npm run build
npm run preview
```

The production build is written to `dist/`. Open [http://127.0.0.1:4173](http://127.0.0.1:4173) for the local preview. Use Ctrl+C to stop either server.

ESLint treats warnings as failures. Type checking covers the application and Vite configuration. There is no unit-test or end-to-end test runner configured in Step 1; use the browser smoke checklist below to verify the shell. Later calculation and data-integration milestones require their own relevant tests.

To smoke-test this shell, open it at desktop, tablet, and phone widths; hide and restore each panel; switch the display grid off and on; open About; close it with Escape; and navigate with Tab to check focus and keyboard activation. The page must show no horizontal overflow, fatal console errors, or scientific-data requests.

### Verification status — 25 October 2026

Executed with Node 26.3.1 and npm 11.16.0:

| Check | Observed result |
| --- | --- |
| `npm ci` | Exit 0; 184 packages installed. npm reported an upstream ESLint 9 deprecation warning. |
| `npm run lint` | Exit 0; no errors or warnings from ESLint. |
| `npm run typecheck` | Exit 0. |
| `npm run build` | Exit 0; Vite generated the production HTML, CSS, and JavaScript. |
| `npm run dev` | Vite started at `http://127.0.0.1:5173/`; HTTP checks returned 200 for the HTML, entry module, app, dialog, stylesheet, and favicon. |
| `npm run preview` | Preview started at `http://127.0.0.1:4173/`; HTTP checks returned 200 for the production HTML, JavaScript, CSS, and favicon. |
| Visual layout | PASS — user-reported manual browser smoke test. |
| Button and dialog interactions | PASS — user-reported manual browser smoke test. |
| Keyboard navigation | PASS — user-reported manual browser smoke test. |
| Browser console | PASS — user-reported manual browser smoke test. |
| Responsive layout | PASS — user-reported manual browser smoke test. |

Lint, type checking, and the production build were rerun before the Step 1 checkpoint. Browser evidence comes from the user's five explicit PASS results; automated browser control was unavailable because its approval service returned HTTP 503. Browser network inspection and a separate browser run against the production preview were not reported and are not claimed as verified. All existing scaffold files were preserved and refined in place.

## Implemented

- React + TypeScript + Vite, with Tailwind CSS through its Vite plugin.
- Responsive dark workspace with a REDLINE header, mission-control sidebar, central map placeholder, and empty information panel.
- Independent panel visibility controls and a display-grid toggle. These display preferences reset on a page reload.
- Keyboard focus styling, a skip link, labeled controls, reduced-motion support, and a native modal About dialog.
- Disabled region/layer controls with explanations of their unavailable state.

## Structure

```text
src/app/App.tsx                       Workspace and transient display state
src/components/layout/               Mission control, information, About
src/components/map/MapPlaceholder.tsx Non-geographic empty viewport
src/components/shared/Icon.tsx        Local interface vector icons
src/styles/index.css                 Tailwind, design tokens, responsive layout
public/favicon.svg                   Original REDLINE mark
```

Vite, TypeScript, and ESLint configuration are at the repository root. The implementation checklist is in `docs/superpowers/plans/2026-10-24-step-1-foundation.md`. The detailed product specification remains in `REDLINE_AI_Agent_Project_Spec.md`; repository working rules remain in `AGENTS.md`.

## Data, attribution, and limitations

**Data-backed layers: none in Step 1.** NASA and planetary datasets have not been integrated. No map projection, coordinate convention, DEM, observation, route, metric, or scientific calculation is implemented. The display grid is a visual layout aid, with no geographic coordinates or physical scale. There is no simulated terrain or route data.

Region and layer controls are intentionally disabled. The information panel remains empty because no features can be selected yet. OpenLayers, Three.js, data services, terrain processing, and routing are deferred to separately approved milestones.

The wordmark, favicon, and simple SVG interface icons are original local assets; no remote imagery, fonts, or icon library is loaded. The UI palette follows the existing project specification. Dependencies and their resolved versions are recorded in `package-lock.json`; their license metadata is supplied with the installed packages.

REDLINE is not an official NASA product, is not NASA-endorsed, and is not a certified human-safety system. Re-check official challenge rules before submission-related work. Step 2 requires explicit user approval and fresh verification of the chosen data services before integration.
