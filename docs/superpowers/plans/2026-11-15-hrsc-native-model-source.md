# HRSC Native DEM Model Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the separately sourced 103 × 103 HRSC DT5 native subset as an explicitly qualified provider DEM model while retaining every CTX cell and existing scientific gate.

**Architecture:** A reproducible Node preparation script copies hash-verified evidence into three bounded public assets. A strict source adapter validates the pinned manifest and decodes unchanged native int16 heights and their validity mask. A cancellable loader verifies SHA-256 before exposing the shared `TerrainModelGrid` API.

**Tech Stack:** Existing TypeScript, Web Crypto, Node.js and Vitest; no new dependency.

**Spec:** `C:/Users/LOQ/.codex/attachments/5b99dd10-a397-4407-bf5d-fd8205d4c890/Pasted text.txt`; parent-approved HRSC source-adapter scope.

## Global Constraints

- Preserve all 65,536 CTX cells, existing evidence, transformations and CTX scientific gates.
- HRSC authorization is `provider-dem-model`; physical slope accuracy and precise feature registration remain unverified.
- Retain all 10,609 native 1 m quantized int16 samples, 50 m projected spacing and the 3,396,000 m sphere.
- No resampling, interpolation, datum correction, producer contact, remote push or child checkpoint commit.
- Retain ESA/DLR/FU Berlin attribution and CC BY-SA 3.0 IGO licence.

## Review Focus

- Same-size altered bytes must fail SHA-256 verification before any model is returned.
- A forged source, radius, vertical label, added validation claim or invalid mask must fail closed.
- Unavailable/oversized/truncated assets must produce errors without substitute terrain.
- Cancellation/timeout must remain effective during both fetches and stream reads.
- Source hashes must identify their actual scope; the complete 638 MB TIFF has not been hashed or downloaded.

---

### Task 1: Reproducible native assets and authorization record

**Files:** Create `scripts/prepare-hrsc-model.mjs`, `public/data/hrsc-terrain-model.json`, `.i16`, `.u8`, and `docs/evidence/terrain-model/source-authorization.md`.

**Interfaces:** Produces pinned native assets from `docs/evidence/scientific-gate-resolution/hrsc/`; `node scripts/prepare-hrsc-model.mjs --verify-saved` validates without writing.

- [x] Verify preserved evidence-manifest, binary, validity and CTX hashes before processing.
- [x] Implement exact native-byte copying with strict DT5 source, CRS, encoding, mask, coverage and summary checks; reject changed existing outputs.
- [x] Run preparation and saved verification; record exact output hashes, original-source access scope and supported/unverified claims.

### Task 2: Strict model source adapter

**Files:** Create `src/features/terrain/hrscModel.ts` and `hrscModel.test.ts`.

**Interfaces:** Produces `parseHrscModelManifest(input: unknown)` and `decodeHrscModel(manifest, sampleBytes: ArrayBuffer, validityBytes: ArrayBuffer): TerrainModelGrid`.

- [x] Write and run tests for exact manifest, full native preservation, source relabelling, changed radii, summary and masks.
- [x] Implement a closed source contract and little-endian signed-int16 decoding; preserve sentinel semantics and source qualifications.
- [x] Run focused tests; require zero failures.

### Task 3: Bounded integrity-checked browser loader

**Files:** Create `src/features/terrain/loadHrscModel.ts` and `loadHrscModel.test.ts`.

**Interfaces:** Produces `loadHrscModel(options?: {signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number}): Promise<TerrainModelGrid>`.

- [x] Write and run loader tests for success, HTTP/format failure, changed bytes, bounded streams, crypto failure and cancellation/timeout.
- [x] Implement manifest-first checksum validation followed by bounded, cancellable binary/mask requests; require hashes before decoding.
- [x] Run focused tests and lint for owned files. Root performs combined typecheck, full tests, production build, UI acceptance and checkpoint review after integration.

Source-lane outcomes: 35 focused tests passed; scoped ESLint passed; `npm run typecheck` passed; `node --check scripts/prepare-hrsc-model.mjs` and saved asset verification passed. No child commit or remote operation was performed.
