import { describe, expect, it } from 'vitest'
import { explorerPaneOpacities, initialExplorerState, transitionExplorer as step } from './transition'
import type { ExplorerState } from './transition'

const enterMap = (): ExplorerState => step(step(initialExplorerState, { type: 'enter-map' }), { type: 'settled', phase: 'entering-map' })
const zoom = (state: ExplorerState, value: number, overviewAvailable = true) => step(state, { type: 'map-zoom', value, overviewAvailable })

describe('synchronized explorer pane composition', () => {
  it('keeps the globe hidden when manual zoom starts returning from the map', () => {
    const map = zoom(enterMap(), 4)
    const returning = zoom(map, 1.5)
    expect(returning.phase).toBe('entering-overview')
    expect(explorerPaneOpacities(returning, 1)).toEqual(explorerPaneOpacities(map, null))
    expect(explorerPaneOpacities(returning, 1).globe).toBe(0)
  })

  it('fades the outgoing view as the incoming view appears in either direction', () => {
    const entering = step(initialExplorerState, { type: 'enter-map' })
    const returning = step(enterMap(), { type: 'enter-overview' })
    for (const state of [entering, returning]) {
      for (const composition of [0.2, 0.5, 0.8]) {
        const panes = explorerPaneOpacities(state, composition)
        expect(panes.globe + panes.map).toBeCloseTo(1)
        expect(panes.globe).toBeLessThan(1)
        expect(panes.map).toBeLessThan(1)
      }
    }
  })

  it('does not reveal the globe while the fully exposed map waits for CTX', () => {
    const flight = zoom(step(initialExplorerState, { type: 'fly-jezero' }), 10)
    expect(explorerPaneOpacities(flight, 1)).toEqual({ globe: 0, map: 1 })
  })

  it('preserves both final fade endpoints when the animation settles', () => {
    for (const [state, endpoint] of [
      [step(initialExplorerState, { type: 'enter-map' }), 1],
      [step(initialExplorerState, { type: 'fly-jezero' }), 1],
      [step(enterMap(), { type: 'enter-overview' }), 0],
    ] as const) {
      const settled = step(state, { type: 'settled', phase: state.phase })
      expect(explorerPaneOpacities(state, endpoint)).toEqual(explorerPaneOpacities(settled, null))
    }
  })

  it('leaves exactly one pane visible after Skip, cancellation or reduced-motion arrival', () => {
    const flight = step(initialExplorerState, { type: 'fly-jezero' })
    const skipped = step(flight, { type: 'settled', phase: flight.phase })
    const direct = step(flight, { type: 'interrupt', destination: 'map' })
    const cancelled = step(flight, { type: 'interrupt', destination: 'overview' })
    expect(explorerPaneOpacities(skipped, null)).toEqual({ globe: 0, map: 1 })
    expect(explorerPaneOpacities(direct, null)).toEqual({ globe: 0, map: 1 })
    expect(explorerPaneOpacities(cancelled, null)).toEqual({ globe: 1, map: 0 })
  })
})

describe('one-viewport exploration handoff', () => {
  it('starts one explicit Jezero flight from either settled view and rejects duplicate actions', () => {
    for (const start of [initialExplorerState, enterMap()]) {
      const flight = step(start, { type: 'fly-jezero' })
      expect(flight.phase).toBe('flying-to-jezero')
      expect(step(flight, { type: 'fly-jezero' })).toBe(flight)
      expect(step(flight, { type: 'enter-overview' })).toBe(flight)
      expect(step(flight, { type: 'globe-distance', value: 1 })).toBe(flight)
    }
  })
  it('updates CTX detail during flight without allowing zoom to interrupt it', () => {
    const flight = step(initialExplorerState, { type: 'fly-jezero' })
    const detail = zoom(flight, 10)
    expect(detail.phase).toBe('flying-to-jezero')
    expect(detail.localDetail).toBe(true)
    expect(step(detail, { type: 'settled', phase: 'flying-to-jezero' }).phase).toBe('map')
  })
  it('enables retained CTX detail before generic map re-entry waits for rendered imagery', () => {
    const entering = step(initialExplorerState, { type: 'enter-map' })
    const detail = zoom(entering, 10)
    expect(detail.phase).toBe('entering-map')
    expect(detail.localDetail).toBe(true)
    expect(zoom(detail, 4).localDetail).toBe(false)
  })
  it('interrupts cleanly and ignores stale completion after cancellation', () => {
    const flight = step(initialExplorerState, { type: 'fly-jezero' })
    const cancelled = step(flight, { type: 'interrupt', destination: 'overview' })
    expect(cancelled.phase).toBe('overview')
    expect(cancelled.localDetail).toBe(false)
    expect(step(cancelled, { type: 'settled', phase: 'flying-to-jezero' })).toBe(cancelled)
    expect(step(flight, { type: 'interrupt', destination: 'map' }).phase).toBe('map')
  })
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
