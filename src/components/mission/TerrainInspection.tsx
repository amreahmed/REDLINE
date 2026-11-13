import { useEffect, useRef, useState } from 'react'
import { loadTerrainWindows } from '../../features/terrain/loadTerrain'
import { summarizeWindow } from '../../features/terrain/sampling'
import type { TerrainWindows } from '../../features/terrain/types'
import type { ScienceTarget } from '../../features/mission/types'

const productUrl = 'https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic'
const metadataUrl = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.xml'

type LoadState = { phase: 'idle' | 'loading' } | { phase: 'ready'; data: TerrainWindows } | { phase: 'error'; message: string }

/** Independent numerical-source inspection; never a precisely registered feature measurement. */
export function TerrainInspection({ target }: { target?: ScienceTarget }) {
  const [state, setState] = useState<LoadState>({ phase: 'idle' })
  const controllerRef = useRef<AbortController | null>(null)
  useEffect(() => () => controllerRef.current?.abort(), [])

  const load = async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState({ phase: 'loading' })
    try {
      const data = await loadTerrainWindows(controller.signal)
      if (!controller.signal.aborted) setState({ phase: 'ready', data })
    } catch (error) {
      if (!controller.signal.aborted) setState({ phase: 'error', message: error instanceof Error ? error.message : 'Numerical terrain could not load.' })
    }
  }

  const window = state.phase === 'ready' && target ? state.data.windows.find((item) => item.id === target.id) : undefined
  const summary = window ? summarizeWindow(window) : undefined
  return (
    <section className="source-detail terrain-inspection" aria-labelledby="terrain-inspection-heading">
      <h3 id="terrain-inspection-heading">Numerical terrain inspection</h3>
      <p className="helper">Inspect numerical USGS CTX source windows separately from the displayed imagery.</p>
      {state.phase === 'idle' && <button className="grid-button" type="button" onClick={() => void load()}>Load numerical terrain</button>}
      {state.phase === 'loading' && <p className="source-state" role="status">Loading and checking native terrain windows…</p>}
      {state.phase === 'error' && <div><p className="source-warning" role="alert">{state.message}</p><button className="grid-button" type="button" onClick={() => void load()}>Retry numerical terrain</button></div>}
      {state.phase === 'ready' && <div className="terrain-result" role="status">
        <p className="source-state">Validated source windows loaded · archived data</p>
        {!target && <p className="helper">Inspect Jezero, Belva or Neretva to view its coordinate neighborhood.</p>}
        {target && !window && <p className="source-warning">No native terrain window is available for this reference.</p>}
        {window && summary && <>
          <h4>{target?.name} coordinate neighborhood</h4>
          <dl className="source-facts">
            <dt>Neighborhood around published coordinates</dt><dd>±0.005° longitude and latitude · includes intersecting native cells</dd>
            <dt>Native grid</dt><dd>20 m projected spacing · {summary.validCount.toLocaleString()} valid cells · {summary.missingCount.toLocaleString()} missing</dd>
            <dt>Native-cell source-value range</dt><dd>{summary.min === null || summary.max === null ? 'No valid numerical cells' : `${Math.floor(summary.min).toLocaleString()} to ${Math.ceil(summary.max).toLocaleString()} m (outward-rounded)`}</dd>
          </dl>
          <p className="helper">The neighborhood illustrates the scale of two-decimal coordinates. It is not an accuracy bound or an elevation measurement at the named feature.</p>
        </>}
      </div>}
      <p className="source-warning">Provider-declared IAU-sphere heights; the vertical reference is not independently validated. Feature-to-DEM and preliminary-imagery registration remain unverified. No slope, route or safety calculation is enabled.</p>
      <details className="source-metadata"><summary>Numerical source & metadata</summary>
        <p className="helper">A separate USGS CTX terrain model provides numerical cells. This is source inspection in its own coordinate frame; the displayed imagery remains visual context.</p>
        <div className="source-links"><a href={productUrl} target="_blank" rel="noreferrer">USGS numerical product</a><a href={metadataUrl} target="_blank" rel="noreferrer">Terrain metadata</a><a href="https://doi.org/10.5066/P906QQT8" target="_blank" rel="noreferrer">Dataset citation</a></div>
      </details>
      <p className="source-credit">Fergason, Galuszka, Hare, Mayer, Redding and Smith (2020) · USGS Astrogeology · NASA/MRO/CTX.</p>
    </section>
  )
}
