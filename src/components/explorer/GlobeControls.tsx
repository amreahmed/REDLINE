import { useState } from 'react'
import { GLOBE_LAYERS, globeLayerById } from '../../data/globeLayers'
import type { GlobeLayerId } from '../../data/globeLayers'
import { MARS_POIS } from '../../data/marsPois'
import type { MarsPoi } from '../../data/marsPois'
import type { GlobeMode, GlobeWorkspace, PoiCategory } from '../../features/globe/explorationTypes'
import { imageryStatusText } from '../../features/globe/imageryStatus'

export function GlobeLayerControls({ workspace, onSelect, onRetry }: { workspace: GlobeWorkspace; onSelect: (mode: GlobeMode, id: GlobeLayerId) => void; onRetry: () => void }) {
  const { preferences, view } = workspace
  const layer = globeLayerById(preferences.layerId)
  const imagery = workspace.mapImagery ?? view?.imagery
  const isGlobal = (coverage: readonly number[]) => coverage[0] <= -179 && coverage[2] >= 179 && coverage[1] <= -89 && coverage[3] >= 89
  const globalSources = GLOBE_LAYERS.filter(source => isGlobal(source.coverage))
  const regionalSources = GLOBE_LAYERS.filter(source => !isGlobal(source.coverage))
  return <section className="panel-section globe-layer-controls" aria-labelledby="globe-layer-heading">
    <h3 id="globe-layer-heading">Planet surface</h3>
    <label className="field-label" htmlFor="globe-surface-source">Globe imagery source</label>
    <select id="globe-surface-source" value={preferences.mode === 'model' ? 'model' : preferences.layerId} onChange={event => event.target.value === 'model' ? onSelect('model', preferences.layerId) : onSelect('imagery', event.target.value as GlobeLayerId)}>
      <optgroup label="Global planet basemaps">
        {globalSources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
      </optgroup>
      <optgroup label="Regional Jezero coverage (local footprint only)">
        {regionalSources.map(source => <option key={source.id} value={source.id}>{source.name} (Jezero only)</option>)}
      </optgroup>
      <optgroup label="Visual 3D model">
        <option value="model">NASA visual 3D model</option>
      </optgroup>
    </select>
    {preferences.mode === 'model' ? <p className="context-qualification">Original NASA GLB · geographic orientation unverified. Geographic markers are available in imagery mode.</p> : <>
      <p className="source-mission">{layer.source}</p>
      <p className="helper">{layer.resolution}</p>
      <p className="context-qualification">{layer.registrationStatus === 'uncontrolled' ? 'Uncontrolled imagery · absolute registration unverified' : layer.registrationStatus === 'source-controlled' ? 'Source-controlled imagery · absolute landmark accuracy unverified' : 'Source coordinates · registration unverified'}</p>
      {imagery && <p className={imagery.phase === 'error' || imagery.phase === 'outside' || imagery.failed || imagery.missing ? 'source-warning' : 'source-state'} role="status">{imageryStatusText(imagery, workspace.mapImagery ? undefined : view?.level)}</p>}
      <button className="grid-button" type="button" onClick={onRetry}>Retry selected imagery</button>
      <p className="helper">Source changes preserve the camera location. Outside-footprint areas remain without this imagery.</p>
    </>}
  </section>
}

export function GlobeLocationControls({ workspace, onCategory, onInspect, onFly }: { workspace: GlobeWorkspace; onCategory: (category: PoiCategory) => void; onInspect: (id: string) => void; onFly: (poi: MarsPoi) => void }) {
  const [query, setQuery] = useState('')
  const matches = MARS_POIS.filter(poi => (workspace.preferences.category === 'all' || poi.category === workspace.preferences.category) && `${poi.name} ${poi.mission ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <section className="panel-section globe-location-controls" aria-labelledby="globe-locations-heading">
    <h3 id="globe-locations-heading">Explore Mars locations</h3>
    <p className="helper">Sourced navigation references. Published precision and uncertainty are shown with each location.</p>
    <label className="field-label" htmlFor="globe-location-search">Search missions and landmarks</label>
    <input id="globe-location-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Jezero, Viking, Olympus…" />
    <label className="field-label" htmlFor="globe-poi-category">Location category</label>
    <select id="globe-poi-category" value={workspace.preferences.category} onChange={event => onCategory(event.target.value as PoiCategory)}>
      <option value="all">All locations</option><option value="mission">Missions</option><option value="landmark">Landmarks</option><option value="science">Science references</option><option value="impact">Confirmed impact references</option>
    </select>
    <div className="globe-location-list">
      {matches.map(poi => <div className="globe-location-row" key={poi.id}>
        <button className="reference-button" type="button" aria-pressed={workspace.preferences.selectedPoiId === poi.id} onClick={() => onInspect(poi.id)}>
          <span className="reference-info">
            <span className="reference-name">{poi.name}</span>
            <span className="reference-coordinate">{poi.mission ?? poi.category} · sourced reference</span>
          </span>
          <span className="reference-open">Details</span>
        </button>
        <div className="globe-location-actions">
          <button className="grid-button location-fly-button" type="button" disabled={workspace.preferences.mode === 'model'} aria-label={`Fly to ${poi.name}`} onClick={() => onFly(poi)}>Fly to</button>
        </div>
      </div>)}
      {!matches.length && <p className="helper" role="status">No sourced locations match this search and category.</p>}
    </div>
    {workspace.preferences.mode === 'model' && <p className="helper">Select a coordinate-based imagery source in Layers to fly to these locations.</p>}
  </section>
}
