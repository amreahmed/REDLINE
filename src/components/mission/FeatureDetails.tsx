import type { ScienceTarget } from '../../features/mission/types'

export function FeatureDetails({ target }: { target: ScienceTarget }) {
  return (
    <section className="reference-detail" aria-labelledby="reference-details-heading">
      <span className="reference-provenance">Sourced feature reference</span>
      <h3 id="reference-details-heading">{target.name}</h3>
      <p className="context-qualification">Approximate published center · absolute feature-to-DEM registration unverified</p>
      <dl className="source-facts">
        <dt>Reference coordinates</dt><dd>{target.coordinate.lon.toFixed(2)}°E, {target.coordinate.lat.toFixed(2)}°N</dd>
        <dt>Mission context</dt><dd>{target.missionContext}</dd>
      </dl>
      <h4>Why explore this feature?</h4>
      <p className="helper">{target.scientificRationale}</p>
      <details className="source-metadata"><summary>Coordinates, limitations & source links</summary>
        <dl className="source-facts"><dt>Coordinate convention</dt><dd>Planetocentric latitude · positive-east longitude</dd><dt>Source control network</dt><dd>{target.controlNetwork} · center published to two decimal places</dd></dl>
        <div className="source-links"><a href={target.coordinateSourceUrl} target="_blank" rel="noreferrer">USGS / IAU coordinates</a><a href={target.scienceSourceUrl} target="_blank" rel="noreferrer">NASA science context</a></div>
        <ul className="reference-limitations">{target.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
      </details>
      <p className="source-credit">Coordinates: {target.coordinateAttribution}.</p>
      <p className="source-credit">Science context: {target.scienceAttribution}.</p>
    </section>
  )
}
