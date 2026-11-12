import { describe, expect, it, vi } from 'vitest'
import { createJezeroStages, createReturnStages } from './jezeroFlight'
import { initialLayerStatus } from '../map/types'

function host() {
  const map = { prepareJezeroApproach: vi.fn(), setApproachZoom: vi.fn(), setDetailOpacity: vi.fn(), hasRenderedImagery: vi.fn(() => true) }
  const globe = { reset: vi.fn(), beginApproach: vi.fn(), setOverviewProgress: vi.fn(), setApproachProgress: vi.fn(), endApproach: vi.fn() }
  const blend = vi.fn()
  const onStage = vi.fn()
  const onContextTimeout = vi.fn()
  const onDetailTimeout = vi.fn()
  return { map, globe, blend, onStage, onContextTimeout, onDetailTimeout,
    preferences: () => ({ mola: true, ctx: true }), statuses: () => ({ mola: initialLayerStatus(), ctx: initialLayerStatus() }) }
}

describe('scripted Jezero flight choreography', () => {
  it('approaches the globe before crossfading context and zooming to supported CTX detail', () => {
    const h = host()
    const stages = createJezeroStages({ ...h, fromMap: false })
    stages[0].onStart?.(); stages[0].onFrame(0); stages[0].onFrame(1)
    expect(h.globe.beginApproach).toHaveBeenCalledOnce()
    expect(h.map.prepareJezeroApproach).toHaveBeenCalledOnce()
    expect(h.blend).toHaveBeenLastCalledWith(0)
    expect(h.globe.setApproachProgress).toHaveBeenLastCalledWith(1)
    expect(stages[0].ready?.()).toBe(true)
    stages[1].onFrame(0.5)
    expect(h.blend).toHaveBeenLastCalledWith(0.5)
    stages[2].onFrame(0)
    expect(h.map.setApproachZoom).toHaveBeenLastCalledWith(4)
    expect(h.map.setDetailOpacity).toHaveBeenLastCalledWith(0)
    stages[2].onFrame(1)
    expect(h.map.setApproachZoom).toHaveBeenLastCalledWith(10)
    expect(h.map.setDetailOpacity).toHaveBeenLastCalledWith(1)
    expect(stages[2].ready?.()).toBe(true)
    expect(h.map.hasRenderedImagery).toHaveBeenLastCalledWith('ctx')
  })
  it('fades the old map to a complete globe before changing the map target', () => {
    const h = host()
    const stages = createJezeroStages({ ...h, fromMap: true })
    stages[0].onStart?.(); stages[0].onFrame(0)
    expect(h.blend).toHaveBeenLastCalledWith(1)
    expect(h.map.prepareJezeroApproach).not.toHaveBeenCalled()
    stages[0].onFrame(1)
    expect(h.blend).toHaveBeenLastCalledWith(0)
    stages[1].onStart?.()
    expect(h.map.prepareJezeroApproach).toHaveBeenCalledOnce()
  })
  it('honors CTX-only and both-hidden preferences without enabling MOLA', () => {
    const h = host()
    const stages = createJezeroStages({ ...h, fromMap: false, preferences: () => ({ mola: false, ctx: true }) })
    stages[0].onStart?.()
    expect(h.map.setApproachZoom).toHaveBeenLastCalledWith(7)
    expect(h.map.setDetailOpacity).toHaveBeenLastCalledWith(1)
    const hidden = createJezeroStages({ ...h, fromMap: false, preferences: () => ({ mola: false, ctx: false }) })
    h.map.hasRenderedImagery.mockReturnValue(false)
    expect(hidden[0].ready?.()).toBe(true)
    expect(hidden[2].ready?.()).toBe(true)
  })
  it('requires real rendered imagery and provides separate context/detail timeout actions', () => {
    const h = host()
    h.map.hasRenderedImagery.mockReturnValue(false)
    const stages = createJezeroStages({ ...h, fromMap: false })
    expect(stages[0].ready?.()).toBe(false)
    expect(stages[2].ready?.()).toBe(false)
    stages[0].onTimeout?.(); stages[2].onTimeout?.()
    expect(h.onContextTimeout).toHaveBeenCalledOnce()
    expect(h.onDetailTimeout).toHaveBeenCalledOnce()
  })
  it('can prepare CTX if MOLA fails or is deselected while waiting', () => {
    const h = host()
    let preferences = { mola: true, ctx: true }
    const stages = createJezeroStages({ ...h, fromMap: false, preferences: () => preferences })
    stages[0].onStart?.()
    preferences = { mola: false, ctx: true }
    stages[0].ready?.()
    expect(h.map.setApproachZoom).toHaveBeenLastCalledWith(7)
    expect(h.map.setDetailOpacity).toHaveBeenLastCalledWith(1)
  })
  it('returns coherently to the full globe without changing the explored map', () => {
    const h = host()
    const [stage] = createReturnStages(h)
    stage.onStart?.(); stage.onFrame(0)
    expect(h.blend).toHaveBeenLastCalledWith(1)
    expect(h.globe.setApproachProgress).toHaveBeenLastCalledWith(1)
    stage.onFrame(1)
    expect(h.blend).toHaveBeenLastCalledWith(0)
    expect(h.globe.setApproachProgress).toHaveBeenLastCalledWith(0)
    expect(h.map.setApproachZoom).not.toHaveBeenCalled()
  })
  it('restores full-globe framing before a reduced-motion return reveals the overview', () => {
    const h = host()
    const [stage] = createReturnStages({ ...h, reducedMotion: true })
    expect(stage.durationMs).toBe(0)
    stage.onStart?.()
    expect(h.globe.setApproachProgress).toHaveBeenLastCalledWith(0)
    expect(h.blend).toHaveBeenLastCalledWith(1)
    stage.onFrame(1)
    expect(h.globe.setApproachProgress).toHaveBeenLastCalledWith(0)
    expect(h.blend).toHaveBeenLastCalledWith(0)
  })
})
