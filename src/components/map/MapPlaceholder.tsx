import { Icon } from '../shared/Icon'

type MapPlaceholderProps = {
  showGrid: boolean
  onToggleGrid: () => void
}

export function MapPlaceholder({ showGrid, onToggleGrid }: MapPlaceholderProps) {
  return (
    <section id="map-workspace" className="map-viewport" aria-labelledby="map-heading" data-grid={showGrid} tabIndex={-1}>
      <div className="viewport-top flex items-center justify-between gap-3">
        <div className="viewport-label flex items-center gap-2"><Icon name="map" size={16} /><span>Regional map</span></div>
        <button className="grid-button flex items-center gap-2" type="button" aria-pressed={showGrid} aria-describedby="grid-description" onClick={onToggleGrid}>
          <Icon name="grid" size={16} /><span>Display grid</span>
        </button>
      </div>
      <div className="viewport-center flex flex-col items-center text-center">
        <div className="viewport-frame" aria-hidden="true">
          <i /><i /><i /><i />
          <div className="map-symbol"><Icon name="map" size={44} /></div>
        </div>
        <span className="placeholder-tag">Map placeholder</span>
        <h1 id="map-heading">Your regional<br />map workspace.</h1>
        <p>The regional map will appear here once<br className="desktop-break" /> a verified data layer is connected.</p>
        <div className="viewport-note flex items-center gap-2"><Icon name="info" size={15} /><span id="grid-description">Display grid only. No geographic data.</span></div>
      </div>
      <div className="viewport-bottom flex items-center justify-between gap-3">
        <span className="flex items-center gap-2"><span className="status-dot" />Awaiting map integration</span>
        <span>Step 1 / Foundation</span>
      </div>
    </section>
  )
}
