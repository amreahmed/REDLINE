# Native HRSC Reference Implementation Plan

> **For agentic workers:** Execute this evidence milestone in the already authorized delegated lane. The user's requested evidence directory and execution instructions override generic plan-location and approval defaults.

**Goal:** Preserve and independently verify the complete native paired HRSC reference support around the unchanged original Belva CTX crop.

**Architecture:** Read the preserved CTX footprint and receipt-backed original HRSC TIFF contracts. Fetch only original native row segments, preserve signed samples and masks, then check them using the independent Rasterio/GDAL reader and PROJ coordinate transforms. Keep the numerical reference separate from production data.

**Tech Stack:** Python standard library, NumPy, Rasterio/GDAL, pyproj/PROJ; isolated `uv run` packages; no application dependencies.

**Spec:** `REDLINE_AI_Agent_Project_Spec.md`, scientific-integrity requirements; authorized scientific gate-resolution request.

## Global Constraints

- Preserve original 65,536 CTX cells, source manifests, transforms, and app code.
- No upsampling, interpolation, CTX datum conversion, route engine, producer contact, or device/browser interaction.
- HRSC native 50 m posting is not a proven effective terrain resolution or local error bound.
- An external HRSC reference is not independent ground truth: HRSC is in CTX control lineage.

## Review Focus

- A server that ignores Range must be rejected before consuming an unbounded response.
- A truncated or changed source response must fail length, range, and SHA-256 checks.
- NoData must remain -32768 with mask 0; a real zero height must remain valid.
- The 3,396,000 m HRSC horizontal sphere must not be replaced by CTX's 3,396,190 m sphere.
- Native border overhang must be labelled and excluded from later whole-footprint comparisons.

## Task 1: Complete native paired reference

**Files:** `build-hrsc-reference.py`, `hrsc-native-reference.json`, paired `.i16` / `.u8` files, original `ranges/`, receipts, projection/reader validation, and `README.md` in this directory.

**Interface:** Manifest `grid` supplies global start row/column and native shape; `sourceGeotransform` / `cropGeotransform` use GDAL order. Each `products.dt5` / `products.da5` contains signed little-endian row-major encoding, explicit validity encoding, hash, scale/offset/NoData, original URL, and exact vertical citation.

- [x] Run fail-closed response/NoData/source-contract checks.
- [x] Extract floor/ceil aligned native crop; retain receipt-backed original row bytes.
- [x] Compare every extracted sample and mask using Rasterio/GDAL against an ephemeral sparse source containing only known original byte ranges; do not treat holes as observations.
- [x] Validate axis order, projection/radius, original footprint edges, and native indices using pyproj and Rasterio.
- [x] Check paired vertical algebra, retained earlier native controls, and complete interior coverage.
- [x] Save authoritative attribution/usage/methodology evidence; report unknown exact acquisition/version and local effective resolution.
- [x] Run offline native/documentation `--verify-saved`, plus independent real-cell comparison quadrature review.
- [ ] Parent owns application checks, integrated handoff, and milestone checkpoint.
