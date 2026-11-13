import { describe, expect, it } from 'vitest'
import { initialLayerStatus } from '../map/types'
import type { DetailLayerCoverage, LayerStatuses, LayerVisibility } from '../map/types'
import { contextCanOpenWithoutImagery, detailReadinessLayers, explorerLayerVisibility, explorerViewportMessage } from './layers'

const both: LayerVisibility = { mola: true, ctx: true, controlledCtx: false }
const coverage: DetailLayerCoverage = { ctx: 'inside', controlledCtx: 'inside' }
const statuses = (): LayerStatuses => ({ mola: initialLayerStatus(), ctx: initialLayerStatus(), controlledCtx: initialLayerStatus() })

describe('explorer image-layer presentation', () => {
  it('hides map layers in overview without changing the original enabled preferences', () => {
    expect(explorerLayerVisibility(both, false, true, coverage)).toEqual({ mola: false, ctx: false, controlledCtx: false })
    expect(both).toEqual({ mola: true, ctx: true, controlledCtx: false })
  })
  it('shows only selected broad context until local zoom', () => {
    expect(explorerLayerVisibility({ mola: true, ctx: true, controlledCtx: true }, true, false, coverage)).toEqual({ mola: true, ctx: false, controlledCtx: false })
  })
  it('retains both selected local detail products and clips their coverage independently', () => {
    const preferences = { mola: true, ctx: true, controlledCtx: true }
    expect(explorerLayerVisibility(preferences, true, true, coverage)).toEqual(preferences)
    expect(explorerLayerVisibility(preferences, true, true, { ctx: 'partial', controlledCtx: 'outside' })).toEqual({ mola: true, ctx: true, controlledCtx: false })
    expect(explorerLayerVisibility(preferences, true, true, { ctx: 'outside', controlledCtx: 'partial' })).toEqual({ mola: true, ctx: false, controlledCtx: true })
  })
  it('does not substitute an unselected preliminary or controlled source', () => {
    expect(explorerLayerVisibility({ mola: false, ctx: false, controlledCtx: true }, true, true, { ctx: 'inside', controlledCtx: 'outside' })).toEqual({ mola: false, ctx: false, controlledCtx: false })
    expect(explorerLayerVisibility({ mola: false, ctx: true, controlledCtx: false }, true, true, coverage)).toEqual({ mola: false, ctx: true, controlledCtx: false })
  })
  it('restores identical user choices through overview and broad-context transitions', () => {
    const preferences = Object.freeze({ mola: false, ctx: false, controlledCtx: true })
    expect(explorerLayerVisibility(preferences, true, true, coverage)).toEqual(preferences)
    expect(explorerLayerVisibility(preferences, false, true, coverage)).toEqual({ mola: false, ctx: false, controlledCtx: false })
    expect(explorerLayerVisibility(preferences, true, false, coverage)).toEqual({ mola: false, ctx: false, controlledCtx: false })
    expect(explorerLayerVisibility(preferences, true, true, coverage)).toEqual(preferences)
  })
  it('returns independent presentation state rather than exposing user preferences', () => {
    const presentation = explorerLayerVisibility(both, true, true, coverage)
    presentation.ctx = false
    expect(both.ctx).toBe(true)
  })
  it('retains empty presentation when all layers are deselected', () => {
    expect(explorerLayerVisibility({ mola: false, ctx: false, controlledCtx: false }, true, true, coverage)).toEqual({ mola: false, ctx: false, controlledCtx: false })
  })
  it('allows deliberately empty context but never calls selected in-coverage detail empty', () => {
    const controlled = { mola: false, ctx: false, controlledCtx: true }
    expect(contextCanOpenWithoutImagery(controlled, false, coverage)).toBe(true)
    expect(contextCanOpenWithoutImagery(controlled, true, coverage)).toBe(false)
    expect(contextCanOpenWithoutImagery(controlled, true, { ctx: 'inside', controlledCtx: 'outside' })).toBe(true)
    expect(contextCanOpenWithoutImagery({ mola: false, ctx: true, controlledCtx: true }, true, { ctx: 'inside', controlledCtx: 'outside' })).toBe(false)
    expect(contextCanOpenWithoutImagery({ mola: false, ctx: false, controlledCtx: false }, true, coverage)).toBe(true)
    expect(contextCanOpenWithoutImagery(both, false, coverage)).toBe(false)
  })
  it.each(['ctx', 'controlledCtx'] as const)('explains unavailable %s before advising zoom', (id) => {
    const state = statuses()
    state[id].phase = 'unavailable'
    const preferences = { mola: false, ctx: id === 'ctx', controlledCtx: id === 'controlledCtx' }
    expect(explorerViewportMessage(preferences, { mola: false, ctx: false, controlledCtx: false }, state, false)).toMatch(/selected CTX service is unavailable/)
  })
  it('does not report all selected imagery unavailable when preliminary remains usable', () => {
    const state = statuses()
    state.controlledCtx.phase = 'unavailable'
    state.ctx = { ...state.ctx, phase: 'available', loaded: 1 }
    const preferences = { mola: false, ctx: true, controlledCtx: true }
    expect(explorerViewportMessage(preferences, preferences, state, true)).toBeNull()
  })
  it('explains local-zoom and coverage states without promising broader imagery availability', () => {
    const state = statuses()
    const preferences = { mola: false, ctx: false, controlledCtx: true }
    expect(explorerViewportMessage(preferences, { mola: false, ctx: false, controlledCtx: false }, state, false)).toMatch(/local zoom/)
    state.controlledCtx.coverage = 'outside'
    expect(explorerViewportMessage(preferences, { mola: false, ctx: false, controlledCtx: false }, state, true)).toMatch(/request broader context/)
    expect(explorerViewportMessage({ mola: false, ctx: false, controlledCtx: false }, { mola: false, ctx: false, controlledCtx: false }, state, true)).toMatch(/Choose a layer/)
  })
})

