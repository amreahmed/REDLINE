import { describe, expect, it } from 'vitest'
import { initialLayerStatus, layerStatusLabel, viewportMessage } from './types'
import type { LayerStatus } from './types'

const status = (overrides: Partial<LayerStatus> = {}): LayerStatus => ({ ...initialLayerStatus(), phase: 'available', ...overrides })
const both = { mola: true, ctx: true }

describe('combined viewport absence states', () => {
  it('explains mixed unavailable and outside-coverage layers', () => {
    expect(viewportMessage(both, { mola: status({ phase: 'unavailable' }), ctx: status({ coverage: 'outside' }) })).toContain('No imagery is available')
  })
  it('explains initial image failures even when capabilities were valid', () => {
    expect(viewportMessage(both, { mola: status({ failed: 2 }), ctx: status({ missing: 1 }) })).toContain('No imagery was received')
  })
  it('does not obscure usable imagery when another layer fails', () => {
    expect(viewportMessage(both, { mola: status({ loaded: 1 }), ctx: status({ failed: 1 }) })).toBeNull()
  })
  it('keeps pending requests in the loading flow', () => {
    expect(viewportMessage(both, { mola: status({ pending: 1 }), ctx: status({ phase: 'unavailable' }) })).toBeNull()
  })
  it('explains hidden layers and outside coverage without inventing service failure', () => {
    const statuses = { mola: status(), ctx: status({ coverage: 'outside' }) }
    expect(viewportMessage({ mola: false, ctx: false }, statuses)).toContain('Choose a layer')
    expect(viewportMessage({ mola: false, ctx: true }, statuses)).toContain('outside')
  })
  it('labels request history without claiming complete current-view coverage', () => {
    expect(layerStatusLabel(status({ loaded: 10, failed: 1 }), true)).toBe('Tile requests failed')
    expect(layerStatusLabel(status({ loaded: 10, coverage: 'outside' }), true)).toBe('Outside coverage')
    expect(layerStatusLabel(status({ loaded: 10 }), false)).toBe('Hidden')
  })
})
