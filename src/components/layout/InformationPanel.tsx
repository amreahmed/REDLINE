import { Icon } from '../shared/Icon'
import { ADVERTISED_CRS, MARS_LAYERS, TREK_DOCUMENTATION } from '../../data/marsLayers'
import { layerStatusLabel } from '../../features/map/types'
import type { LayerStatuses, LayerVisibility } from '../../features/map/types'
import { MARS_GLOBE } from '../../data/marsGlobe'
import type { ExplorerSummary } from '../../features/explorer/types'
import type { ScienceTarget } from '../../features/mission/types'
import { FeatureDetails } from '../mission/FeatureDetails'
import { PlanningTerrainDetails } from '../mission/PlanningTerrainDetails'
import type { TerrainGrid } from '../../features/terrain/gridTypes'
import { TerrainInspection } from '../mission/TerrainInspection'
import { useEffect, useRef } from 'react'

export function InformationPanel({ explorer, visibility, statuses, target, inspectionSequence, planningGrid, onClose }: { explorer: ExplorerSummary; visibility: LayerVisibility; statuses: LayerStatuses; target?: ScienceTarget; inspectionSequence: number; planningGrid?: TerrainGrid; onClose: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (target && contentRef.current) contentRef.current.scrollTop = 0
  }, [target, inspectionSequence])
  return (
    <aside id="information-panel" className="panel sources-panel" aria-labelledby="information-heading">
      <div className="panel-heading drawer-heading">
        <div><h2 id="information-heading">Sources & status</h2><p>Understand the evidence</p></div>
        <button className="icon-button drawer-close" type="button" aria-label="Close sources and status" onClick={onClose}><Icon name="close" size={20} /></button>
      </div>
      <div className="sources-content" ref={contentRef}>
        <section className="validation-summary" aria-labelledby="validation-heading">
          <h3 id="validation-heading">Scientific validation pending</h3>
          <p className="helper">Named-feature registration and the elevation height reference need independent validation. Distance, slope, terrain costs and route comparison remain unavailable.</p>
        </section>
        {target && <FeatureDetails target={target} />}
        {planningGrid && <PlanningTerrainDetails grid={planningGrid} />}
        <TerrainInspection target={target} />
        <section className="source-detail source-overview" aria-labelledby="globe-source-heading">
          <h3 id="globe-source-heading">NASA visual Mars overview</h3>
          <p className="source-mission">NASA / JPL-Caltech visual model</p>
          <p className="source-state" role="status">{explorer.globe.message}</p>
          <p className="source-warning">No geographic model orientation is validated. The guided map handoff does not transfer a surface location. Neither model geometry nor textures are numerical elevation.</p>
          <details className="source-metadata"><summary>Model details & source links</summary>
            <p className="helper">Official glTF model, {(MARS_GLOBE.inspectedBytes / 1_000_000).toFixed(2)} MB at inspection, with embedded color and normal textures. Display lighting is illustrative.</p>
            <dl className="source-facts"><dt>Coverage</dt><dd>Visual planet overview; geographic orientation unvalidated</dd><dt>Nominal resolution</dt><dd>Not established for quantitative use</dd></dl>
            <div className="source-links"><a href={MARS_GLOBE.sourceUrl} target="_blank" rel="noreferrer">NASA model</a><a href={MARS_GLOBE.usageUrl} target="_blank" rel="noreferrer">Usage guidance</a></div>
          </details>
          <p className="source-credit">Visual asset: {MARS_GLOBE.attribution}. REDLINE is not NASA-endorsed.</p>
        </section>
        <p className="sources-intro helper">MOLA context and Jezero CTX detail are image products from NASA Mars Trek. Acquisition dates are not established for these mosaics.</p>
        {MARS_LAYERS.map((layer) => {
          const status = statuses[layer.id]
          return (
            <section className="source-detail source-overview" key={layer.id} aria-labelledby={`${layer.id}-source-heading`}>
              <h3 id={`${layer.id}-source-heading`}>{layer.name}</h3>
              <p className="source-mission">{layer.mission}</p>
              <p className="source-state">{!visibility[layer.id] ? 'Hidden by you' : status.phase === 'checking' ? 'Checking service metadata' : status.phase === 'unavailable' ? 'Service unavailable' : !explorer.mapShown ? 'Selected for map exploration' : status.coverage === 'outside' ? 'Outside coverage' : layer.id !== 'mola' && !explorer.localDetail ? 'Waiting for local zoom' : layerStatusLabel(status, true)}</p>
              <dl className="source-facts">
                <dt>Nominal resolution</dt><dd>{layer.resolution}</dd>
                <dt>Coverage summary</dt><dd>{layer.description}</dd>
              </dl>
              {status.detail && <p className="source-warning">{status.detail}</p>}
              {status.missing > 0 && <p className="source-warning">The service reported missing tiles. Those areas contain no imagery from this layer.</p>}
              <p className="source-warning">{layer.id === 'mola' ? 'Rendered relief imagery, not numerical elevation.' : layer.id === 'ctx' ? 'Preliminary imagery. Fine registration and native latitude interpretation remain unverified.' : 'Rendered imagery, not elevation. Absolute landmark and named-feature registration remain unvalidated.'}</p>
              <details className="source-metadata"><summary>Metadata, limitations & source links</summary>
                <dl className="source-facts">
                <dt>Service coverage (degrees)</dt><dd>{layer.extent[0].toFixed(4)} to {layer.extent[2].toFixed(4)} longitude<br />{layer.extent[1].toFixed(4)} to {layer.extent[3].toFixed(4)} latitude</dd>
                <dt>Image requests since load / retry</dt><dd>{status.loaded} received · {status.pending} pending · {status.missing} missing · {status.failed} failed</dd>
                </dl>
                <p className="helper">{layer.limitation}</p>
                <div className="source-links"><a href={layer.sourceUrl} target="_blank" rel="noreferrer">Source</a><a href={layer.capabilitiesUrl} target="_blank" rel="noreferrer">WMTS metadata</a></div>
                <p className="source-id">{layer.productId}</p>
              </details>
              <p className="source-credit">{layer.attribution}</p>
            </section>
          )
        })}
        <details className="source-detail coordinate-detail">
          <summary>Coordinate reference</summary>
          <p className="helper">This map uses Trek’s shared angular image grid: longitude first, latitude second; degrees, with east-positive longitude. No Earth projection or physical scale calculation is used.</p>
          <p className="helper">Trek advertises inconsistent authority labels. All three layers use the same inspected angular origin and matrix geometry. Controlled CTX native planetocentric geometry agrees with the DEM source frame. Preliminary CTX latitude interpretation and fine image registration remain unresolved. Shared geometry does not certify absolute named-feature placement.</p>
          <p className="source-id">Advertised: {ADVERTISED_CRS}</p>
          <a href={TREK_DOCUMENTATION} target="_blank" rel="noreferrer">Trek service documentation</a>
        </details>
      </div>
      <div className="information-footer">
        <div className="flex items-center gap-2"><Icon name="info" size={16} /><span>Map imagery and numerical terrain are separate</span></div>
        <p>No slope, distance, hazard, or route calculations are made.</p>
      </div>
    </aside>
  )
}