describe('explicit detail-readiness candidates', () => {
  it('prefers selected controlled imagery while it is loading or available', () => {
    const state = statuses()
    expect(detailReadinessLayers({ mola: true, ctx: true, controlledCtx: true }, state)).toEqual(['controlledCtx'])
    state.controlledCtx = { ...state.controlledCtx, phase: 'available', loaded: 1 }
    expect(detailReadinessLayers({ mola: true, ctx: true, controlledCtx: true }, state)).toEqual(['controlledCtx'])
  })
  it('allows only a selected preliminary fallback after controlled failure or missing coverage', () => {
    const state = statuses()
    state.controlledCtx.phase = 'unavailable'
    expect(detailReadinessLayers({ mola: true, ctx: true, controlledCtx: true }, state)).toEqual(['controlledCtx', 'ctx'])
    expect(detailReadinessLayers({ mola: true, ctx: false, controlledCtx: true }, state)).toEqual(['controlledCtx'])
    state.controlledCtx = { ...initialLayerStatus(), coverage: 'outside' }
    expect(detailReadinessLayers({ mola: false, ctx: true, controlledCtx: true }, state)).toEqual(['controlledCtx', 'ctx'])
    state.controlledCtx = { ...initialLayerStatus(), missing: 1 }
    expect(detailReadinessLayers({ mola: false, ctx: true, controlledCtx: true }, state)).toEqual(['controlledCtx', 'ctx'])
    state.controlledCtx.pending = 1
    expect(detailReadinessLayers({ mola: false, ctx: true, controlledCtx: true }, state)).toEqual(['controlledCtx'])
  })
  it('never picks a layer that the user did not select', () => {
    expect(detailReadinessLayers(both, statuses())).toEqual(['ctx'])
    expect(detailReadinessLayers({ mola: true, ctx: false, controlledCtx: false }, statuses())).toEqual([])
  })
})
