/** Queue owns cancellation and deduplication for both pending and active rows. */
export function createStripQueue(
  process: (key: string, signal: AbortSignal) => Promise<void>,
  concurrency = 2
) {
  let generation = 0
  let active = 0
  let pending: string[] = []
  const keys = new Set<string>()
  const controllers = new Set<AbortController>()
  const drain = () => {
    while (active < concurrency && pending.length) {
      const key = pending.shift()!
      const version = generation
      const controller = new AbortController()
      controllers.add(controller)
      active++
      void Promise.resolve()
        .then(() => {
          if (!controller.signal.aborted) return process(key, controller.signal)
        })
        .catch(() => {
          /* The row component owns its error UI. Keep draining other rows. */
        })
        .finally(() => {
          if (version !== generation) return
          active--
          keys.delete(key)
          controllers.delete(controller)
          drain()
        })
    }
  }
  return {
    enqueue(key: string, canEnqueue: () => boolean) {
      if (keys.has(key) || !canEnqueue()) return
      keys.add(key)
      pending.push(key)
      drain()
    },
    reset() {
      generation++
      for (const controller of controllers) controller.abort()
      controllers.clear()
      keys.clear()
      pending = []
      active = 0
    },
  }
}
