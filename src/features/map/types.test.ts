import { describe, expect, it } from 'vitest'
import { initialLayerStatus, layerStatusLabel, viewportMessage } from './types'
import type { LayerStatus } from './types'

const status = (overrides: Partial<LayerStatus> = {}): LayerStatus => ({ ...initialLayerStatus(), phase: 'available', ...overrides })
const both = { mola: true, ctx: true, controlledCtx: false }

describe('combined viewport absence states', () => {
  it('explains mixed unavailable and outside-coverage layers', () => {
    expect(viewportMessage(both, { mola: status({ phase: 'unavailable' }), controlledCtx: status(), ctx: status({ coverage: 'outside' }) })).toContain('No imagery is available')
  })
  it('explains initial image failures even when capabilities were valid', () => {
    expect(viewportMessage(both, { mola: status({ failed: 2 }), controlledCtx: status(), ctx: status({ missing: 1 }) })).toContain('No imagery was received')
  })
  it('does not obscure usable imagery when another layer fails', () => {
    expect(viewportMessage(both, { mola: status({ loaded: 1 }), controlledCtx: status(), ctx: status({ failed: 1 }) })).toBeNull()
  })
  it('keeps pending requests in the loading flow', () => {
    expect(viewportMessage(both, { mola: status({ pending: 1 }), controlledCtx: status(), ctx: status({ phase: 'unavailable' }) })).toBeNull()
  })
  it('includes controlled imagery in availability without enabling hidden alternatives', () => {
    const controlled = { mola: false, ctx: false, controlledCtx: true }
    const statuses = { mola: status({ loaded: 1 }), ctx: status({ loaded: 1 }), controlledCtx: status({ phase: 'unavailable' }) }
    expect(viewportMessage(controlled, statuses)).toContain('No imagery is available')
    statuses.controlledCtx = status({ loaded: 1 })
    expect(viewportMessage(controlled, statuses)).toBeNull()
    statuses.controlledCtx = status({ coverage: 'outside' })
    expect(viewportMessage(controlled, statuses)).toContain('outside')
  })
  it('explains hidden layers and outside coverage without inventing service failure', () => {
    const statuses = { mola: status(), controlledCtx: status(), ctx: status({ coverage: 'outside' }) }
    expect(viewportMessage({ mola: false, ctx: false, controlledCtx: false }, statuses)).toContain('Choose a layer')
    expect(viewportMessage({ mola: false, ctx: true, controlledCtx: false }, statuses)).toContain('outside')
  })
  it('labels request history without claiming complete current-view coverage', () => {
    expect(layerStatusLabel(status({ loaded: 10, failed: 1 }), true)).toBe('Tile requests failed')
    expect(layerStatusLabel(status({ loaded: 10, coverage: 'outside' }), true)).toBe('Outside coverage')
    expect(layerStatusLabel(status({ loaded: 10 }), false)).toBe('Hidden')
  })
})
