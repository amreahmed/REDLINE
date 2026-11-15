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
import { ScientificValidation } from '../mission/ScientificValidation'
import { LAYER_QUALIFICATIONS } from '../shared/scientificCopy'
import type { GlobeWorkspace } from '../../features/globe/explorationTypes'
import type { MarsPoi } from '../../data/marsPois'
import { GlobeImageryDetails, GlobePoiDetails } from '../explorer/GlobeSourceDetails'

export function InformationPanel({ explorer, visibility, statuses, target, inspectionSequence, scienceRequest = 0, planningGrid, onClose, globeWorkspace, globePoi, onFlyGlobePoi }: { explorer: ExplorerSummary; visibility: LayerVisibility; statuses: LayerStatuses; target?: ScienceTarget; inspectionSequence: number; scienceRequest?: number; planningGrid?: TerrainGrid; onClose: () => void; globeWorkspace?: GlobeWorkspace; globePoi?: MarsPoi; onFlyGlobePoi?: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (target && contentRef.current) contentRef.current.scrollTop = 0
  }, [target, inspectionSequence])
  useEffect(() => { if (globePoi && contentRef.current) { contentRef.current.scrollTop = 0; contentRef.current.querySelector<HTMLElement>('#globe-poi-detail-heading')?.focus({ preventScroll: true }) } }, [globePoi])
  useEffect(() => {
    if (scienceRequest && contentRef.current) {
      contentRef.current.scrollTop = 0
      contentRef.current.querySelector<HTMLElement>('#validation-heading')?.focus({ preventScroll: true })
    }
  }, [scienceRequest])
  return (
    <aside id="information-panel" className="panel sources-panel" aria-labelledby="information-heading">
      <div className="panel-heading drawer-heading">
        <div><h2 id="information-heading">Sources & status</h2><p>Understand the evidence</p></div>
        <button className="icon-button drawer-close" type="button" aria-label="Close sources and status" onClick={onClose}><Icon name="close" size={20} /></button>
      </div>
      <div className="sources-content" ref={contentRef}>
        {globePoi && <GlobePoiDetails poi={globePoi} onFly={() => onFlyGlobePoi?.()} canFly={globeWorkspace?.preferences.mode === 'imagery'} />}
        <ScientificValidation />
        {globeWorkspace && <GlobeImageryDetails workspace={globeWorkspace} />}
        {target && <FeatureDetails target={target} />}
        {planningGrid && <PlanningTerrainDetails grid={planningGrid} />}
        <TerrainInspection target={target} />
        <section className="source-detail source-overview" aria-labelledby="globe-source-heading">
          <h3 id="globe-source-heading">NASA visual Mars overview</h3>
          <p className="source-mission">NASA / JPL-Caltech visual model</p>
          <p className="source-state" role="status">{!globeWorkspace || globeWorkspace.preferences.mode === 'model' ? explorer.globe.message : 'Original NASA GLB retained as a separate visual mode in Layers.'}</p>
          <p className="context-qualification">Visual model · scientific orientation unverified</p>
          <details className="source-metadata"><summary>Model details & source links</summary>
            <p className="helper">Official glTF model, {(MARS_GLOBE.inspectedBytes / 1_000_000).toFixed(2)} MB at inspection, with embedded color and normal textures. Display lighting is illustrative.</p>
            <p className="helper">No geographic model orientation is validated. The approach is scripted and the guided map handoff does not transfer a surface location. Jezero opens at the published approximate crater center, not a precise science target. Neither model geometry nor textures are numerical elevation or evidence of slopes or safe routes.</p>
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
              <p className="source-id source-product-identity">{layer.productId}</p>
              <p className="source-state">{!visibility[layer.id] ? 'Hidden by you' : status.phase === 'checking' ? 'Checking service metadata' : status.phase === 'unavailable' ? 'Service unavailable' : !explorer.mapShown ? 'Selected for map exploration' : status.coverage === 'outside' ? 'Outside coverage' : layer.id !== 'mola' && !explorer.localDetail ? 'Waiting for local zoom' : layerStatusLabel(status, true)}</p>
              <dl className="source-facts">
                <dt>Nominal resolution</dt><dd>{layer.resolution}</dd>
                <dt>Coverage summary</dt><dd>{layer.description}</dd>
              </dl>
              {status.detail && <p className="source-warning">{status.detail}</p>}
              {status.missing > 0 && <p className="source-warning">The service reported missing tiles. Those areas contain no imagery from this layer.</p>}
              <p className="context-qualification">{LAYER_QUALIFICATIONS[layer.id]}</p>
              <details className="source-metadata"><summary>Metadata, limitations & source links</summary>
                <dl className="source-facts">
                <dt>Service coverage (degrees)</dt><dd>{layer.extent[0].toFixed(4)} to {layer.extent[2].toFixed(4)} longitude<br />{layer.extent[1].toFixed(4)} to {layer.extent[3].toFixed(4)} latitude</dd>
                <dt>Image requests since load / retry</dt><dd>{status.loaded} received · {status.pending} pending · {status.missing} missing · {status.failed} failed</dd>
                </dl>
                <p className="helper">{layer.limitation}</p>
                <div className="source-links"><a href={layer.sourceUrl} target="_blank" rel="noreferrer">Source</a><a href={layer.capabilitiesUrl} target="_blank" rel="noreferrer">WMTS metadata</a></div>
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
      </div>
    </aside>
  )
}
