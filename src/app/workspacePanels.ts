export type MissionSection = 'explore' | 'layers' | 'plan'
export type WorkspacePanels = { panel: 'mission' | 'sources' | null; section: MissionSection }
export type PanelEvent = { type: 'mission'; section: MissionSection } | { type: 'sources' } | { type: 'close' }

export const initialWorkspacePanels: WorkspacePanels = { panel: null, section: 'explore' }

/** A single contextual drawer; changing views retains mounted mission/data state. */
export function workspacePanels(state: WorkspacePanels, event: PanelEvent): WorkspacePanels {
  if (event.type === 'close') return { ...state, panel: null }
  if (event.type === 'sources') return { ...state, panel: state.panel === 'sources' ? null : 'sources' }
  return { panel: state.panel === 'mission' && state.section === event.section ? null : 'mission', section: event.section }
}
