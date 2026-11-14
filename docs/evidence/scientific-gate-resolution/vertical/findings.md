# Exact CTX final-height contract — bounded public audit, 14 November 2026

**The exact final vertical surface, correction model/version and operation sign remain unresolved.** No datum relabelling, elevation correction, physical-slope authorization or route authorization follows from this investigation. The original TIFF and all 65,536 cropped CTX samples remain unchanged.

Product: `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0`, [USGS DOI 10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8). Original TIFF SHA-256: `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b`.

## Public release and revision evidence

- A normal HTTPS [S3 ListObjectsV2 request for the CTX release prefix](https://asc-pds-services.s3.us-west-2.amazonaws.com/?list-type=2&prefix=mosaic%2Fmars2020_trn%2FCTX%2F&max-keys=1000) returned **200**, 35 keys and `IsTruncated=false`. The entire TRN prefix returned **200**, 92 keys and `IsTruncated=false`. The exact product has four current objects: TIFF, FGDC XML, ISIS label and PDS3 label. The CTX directory contains no released processing history, readme, execution manifest or geoid model grid. The published index and complete inventories are saved.
- Current exact-product objects have S3 `LastModified` dates of **10 November 2022**. These are storage-object timestamps, not evidence of a scientific processing revision. A multipart ETag is not treated as a SHA-256 or single-file MD5.
- Anonymous version listing for the exact product returned **403 AccessDenied**. This establishes unavailable public history access at that endpoint; it does not establish that older object versions do not exist.
- The [DataCite DOI record](https://api.datacite.org/dois/10.5066/P906QQT8) returned **200**, with `version=null`, no related identifiers, and registration/update dates of **27 July 2020**. It supplies no correction or processing revision. The DOI resolves to the exact Astrogeology product page, whose catalogue link identifies CKAN package `2d14f45e-e7d3-41e7-aa50-9a8d080cf3cc`. Its public package, activity and revision APIs all returned **404 HTML**, not JSON. A derived `.json` page also returned **200 HTML**, so it was not used as structured metadata.
- Fresh exact-product and USGS catalogue FGDCs still describe metre elevations referenced to a **3,396,190 m IAU sphere**. Fresh FGDCs for all three named CTX components repeat this declaration, and their abstracts explicitly name an **HRSC DT5 DTM** as the registration reference. Neither component declarations nor registration in local north/east/down coordinates specify a final sample sign or the `DeltaGeoid` equation. The F05 component preserves the invalid process-date literal `20198020`; that metadata defect does not justify correcting any vertical field by inference.
- The only actual history object in the full TRN inventory belongs to a **HiRISE orthoimage**, not this CTX DEM. It records `gdal_translate` with GDAL 3.1.0 on 7 July 2020, converting a HiRISE TIFF to a label. It contains no CTX height processing and cannot fill the gap.

## Primary processing publications and public code

The [Fergason et al. 2019 production abstract, 7047](https://www.hou.usra.edu/meetings/planetdata2019/pdf/7047.pdf), saved as `trn-processing-2019.pdf`, describes SOCET SET extraction, translation-only `pc_align`, HRSC alignment and `dem_mosaic`. It reports a 183.3 m vertical alignment adjustment. It does not name a final geoid grid, supply the adjustment's signed height equation, or identify the final archived TIFF by a checksum. The existing 2020 production abstract remains relevant background; it does not supply the missing equation either.

The [Kirk et al. 2021 paper](https://www.mdpi.com/2072-4292/13/17/3511), *Evaluating Stereo Digital Terrain Model Quality at Mars Rover Landing Sites with HRSC, CTX, and HiRISE Images*, **Remote Sensing 13(17), 3511**, names the exact CTX public product in its data-availability statement on **PDF page 38 of 41**. Section **2.2.2**, **PDF page 7 of 41**, states:

> an east–west tilt of ~0.09° exists between the Level 5 DTM and the other products.

The authors considered broader MOLA-controlled HRSC probably correct, but adjusted HRSC to match the other products for their study. This is a reported inter-product tilt, **not a measured correction for the REDLINE crop, an exact CTX correction field, a local uncertainty bound or a provider erratum**. The paper focuses on dispersion rather than absolute offsets and does not recover the missing final vertical equation. Its native PDF, text extraction and publisher paragraph cross-check are preserved.

The [Cheng, Ansar and Johnson 2021 LVS paper](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2020EA001560), DOI **10.1029/2020EA001560**, distinguishes the **flight** map: Table 1 specifies a **12 m orthographic elevation map** with heights perpendicular to a local tangent plane. Section 3.4 describes the 183.3 m HRSC alignment and an unexplained systematic offset near 190 m. Its references identify a USGS final-delivery report dated **8 July 2019**, without a public document URL. None of these statements gives the conversion for the separate public **20 m equirectangular TIFF**. Normal publisher HTML and Crossref-linked full-XML requests returned **403**; publisher-extracted passages retrieved by the web tool are saved separately and explicitly labelled as tool output, not native HTTP bodies. Crossref metadata was accessible.

A public [TRN registration repository](https://github.com/acpaquette/mars2020_trn/tree/789a4546f3f434904a2e094b1f9080b05ef703c5) was found and pinned at commit `789a4546f3f434904a2e094b1f9080b05ef703c5`. The untruncated tree contains two notebooks and a brief readme; the 32 returned commits end on **29 August 2018**. The notebooks concern conversion and registration testing, reference earlier V6 CTX components and contain no exact final-product contract or `DeltaGeoid` operation. They were read as data, never executed. The upstream USGS TRN and SOCET SET repository URLs currently return **404**. This historical code is not evidence of the exact 2019 final execution.

Searches were bounded to exact identifiers, `DeltaGeoid`, DOI revisions/corrections, cited processing papers, the final-delivery title and relevant public repositories. The findings describe the audited public sources, not an exhaustive proof that a document exists nowhere. One initially fetched guessed 2019 conference URL was actually an **InSight workspace-mosaic** abstract; `trn-flight-2019.pdf` and its text are preserved as excluded search evidence. The Copernicus/DLR 2021 PDFs extracted with broken font encoding; the readable MDPI publication and publisher text supply the reported tilt evidence.

## What still has to be established

1. The exact TIFF's final sample equation: does a sample represent positive-up height above the IAU sphere, a named areoid, another reference, or a quantity requiring further transformation?
2. If an areoid/geoid operation was applied: exact model identity, grid/version/checksum, interpolation method, sign and order relative to alignment and mosaicking. `GEOID=mola` on earlier inputs does not determine these facts.
3. The signed/order-specific final `DeltaGeoid` and 183.3 m operations, and the transformation connecting the public 20 m equirectangular asset to any 12 m orthographic flight product.
4. Any public correction notice, local tilt correction, source-support/fill mask, matching-quality mask or valid local uncertainty assessment for this exact product.

The companion [native-support audit](../comparison/audit.json) compares 10,201 wholly covered HRSC footprints under an explicit support model. Its CTX-minus-DA5 range is −68.6756 to +29.2513 m; CTX-minus-`(DT5−190 m)` is +1618.4631 to +1710.2513 m. These are diagnostic model differences, not datum identification or CTX accuracy bounds. They reinforce why the missing contract cannot be replaced by similarity. This lane performed no new elevation comparisons.

## Concrete paths that can progress independently

- **Recover the final delivery record.** An [unsent clarification draft](unsent-provider-clarification.md) asks the current official FGDC product contact for the exact equation, final model/grid/sign/order, any correction and released support-quality information. It is a local file only; no producer was contacted.
- **Build a separate reference dataset while preserving CTX.** The paired HRSC DT5/DA5 numerical assets have independently explicit vertical definitions. The companion full native-window evidence provides an input for a separately versioned 50 m dataset with its own masks and support limits. It can support further measurement validation once registration and uncertainty gates pass; it does not resolve or overwrite the CTX reference. HRSC is a separate data contract, but shared CTX control lineage means it is not independent absolute ground truth.
- **Use genuinely independent radial control.** Obtain public MOLA PEDR points for the crop, retaining product/version, footprint, orbit/quality flags and published radial-height definition. Compare matching footprints after independently validating horizontal registration, using both candidate height equations as explicitly labelled hypotheses. This can reject interpretations and quantify residuals without changing CTX, but an empirical fit still must not be presented as the producer's missing final equation. No PEDR campaign was run in this lane.

## Reproduction and preservation checks

From the repository root:

```powershell
node docs/evidence/scientific-gate-resolution/vertical/collect-public-evidence.mjs --verify-saved
node docs/evidence/scientific-gate-resolution/vertical/analyze-public-evidence.mjs --verify-saved
node --check docs/evidence/scientific-gate-resolution/vertical/collect-public-evidence.mjs
node --check docs/evidence/scientific-gate-resolution/vertical/analyze-public-evidence.mjs
```

Saved verification checks **42 HTTP response bodies** by byte count and SHA-256, including 30 responses with status 200, five with 403 and seven with 404; status 200 alone is not treated as valid content. It also validates derived evidence hashes, untruncated inventory counts, original TIFF hash, and byte equality of both production terrain manifests and the cropped binary against checkpoint `e79448a`. The preserved grid still has 65,536 cells, 20 m native spacing, the same origin/crop and radius/projection. The first analysis run encountered an XML BOM parsing error; parsing now strips the BOM in memory only, leaving saved response bytes unchanged. All listed commands passed after that repair.

This lane changed only files in this `vertical/` evidence directory. Application lint/typecheck/tests/build and browser smoke tests belong to the combined milestone; this audit does not claim them. No application code, data transformations, routes, external messages or remote Git operations were changed or performed.
