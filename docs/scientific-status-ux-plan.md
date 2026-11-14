# Scientific status presentation refinement

Scope: presentation only, using the 15 November A–L audit at checkpoint `bcc9426`. Preserve the scientific gates, original reports, sources, 65,536 cells, coordinate/terrain/routing implementations and operational failure/retry behavior.

Design: retain the existing space `#080d13`, panel `#101923`, elevated `#1a2935`, ink `#edf3f6`, muted `#a9bac6` and interactive cyan `#83d7df` palette. Use amber `#efc382` only for a relevant unresolved status or failure. Keep Segoe UI body and Bahnschrift headings, readable 13–14 px qualifications, current drawers and native expandable details. The map remains the primary view; no new cards, motion or decoration.

```text
Main viewport                Context drawer
Map / visual globe           Relevant short qualification
Selected-target OR route     Existing working controls/results
qualification                Expandable scientific/model details

Footer: Scientific validation: Partial [opens details]
        Current planning activity only
```

The design review keeps the current Mars identity and changes information density instead of creating a new visual theme. All eleven required status distinctions belong in the detailed science view; conditional map labels and the route's exact safety qualification remain visible in their relevant context.

- [x] Add a keyboard-accessible scientific-status control that reveals and focuses details.
- [x] Consolidate repeated terrain/feature/globe/route paragraphs into concise contextual labels and full expandable details.
- [x] Display actual map product identifiers and MOLA's rendered-image distinction.
- [x] Strengthen detailed status/evidence content and provide the immutable audit download. Full mission export remains a separate unimplemented feature.
- [x] Verify source/gate/algorithm preservation; run lint, typecheck, all tests and build.
- [x] Verify desktop/tablet/mobile, keyboard focus/return, real imagery/routes, details/download, failures/retries and conditional warnings in isolated Chromium.
- [x] Record every warning disposition and create a separate verified checkpoint. Do not push or start another feature.

Results, scope, evidence and the complete disposition log are in [scientific-status-ux-verification.md](scientific-status-ux-verification.md).
