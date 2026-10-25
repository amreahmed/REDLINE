import { Icon } from '../shared/Icon'

const layers = [
  { name: 'Base imagery', description: 'Regional surface context' },
  { name: 'Terrain context', description: 'Relief and topography' },
  { name: 'Science targets', description: 'Sourced points of interest' },
]

export function MissionControl() {
  return (
    <aside id="mission-control" className="panel mission-sidebar" aria-labelledby="mission-heading">
      <div className="panel-heading flex items-center gap-3">
        <Icon name="panel-left" />
        <h2 id="mission-heading">Mission control</h2>
      </div>
      <section className="panel-section" aria-labelledby="region-heading">
        <div className="section-title flex items-center justify-between">
          <h3 id="region-heading">Study region</h3>
          <Icon name="pin" />
        </div>
        <label className="field-label" htmlFor="region">Active region</label>
        <select id="region" disabled aria-describedby="region-note" defaultValue="">
          <option value="">No region connected</option>
        </select>
        <p id="region-note" className="helper">Region selection becomes available with the first verified map layer.</p>
      </section>
      <section className="panel-section" aria-labelledby="layers-heading">
        <div className="section-title flex items-center justify-between">
          <h3 id="layers-heading">Map layers</h3>
          <Icon name="layers" />
        </div>
        <p id="layers-note" className="helper mb-4">No data layers are connected in this preview.</p>
        <div className="layer-list">
          {layers.map((layer) => (
            <label key={layer.name} className="layer-row flex items-start gap-3">
              <input type="checkbox" disabled aria-describedby="layers-note" />
              <span>
                <span className="layer-name">{layer.name}</span>
                <span className="layer-description">{layer.description}</span>
              </span>
              <Icon name="lock" size={14} className="ml-auto shrink-0" />
            </label>
          ))}
        </div>
      </section>
      <section className="panel-section mission-empty" aria-labelledby="planning-heading">
        <h3 id="planning-heading">Mission planning</h3>
        <div className="planning-path flex items-center gap-2" aria-hidden="true">
          <span className="path-origin" /><span className="path-line" /><Icon name="pin" size={16} />
        </div>
        <p className="helper">Origin, destination, and route tools will be available after map and terrain validation.</p>
      </section>
      <div className="sidebar-footnote flex items-start gap-2">
        <Icon name="info" size={16} className="shrink-0" />
        <p>This preview establishes the workspace. Scientific data comes in a later step.</p>
      </div>
    </aside>
  )
}
