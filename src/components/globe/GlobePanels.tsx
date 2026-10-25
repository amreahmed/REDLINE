import { MARS_GLOBE } from '../../data/marsGlobe'
import { Icon } from '../shared/Icon'

export function GlobeMissionControl({ onOpenJezero }: { onOpenJezero: () => void }) {
  return (
    <aside id="mission-control" className="panel mission-sidebar" aria-labelledby="globe-mission-heading">
      <div className="panel-heading flex items-center gap-3"><Icon name="panel-left" /><h2 id="globe-mission-heading">Mission control</h2></div>
      <section className="panel-section">
        <div className="section-title"><h3>Planet overview</h3></div>
        <p className="region-name">Mars</p>
        <p className="helper">Explore NASA’s textured visual model, then return to the regional imagery workspace.</p>
      </section>
      <section className="panel-section globe-region">
        <div className="section-title flex items-center justify-between"><h3>Regional workspace</h3><Icon name="pin" /></div>
        <p className="region-name">Jezero</p>
        <p className="helper">Open the existing CTX and MOLA map at the Jezero mosaic coverage.</p>
        <button className="open-region-button" type="button" onClick={onOpenJezero}>Open Jezero regional map</button>
        <p className="helper">This shortcut is a navigation aid. It does not select a precise location on the globe.</p>
      </section>
      <div className="sidebar-footnote flex items-start gap-2"><Icon name="info" size={16} className="shrink-0" /><p>The regional map keeps its layer settings. The view switch also preserves its map position.</p></div>
    </aside>
  )
}

export function GlobeInformationPanel() {
  return (
    <aside id="information-panel" className="panel sources-panel" aria-labelledby="globe-information-heading">
      <div className="panel-heading flex items-center gap-3"><Icon name="panel-right" /><h2 id="globe-information-heading">Sources & status</h2></div>
      <div className="sources-content">
        <p className="sources-intro helper">Official NASA visual asset. Download and rendering status appear in the globe viewport.</p>
        <details className="source-detail" open>
          <summary>{MARS_GLOBE.name}</summary>
          <p className="source-mission">{MARS_GLOBE.attribution}</p>
          <dl><dt>Asset</dt><dd>glTF 2 binary with embedded color and normal textures.</dd><dt>Inspected download size</dt><dd>{(MARS_GLOBE.inspectedBytes / 1_000_000).toFixed(2)} MB</dd><dt>Use</dt><dd>Visual orientation. Native model units and geographic alignment are not validated for measurements.</dd></dl>
          <div className="source-links"><a href={MARS_GLOBE.sourceUrl} target="_blank" rel="noreferrer">NASA model page</a><a href={MARS_GLOBE.assetUrl} target="_blank" rel="noreferrer">Official GLB</a><a href={MARS_GLOBE.usageUrl} target="_blank" rel="noreferrer">NASA usage guidance</a></div>
          <p className="source-credit">Credit: {MARS_GLOBE.attribution}. REDLINE is independent and is not NASA-endorsed.</p>
        </details>
        <details className="source-detail" open>
          <summary>Visualization limits</summary>
          <p className="helper">Lighting is for display, not a simulation of current sunlight. Model orientation, texture detail and surface relief must not be used to infer elevation, slopes or safe routes.</p>
          <p className="source-warning">No surface pin is shown: the model’s mapping to planetary coordinates has not been verified.</p>
        </details>
      </div>
      <div className="information-footer"><div className="flex items-center gap-2"><Icon name="info" size={16} /><span>Visual model, not a numerical DEM</span></div><p>No globe geometry enters terrain or route calculations.</p></div>
    </aside>
  )
}
