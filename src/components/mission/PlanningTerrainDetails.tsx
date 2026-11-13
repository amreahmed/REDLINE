import type { TerrainGrid } from '../../features/terrain/gridTypes'
import { terrainGridBounds } from '../../features/terrain/terrainGrid'

export function PlanningTerrainDetails({ grid }: { grid: TerrainGrid }) {
  const bounds = terrainGridBounds(grid)
  return <section className="source-detail terrain-inspection planning-terrain-summary" aria-labelledby="planning-terrain-source-heading">
    <h3 id="planning-terrain-source-heading">Planning terrain source</h3>
    <p className="source-state">Verified native crop · archived USGS numerical data</p>
    <div className="terrain-support"><strong>{grid.manifest.summary.validCount.toLocaleString()}</strong><span>valid native terrain cells</span><span>{grid.manifest.summary.missingCount.toLocaleString()} missing in this crop</span></div>
    <dl className="source-facts"><dt>Source mission / instrument</dt><dd>Mars Reconnaissance Orbiter / CTX; USGS numerical terrain</dd><dt>Nominal spacing</dt><dd>20 m projected native grid</dd><dt>Coverage</dt><dd>256 × 256 cells in a prototype Belva-area crop</dd></dl>
    <p className="helper">The outlined region is a prototype-selected crop. Grid markers show native cell centers; no named-site accuracy or safety is inferred.</p>
    <p className="source-warning">Controlled imagery and DEM share documented source geometry and photogrammetric lineage. Absolute landmark accuracy and MDIM 2.1 feature registration are not independently validated. Provider-declared IAU-sphere heights retain an unvalidated vertical reference.</p>
    <details className="source-metadata"><summary>Native crop & source links</summary>
      <dl className="source-facts"><dt>Native crop</dt><dd>Rows 586–841, columns 522–777 · 256 × 256 cells · 20 m projected spacing</dd><dt>Source-frame bounds</dt><dd>{bounds[0].toFixed(6)} to {bounds[2].toFixed(6)}°E<br />{bounds[1].toFixed(6)} to {bounds[3].toFixed(6)}°N</dd></dl>
      <div className="source-links"><a href="https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic" target="_blank" rel="noreferrer">USGS planning DEM</a><a href="https://doi.org/10.5066/P906QQT8" target="_blank" rel="noreferrer">DEM citation</a></div>
    </details>
    <p className="source-credit">Fergason, Galuszka, Hare, Mayer, Redding and Smith (2020) · USGS Astrogeology · NASA/MRO/CTX. Values come from numerical float32 cells, independent of image colors.</p>
  </section>
}
