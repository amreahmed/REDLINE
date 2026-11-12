import { describe, expect, it, vi } from 'vitest'
import { createAnimationPlayer } from './animation'

function harness() {
  let serial = 0
  const queued = new Map<number, (time: number) => void>()
  const history: ((time: number) => void)[] = []
  const player = createAnimationPlayer({
    request: (callback) => { history.push(callback); queued.set(++serial, callback); return serial },
    cancel: (id) => { queued.delete(id) },
  })
  return { player, history, queued, frame: (time: number) => { const callbacks = [...queued.values()]; queued.clear(); callbacks.forEach((callback) => callback(time)) } }
}

describe('cancellable animation sequence', () => {
  it('rejects overlapping starts and completes each stage once', () => {
    const h = harness()
    const frames: number[] = []
    const complete = vi.fn()
    const start = vi.fn()
    expect(h.player.start([{ durationMs: 100, onStart: start, onFrame: (p) => frames.push(p) }], { onComplete: complete })).toBe(true)
    expect(h.player.start([], { onComplete: complete })).toBe(false)
    h.frame(0); h.frame(50); h.frame(100)
    expect(frames).toEqual([0, 0.5, 1])
    expect(start).toHaveBeenCalledTimes(1)
    expect(complete).toHaveBeenCalledTimes(1)
    expect(h.queued.size).toBe(0)
  })
  it('holds the last frame while awaiting imagery without mutating its view again', () => {
    const h = harness()
    let ready = false
    const draw = vi.fn()
    const waiting = vi.fn()
    const next = vi.fn()
    h.player.start([{ durationMs: 0, onFrame: draw, ready: () => ready, onWaiting: waiting, timeoutMs: 1000 }, { durationMs: 0, onFrame: next }])
    h.frame(0); h.frame(100); h.frame(200)
    expect(draw).toHaveBeenCalledTimes(1)
    expect(waiting).toHaveBeenCalledTimes(1)
    expect(next).not.toHaveBeenCalled()
    ready = true
    h.frame(250); h.frame(300)
    expect(next).toHaveBeenCalledWith(1)
  })
  it('times out unavailable imagery without executing the later reveal', () => {
    const h = harness()
    const timeout = vi.fn()
    const reveal = vi.fn()
    const complete = vi.fn()
    h.player.start([{ durationMs: 0, onFrame: () => {}, ready: () => false, timeoutMs: 100, onTimeout: timeout }, { durationMs: 0, onFrame: reveal }], { onComplete: complete })
    h.frame(0); h.frame(99); h.frame(100)
    expect(timeout).toHaveBeenCalledTimes(1)
    expect(reveal).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
    expect(h.player.isRunning()).toBe(false)
  })
  it('cancels pending callbacks and ignores even a delivered stale callback after restart', () => {
    const h = harness()
    const stale = vi.fn()
    h.player.start([{ durationMs: 100, onFrame: stale }])
    const lateFrame = h.history[0]
    h.player.cancel()
    const next = vi.fn()
    h.player.start([{ durationMs: 100, onFrame: next }])
    lateFrame(50); h.frame(100)
    expect(stale).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
  })
  it('disposal prevents restart and releases a waiting sequence', () => {
    const h = harness()
    h.player.start([{ durationMs: 0, onFrame: () => {}, ready: () => false }])
    h.frame(0)
    h.player.dispose()
    expect(h.queued.size).toBe(0)
    expect(h.player.start([])).toBe(false)
  })
  it('does not jump to the end after the tab stops producing frames', () => {
    const h = harness()
    const frames: number[] = []
    h.player.start([{ durationMs: 1000, onFrame: (p) => frames.push(p) }])
    h.frame(0); h.frame(20000)
    expect(frames[1]).toBeLessThanOrEqual(0.05)
    h.player.cancel()
  })
  it('stops and reports a renderer error without keeping a frame loop alive', () => {
    const h = harness()
    const error = vi.fn()
    h.player.start([{ durationMs: 20, onFrame: () => { throw new Error('context lost') } }], { onError: error })
    h.frame(0)
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'context lost' }))
    expect(h.queued.size).toBe(0)
  })
})
