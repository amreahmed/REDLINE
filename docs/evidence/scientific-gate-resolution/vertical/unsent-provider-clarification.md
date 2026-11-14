# Local unsent clarification draft

**Status: prepared for review only. Not sent.**

To: Robin L. Fergason, official product contact listed in the current FGDC (`rfergason@usgs.gov`). The contact is taken from the provider metadata; no current-mailbox or delivery assumption is made.

Subject: Final vertical equation and processing record for exact Mars 2020 CTX DTM P906QQT8

Dear Dr. Fergason,

We are checking the height contract of this publicly released product before making quantitative terrain measurements:

`JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif`

DOI: https://doi.org/10.5066/P906QQT8

Source: https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif

Bytes: 9,662,387. SHA-256: `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b`.

The current exact-product and USGS catalogue FGDCs declare metre heights referenced to the IAU sphere of radius 3,396,190 m. The input component FGDCs repeat this and name HRSC DT5 registration, whereas the downloaded component GeoTIFFs contain `GEOID=mola`. The final GeoTIFF has no explicit vertical key or final processing record.

A support-based diagnostic in a 256×256 native CTX crop compared 10,201 wholly covered original 50 m HRSC cells, with no changes to the CTX data. CTX footprint means minus HRSC DA5 heights range from −68.6756 to +29.2513 m (mean −10.3906 m), whereas CTX minus HRSC DT5 adjusted to the 3,396,190 m sphere (`DT5−190 m`) range from +1618.4631 to +1710.2513 m (mean +1676.6858 m). The explicit piecewise-constant support assumption, differing resolutions and shared control lineage prevent treating these differences as independent accuracy bounds or proof of a datum. We have not relabelled or corrected the product.

Could you point us to a public processing record or clarify these specific facts for the exact TIFF above?

1. What is the final sample equation and positive-up/down convention? In particular, is the final radius `3396190 m + z`, a named areoid radius plus `z`, or another transformation?
2. What exact `DeltaGeoid` operation was used, with which model/grid/version/checksum and sign? What was its order relative to the signed 183.3 m alignment and final mosaicking? Are the public 20 m equirectangular samples transformed differently from the flight 12 m orthographic tangent-plane product?
3. Is there a released correction or revised metadata, final-delivery record (the July 8, 2019 report cited by Cheng et al. 2021), local tilt correction, or source-support/fill/matching-quality mask for this exact asset? Kirk et al. 2021 (Remote Sensing 13, 3511, section 2.2.2, PDF page 7) reports a roughly 0.09° east–west inter-product tilt; we have not assumed a local correction from that study value.

If an updated public product exists, its exact URL, version and checksum would let us preserve the current asset while validating the new one separately.

Thank you.

---

The diagnostic values above are copied from the companion `comparison/audit.json`, not producer measurements. All source receipts and the distinction between flight and archived public products are documented in `findings.md`. This draft has not been entered into an email service, addressed externally, or sent.
