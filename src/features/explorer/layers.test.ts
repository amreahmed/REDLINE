import { describe, expect, it } from 'vitest'
import type { Coverage, LayerVisibility } from '../map/types'
import { initialLayerStatus } from '../map/types'
import { contextCanOpenWithoutImagery, explorerLayerVisibility, explorerViewportMessage } from './layers'

type VisibilityCase = {
  name: string
  preferences: LayerVisibility
  mapActive: boolean
  localDetail: boolean
  coverage: Coverage
  expected: LayerVisibility
}

const cases: VisibilityCase[] = [
  { name: 'overview hides map layers without changing their enabled preferences', preferences: { mola: true, ctx: true }, mapActive: false, localDetail: true, coverage: 'inside', expected: { mola: false, ctx: false } },
  { name: 'broad exploration shows MOLA before CTX detail', preferences: { mola: true, ctx: true }, mapActive: true, localDetail: false, coverage: 'inside', expected: { mola: true, ctx: false } },
  { name: 'local exploration includes CTX within coverage', preferences: { mola: true, ctx: true }, mapActive: true, localDetail: true, coverage: 'inside', expected: { mola: true, ctx: true } },
  { name: 'partial CTX coverage retains both layers for extent clipping', preferences: { mola: true, ctx: true }, mapActive: true, localDetail: true, coverage: 'partial', expected: { mola: true, ctx: true } },
  { name: 'outside CTX coverage keeps the MOLA context', preferences: { mola: true, ctx: true }, mapActive: true, localDetail: true, coverage: 'outside', expected: { mola: true, ctx: false } },
  { name: 'a user can hide CTX while retaining MOLA at local detail', preferences: { mola: true, ctx: false }, mapActive: true, localDetail: true, coverage: 'inside', expected: { mola: true, ctx: false } },
  { name: 'a user can inspect CTX alone within its coverage', preferences: { mola: false, ctx: true }, mapActive: true, localDetail: true, coverage: 'inside', expected: { mola: false, ctx: true } },
  { name: 'CTX-only outside coverage has no fabricated background layer', preferences: { mola: false, ctx: true }, mapActive: true, localDetail: true, coverage: 'outside', expected: { mola: false, ctx: false } },
  { name: 'CTX-only remains hidden until local detail', preferences: { mola: false, ctx: true }, mapActive: true, localDetail: false, coverage: 'inside', expected: { mola: false, ctx: false } },
  { name: 'a user can turn both layers off', preferences: { mola: false, ctx: false }, mapActive: true, localDetail: true, coverage: 'inside', expected: { mola: false, ctx: false } },
]

describe('explorer image-layer presentation', () => {
  it('allows honest empty CTX context without deadlocking the image-readiness gate', () => {
    expect(contextCanOpenWithoutImagery({ mola: false, ctx: true }, false, 'inside')).toBe(true)
    expect(contextCanOpenWithoutImagery({ mola: false, ctx: true }, true, 'outside')).toBe(true)
    expect(contextCanOpenWithoutImagery({ mola: false, ctx: false }, true, 'inside')).toBe(true)
    expect(contextCanOpenWithoutImagery({ mola: false, ctx: true }, true, 'inside')).toBe(false)
    expect(contextCanOpenWithoutImagery({ mola: true, ctx: true }, false, 'inside')).toBe(false)
  })
  it.each(cases)('$name', ({ preferences, mapActive, localDetail, coverage, expected }) => {
    expect(explorerLayerVisibility(preferences, mapActive, localDetail, coverage)).toEqual(expected)
  })

  it('restores the same layer choices after overview and broad-context transitions', () => {
    const preferences = Object.freeze({ mola: false, ctx: true })
    expect(explorerLayerVisibility(preferences, true, true, 'inside')).toEqual({ mola: false, ctx: true })
    expect(explorerLayerVisibility(preferences, false, true, 'inside')).toEqual({ mola: false, ctx: false })
    expect(explorerLayerVisibility(preferences, true, false, 'inside')).toEqual({ mola: false, ctx: false })
    expect(explorerLayerVisibility(preferences, true, true, 'inside')).toEqual({ mola: false, ctx: true })
    expect(preferences).toEqual({ mola: false, ctx: true })
  })

  it('returns independent presentation state instead of exposing the preference object', () => {
    const preferences = { mola: true, ctx: true }
    const presentation = explorerLayerVisibility(preferences, true, true, 'inside')
    presentation.ctx = false
    expect(preferences).toEqual({ mola: true, ctx: true })
  })

  it('prioritizes unavailable CTX over advice to zoom into it', () => {
    const statuses = { mola: initialLayerStatus(), ctx: { ...initialLayerStatus(), phase: 'unavailable' as const } }
    expect(explorerViewportMessage({ mola: false, ctx: true }, { mola: false, ctx: false }, statuses, false)).toMatch(/CTX service is unavailable/)
  })
  it('does not promise MOLA availability outside the CTX footprint', () => {
    const statuses = { mola: { ...initialLayerStatus(), phase: 'unavailable' as const }, ctx: { ...initialLayerStatus(), phase: 'available' as const, coverage: 'outside' as const } }
    expect(explorerViewportMessage({ mola: false, ctx: true }, { mola: false, ctx: false }, statuses, true)).toMatch(/request broader context/)
  })
  it('retains the empty state when the user deselects both layers', () => {
    const statuses = { mola: initialLayerStatus(), ctx: initialLayerStatus() }
    expect(explorerViewportMessage({ mola: false, ctx: false }, { mola: false, ctx: false }, statuses, true)).toMatch(/Choose a layer/)
  })
})
