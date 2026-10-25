import { Icon } from '../shared/Icon'

export function InformationPanel() {
  return (
    <aside id="information-panel" className="panel info-panel" aria-labelledby="information-heading">
      <div className="panel-heading flex items-center gap-3">
        <Icon name="panel-right" />
        <h2 id="information-heading">Information</h2>
      </div>
      <div className="information-empty flex flex-col items-center text-center">
        <div className="empty-icon"><Icon name="pin" size={26} /></div>
        <h3>Nothing selected</h3>
        <p>Details will appear here when a map feature is selected.</p>
        <span className="empty-rule" />
        <p className="helper">No targets or observations are loaded in this preview.</p>
      </div>
      <div className="information-footer">
        <div className="flex items-center gap-2"><span className="status-dot" /><span>No sources connected</span></div>
        <p>Source details and limitations will accompany future map layers.</p>
      </div>
    </aside>
  )
}
