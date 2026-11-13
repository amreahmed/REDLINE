import { describe, expect, it } from 'vitest'
import { initialWorkspacePanels, workspacePanels } from './workspacePanels'

describe('contextual workspace drawers', () => {
  it('opens with an unobstructed explorer', () => expect(initialWorkspacePanels.panel).toBeNull())
  it('opens the requested mission section', () => expect(workspacePanels(initialWorkspacePanels, { type: 'mission', section: 'plan' })).toEqual({ panel: 'mission', section: 'plan' }))
  it('closes the active navigation entry on a second activation', () => expect(workspacePanels({ panel: 'mission', section: 'layers' }, { type: 'mission', section: 'layers' }).panel).toBeNull())
  it('switches mission sections without closing the drawer', () => expect(workspacePanels({ panel: 'mission', section: 'explore' }, { type: 'mission', section: 'layers' })).toEqual({ panel: 'mission', section: 'layers' }))
  it('replaces mission with sources and retains the mission section', () => expect(workspacePanels({ panel: 'mission', section: 'plan' }, { type: 'sources' })).toEqual({ panel: 'sources', section: 'plan' }))
  it('replaces sources with the requested mission section', () => expect(workspacePanels({ panel: 'sources', section: 'plan' }, { type: 'mission', section: 'layers' })).toEqual({ panel: 'mission', section: 'layers' }))
  it('closes sources on a second activation', () => expect(workspacePanels({ panel: 'sources', section: 'plan' }, { type: 'sources' })).toEqual({ panel: null, section: 'plan' }))
  it('retains mission section when dismissed', () => expect(workspacePanels({ panel: 'mission', section: 'plan' }, { type: 'close' })).toEqual({ panel: null, section: 'plan' }))
})
