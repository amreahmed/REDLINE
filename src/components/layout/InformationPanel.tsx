import { Icon } from '../shared/Icon'
import { ADVERTISED_CRS, MARS_LAYERS, TREK_DOCUMENTATION } from '../../data/marsLayers'
import { layerStatusLabel } from '../../features/map/types'
import type { LayerStatuses, LayerVisibility } from '../../features/map/types'

export function InformationPanel({ visibility, statuses }: { visibility: LayerVisibility; statuses: LayerStatuses }) {
  return (
    <aside id="information-panel" className="panel sources-panel" aria-labelledby="information-heading">
      <div className="panel-heading flex items-center gap-3">
        <Icon name="panel-right" />
        <h2 id="information-heading">Sources & status</h2>
      </div>
      <div className="sources-content">
        <p className="sources-intro helper">Two image products, served by NASA Mars Trek. Acquisition dates are not established for these mosaics.</p>
        {MARS_LAYERS.map((layer) => {
          const status = statuses[layer.id]
          return (
            <details className="source-detail" key={layer.id} open>
              <summary>{layer.name}</summary>
              <p className="source-mission">{layer.mission}</p>
              <p className="source-state">{layerStatusLabel(status, visibility[layer.id])}</p>
              <dl>
                <dt>Resolution</dt><dd>{layer.resolution}</dd>
                <dt>Service coverage (degrees)</dt><dd>{layer.extent[0].toFixed(4)} to {layer.extent[2].toFixed(4)} longitude<br />{layer.extent[1].toFixed(4)} to {layer.extent[3].toFixed(4)} latitude</dd>
                <dt>Image requests since load / retry</dt><dd>{status.loaded} received · {status.pending} pending · {status.missing} missing · {status.failed} failed</dd>
              </dl>
              {status.detail && <p className="source-warning">{status.detail}</p>}
              {status.missing > 0 && <p className="source-warning">The service reported missing tiles. Those areas contain no imagery from this layer.</p>}
              <p className="helper">{layer.limitation}</p>
              <div className="source-links"><a href={layer.sourceUrl} target="_blank" rel="noreferrer">Source</a><a href={layer.capabilitiesUrl} target="_blank" rel="noreferrer">WMTS metadata</a></div>
              <p className="source-id">{layer.productId}</p>
              <p className="source-credit">{layer.attribution}</p>
            </details>
          )
        })}
        <details className="source-detail coordinate-detail">
          <summary>Coordinate reference</summary>
          <p className="helper">This map uses Trek’s shared angular image grid: longitude first, latitude second; degrees, with east-positive longitude. No Earth projection or physical scale calculation is used.</p>
          <p className="helper">Trek advertises inconsistent authority labels. Both layers use the same inspected origin and matrix geometry. This aligns the service grids; it does not validate fine image registration or the native CTX latitude convention.</p>
          <p className="source-id">Advertised: {ADVERTISED_CRS}</p>
          <a href={TREK_DOCUMENTATION} target="_blank" rel="noreferrer">Trek service documentation</a>
        </details>
      </div>
      <div className="information-footer">
        <div className="flex items-center gap-2"><Icon name="info" size={16} /><span>Images, not a numerical DEM</span></div>
        <p>No slope, distance, hazard, or route calculations are made.</p>
      </div>
    </aside>
  )
}
