import { describe, expect, it } from 'vitest'
import { initialExplorerState, transitionExplorer as step } from './transition'
import type { ExplorerState } from './transition'

const enterMap = (): ExplorerState => step(step(initialExplorerState, { type: 'enter-map' }), { type: 'settled', phase: 'entering-map' })
const zoom = (state: ExplorerState, value: number, overviewAvailable = true) => step(state, { type: 'map-zoom', value, overviewAvailable })

describe('one-viewport exploration handoff', () => {
  it('starts on the overview and requires a far-to-near zoom crossing', () => {
    expect(initialExplorerState.phase).toBe('overview')
    expect(step(initialExplorerState, { type: 'globe-distance', value: 2 }).phase).toBe('overview')
    const armed = step(initialExplorerState, { type: 'globe-distance', value: 4 })
    expect(step(armed, { type: 'globe-distance', value: 2.45 }).phase).toBe('entering-map')
  })
  it('ignores competing gestures and stale timers during the controlled fade', () => {
    const entering = step(initialExplorerState, { type: 'enter-map' })
    expect(step(entering, { type: 'enter-overview' })).toBe(entering)
    expect(zoom(entering, 0)).toBe(entering)
    expect(step(entering, { type: 'settled', phase: 'entering-overview' })).toBe(entering)
    expect(step(entering, { type: 'settled', phase: 'entering-map' }).phase).toBe('map')
  })
  it('returns to the globe only after map rearm and a wider zoom threshold', () => {
    const map = enterMap()
    expect(zoom(map, 1).phase).toBe('map')
    const armed = zoom(map, 4)
    expect(zoom(armed, 1.6).phase).toBe('map')
    const leaving = zoom(armed, 1.5)
    expect(leaving.phase).toBe('entering-overview')
    const overview = step(leaving, { type: 'settled', phase: 'entering-overview' })
    expect(step(overview, { type: 'globe-distance', value: 2.4 }).phase).toBe('overview')
    const rearmed = step(overview, { type: 'globe-distance', value: 4 })
    expect(step(rearmed, { type: 'globe-distance', value: 2.4 }).phase).toBe('entering-map')
  })
  it('retains the real map when the optional globe is unavailable', () => {
    expect(zoom(zoom(enterMap(), 4), 0, false).phase).toBe('map')
    expect(step(initialExplorerState, { type: 'enter-map' }).phase).toBe('entering-map')
  })
  it('reveals CTX locally with a distinct exit threshold to avoid flicker', () => {
    let state = enterMap()
    for (const [level, expected] of [[6.9, false], [7, true], [6.8, true], [6.3, true], [6.25, false], [6.7, false], [7.1, true]] as const) {
      state = zoom(state, level)
      expect(state.localDetail).toBe(expected)
    }
  })
  it('ignores invalid input without inventing a focal coordinate', () => {
    expect(step(initialExplorerState, { type: 'globe-distance', value: NaN })).toBe(initialExplorerState)
    expect(step(initialExplorerState, { type: 'globe-distance', value: -1 })).toBe(initialExplorerState)
    const state = enterMap()
    expect(zoom(state, Infinity)).toBe(state)
    expect(Object.keys(state)).not.toContain('coordinate')
  })
})
