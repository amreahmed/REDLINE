# REDLINE Step 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Execution note: those executor packages are absent, as documented in the repository skill audit. The user explicitly authorized implementation in this session; implement directly without an additional approval gate or installing executor packages.

**Goal:** Build only the responsive application foundation and initial mission-control shell.

**Architecture:** A React workspace owns transient display preferences. Small layout components present the mission sidebar, explicitly non-geographic map placeholder, empty information panel, and an accessible native about dialog. No data adapters or scientific models are added.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, npm, ESLint.

**Spec:** `REDLINE_AI_Agent_Project_Spec.md`, narrowed by the user's Step 1 request and approved discovery report of 24 October 2026.

## Global Constraints

- “Preserve all existing files and changes.”
- “Do not integrate NASA data yet.”
- “Do not use OpenLayers or Three.js yet.”
- “Do not implement routing, DEM processing, or scientific calculations.”
- “Do not add unnecessary dependencies or features.”
- “Stop after Step 1. Wait for my approval before starting Step 2.”

## Review Focus

- Narrow screens: readable panels and no horizontal overflow at 375 px and 768 px.
- Keyboard input: controls have visible focus; the dialog closes with Escape and returns focus.
- Panel visibility: collapse and restore both panels independently without losing grid preference.
- Data absence: no imagery, coordinates, metrics, or active data-dependent controls imply connected sources.
- External connectivity: the shell uses only bundled code and local vector assets; no remote fonts or data requests.

## Design

Palette: space `#0B0F14`, panel `#121922`, elevated `#18222D`, text `#F2F5F7`, rust `#E06B45`, cyan `#58C7D8`. Secondary text uses the specification's `#A8B3BE`.

Type: locally available Segoe UI/system sans-serif for readable controls, with a compact bold REDLINE wordmark. Sentence-case interface labels.

Layout: a quiet header and workspace bar above a left-aligned three-column instrument workspace. The spacious central grid is a placeholder, never an illustrative planetary map. At tablet size, information stacks below the viewport; at phone size, the viewport precedes the panels.

```text
Brand / workspace context                       Preview / About
Workspace                                  Panel visibility controls
Mission control | Map placeholder                    | Information
                | Grid visibility / empty state      | Empty state
Independent prototype                             No sources connected
```

Brief review: retain the prescribed dark palette but avoid invented telemetry, a decorative globe, repeated glowing cards, and fake geographic contours. Make the empty viewport the characteristic element; keep surrounding controls restrained.

### Continuation review — 25 October 2026

The foundation files above already exist as uncommitted work. Preserve their configuration and component boundaries, finish the shell in place, and verify before any commit. Replace the central promotional headline with a direct map-empty-state heading; the viewport should explain its current state. Keep the existing six-color palette, system typography, and three-column composition. Label the display grid as non-geographic, and give the icon-only mobile About control a persistent accessible name.

Automated browser approval returned HTTP 503. The user subsequently completed the manual browser smoke test and explicitly reported PASS for visual layout, button/dialog interactions, keyboard navigation, browser console, and responsive layout. Use only those five reported checks as browser evidence; do not treat HTTP responses as browser verification.

### Task 1: Foundation and working shell

**Files:**
- Create: package/lockfile, HTML entry, Vite/TypeScript/ESLint configuration, `.gitignore`, local favicon.
- Create: `src/main.tsx`, `src/app/App.tsx`, `src/components/layout/` components, `src/components/map/MapPlaceholder.tsx`, `src/components/shared/Icon.tsx`, `src/styles/index.css`.
- Create: `README.md`.

**Interfaces:**
- `MapPlaceholder({ showGrid, onToggleGrid })` accepts a boolean and a callback.
- `MissionControl()` and `InformationPanel()` present disabled setup and empty information states.
- `App()` owns panel visibility and grid preference; preferences last for the current page session.

- [x] Add configuration and install only the framework, styling, type, and lint dependencies using npm.
- [x] Implement the shell, panel/grid state handlers, and native about dialog.
- [x] Document installation, run/check commands, component boundaries, and Step 1 limitations.
- [x] Run `npm ci`, `npm run lint`, `npm run typecheck`, and `npm run build`; require exit 0.
- [x] Start `npm run dev` (loopback configured in Vite). Record the user's explicit manual PASS results for visual layout, button/dialog interactions, keyboard navigation, browser console, and responsive layout. Browser network inspection was not reported.
- [x] Start `npm run preview` and verify production HTML, CSS, JavaScript, and favicon return HTTP 200. This is an HTTP serving check; a separate production browser smoke test was not reported.

Checkpoint procedure: review whitespace, the full staged diff, and Git status; stage only Step 1 paths and create one milestone commit after the checks pass. Do not push. The resulting commit is recorded in Git history.

No unit-test framework is added for transient display controls. Browser smoke checks exercise actual behavior; numerical tests belong to later authorized work.

## Verification evidence — 25 October 2026

The four configured install/check commands above exited 0. `npm run dev` started Vite 8.3.5 on port 5173; `npm run preview` started on port 4173. PowerShell `Invoke-WebRequest` checks returned HTTP 200 for the development entry and selected modules and for every asset referenced by the production HTML. An independent read-only review found a mobile About accessible-name issue; the control now has a persistent `aria-label`. Source review found no data integrations or out-of-scope libraries.

The browser tool could not open the local app: automatic approval review returned HTTP 503 before navigation. The user then supplied manual PASS results for visual layout, button/dialog interactions, keyboard navigation, browser console, and responsive layout, resolving the required shell smoke-test gate. No additional browser checks are inferred from that report. Lint, type checking, and the production build were rerun successfully for the checkpoint. The unrelated `.http-forge/AGENTS.md` is excluded from the milestone.
