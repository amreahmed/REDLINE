export type AnimationClock = { request: (callback: (time: number) => void) => number; cancel: (id: number) => void }
export type AnimationStage = {
  durationMs: number
  onStart?: () => void
  onFrame: (progress: number) => void
  ready?: () => boolean
  timeoutMs?: number
  onWaiting?: () => void
  onTimeout?: () => void
}
type Callbacks = { onComplete?: () => void; onError?: (error: unknown) => void }

/** One frame owner; generation guards also reject callbacks delivered after cancellation. */
export function createAnimationPlayer(clock: AnimationClock = { request: (callback) => requestAnimationFrame(callback), cancel: (id) => cancelAnimationFrame(id) }) {
  let generation = 0
  let frameId: number | undefined
  let running = false
  let disposed = false
  function cancel() {
    generation++
    running = false
    if (frameId !== undefined) clock.cancel(frameId)
    frameId = undefined
  }
  return {
    isRunning: () => running,
    cancel,
    dispose: () => { cancel(); disposed = true },
    start(stages: readonly AnimationStage[], callbacks: Callbacks = {}): boolean {
      if (running || disposed) return false
      running = true
      const token = ++generation
      let index = 0
      let elapsed = 0
      let previous: number | undefined
      let started = false
      let waitingAt: number | undefined
      function frame(now: number) {
        if (token !== generation || !running || disposed) return
        frameId = undefined
        try {
          const stage = stages[index]
          if (!stage) { cancel(); callbacks.onComplete?.(); return }
          if (!started) { started = true; stage.onStart?.() }
          if (token !== generation) return
          if (waitingAt === undefined) {
            elapsed += previous === undefined ? 0 : Math.max(0, Math.min(50, now - previous))
            const progress = stage.durationMs <= 0 ? 1 : Math.min(1, elapsed / stage.durationMs)
            stage.onFrame(progress)
            if (token !== generation) return
            if (progress === 1) {
              waitingAt = now
              if (stage.ready && !stage.ready()) stage.onWaiting?.()
            }
          }
          if (waitingAt !== undefined) {
            if (!stage.ready || stage.ready()) {
              index++
              elapsed = 0
              started = false
              waitingAt = undefined
              previous = undefined
              if (index === stages.length) { cancel(); callbacks.onComplete?.(); return }
            } else if (now - waitingAt >= (stage.timeoutMs ?? 12_000)) {
              cancel()
              if (stage.onTimeout) stage.onTimeout()
              else callbacks.onError?.(new Error('Imagery did not become ready before the transition timeout.'))
              return
            }
          }
          if (started) previous = now
          if (token === generation && running) frameId = clock.request(frame)
        } catch (error) {
          cancel()
          callbacks.onError?.(error)
        }
      }
      frameId = clock.request(frame)
      return true
    },
  }
}

export const easeInOut = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}
