import { globeLayerById } from '../../data/globeLayers'
import type { MarsPoi } from '../../data/marsPois'
import type { GlobeWorkspace } from '../../features/globe/explorationTypes'

export function GlobePoiDetails({ poi, onFly, canFly }: { poi: MarsPoi; onFly: () => void; canFly: boolean }) {
  return <section className="reference-detail globe-poi-detail" aria-labelledby="globe-poi-detail-heading">
    <span className="reference-provenance">Sourced planetary location</span>
    <h3 id="globe-poi-detail-heading" tabIndex={-1}>{poi.name}</h3>
    <p className="helper">{poi.description}</p>
    <dl className="source-facts"><dt>Category / mission</dt><dd>{poi.category}{poi.mission ? ` / ${poi.mission}` : ''}</dd><dt>Published longitude / latitude</dt><dd>{poi.longitude}°E / {poi.latitude}°{poi.latitude < 0 ? '(south)' : '(north)'}</dd>{poi.eventDate && <><dt>Published event date</dt><dd>{poi.eventDate}</dd></>}<dt>Coordinate reference</dt><dd>{poi.coordinateReference}</dd><dt>Coordinate accuracy</dt><dd>{poi.coordinateAccuracy}</dd><dt>Evidence confidence</dt><dd>{poi.confidence}</dd></dl>
    <p className="context-qualification">Navigation reference only. Display alignment does not establish absolute feature-to-DEM registration or a route endpoint.</p>
    <button type="button" className="grid-button" disabled={!canFly} onClick={onFly}>Fly to {poi.name}</button>
    <div className="source-links"><a href={poi.sourceUrl} target="_blank" rel="noreferrer">{poi.sourceName}</a>{poi.references?.map(reference => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">{reference.name}</a>)}</div>
  </section>
}

export function GlobeImageryDetails({ workspace }: { workspace: GlobeWorkspace }) {
  const layer = globeLayerById(workspace.preferences.layerId)
  if (workspace.preferences.mode === 'model') return null
  return <section className="source-detail globe-imagery-detail" aria-labelledby="globe-imagery-source-heading">
    <h3 id="globe-imagery-source-heading">{layer.name}</h3>
    <p className="source-mission">{layer.source}</p>
    <p className="context-qualification">{layer.registrationStatus === 'uncontrolled' ? 'Uncontrolled global imagery · absolute registration unverified' : 'Declared source-grid alignment · independent absolute accuracy unverified'}</p>
    <dl className="source-facts"><dt>Nominal source / display resolution</dt><dd>{layer.resolution}</dd><dt>Advertised service footprint</dt><dd>{layer.coverage[0]} to {layer.coverage[2]}°E; {layer.coverage[1]} to {layer.coverage[3]}° latitude</dd></dl>
    <details className="source-metadata"><summary>Globe coordinates, tiles & limitations</summary>
      <p className="helper">{layer.projection}</p><p className="helper">{layer.limitations}</p><p className="helper">Tiles are rendered on an undisplaced graphics sphere. Imagery is not numerical elevation. North is +Y; 0° longitude is +Z; 90° east is +X. This tests display-coordinate consistency, not surveyed registration.</p>
      <p className="helper">Stars, Sun lighting and atmospheric rim are procedural visual effects. They do not represent measured sky positions, a current solar ephemeris or atmospheric observations.</p>
      <p className="helper">Same-source parent tiles remain while detail loads. Resampling and screen zoom do not increase native source resolution. Transparent pixels and missing tiles remain data gaps; another dataset is never silently substituted.</p>
      <dl className="source-facts"><dt>Tile size / matrices</dt><dd>{layer.tileSource.tileSize} px; levels {layer.minZoom}–{layer.maxZoom}</dd><dt>NoData / missing imagery</dt><dd>{layer.noData}</dd><dt>Service / tile identity</dt><dd className="source-id">{layer.tileSource.template}</dd></dl>
      <div className="source-links"><a href={layer.sourceUrl} target="_blank" rel="noreferrer">Dataset source</a><a href={layer.capabilitiesUrl} target="_blank" rel="noreferrer">Service metadata</a></div>
    </details>
    <p className="source-credit">{layer.attribution}</p>
  </section>
}
