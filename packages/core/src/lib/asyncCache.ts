/** Small process-local cache. Failed/empty loads are retried; invalidation also retires in-flight results. */
export class AsyncCache<T> {
  private values = new Map<string, { value: T; expires: number }>()
  private pending = new Map<string, Promise<T>>()

  constructor(
    private ttlMs: number,
    private maxEntries = 500
  ) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.values.get(key)
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value)
    this.values.delete(key)
    const existing = this.pending.get(key)
    if (existing) return existing
    const promise = Promise.resolve()
      .then(load)
      .then((value) => {
        if (value != null && this.pending.get(key) === promise) {
          this.values.set(key, { value, expires: Date.now() + this.ttlMs })
          while (this.values.size > this.maxEntries)
            this.values.delete(this.values.keys().next().value!)
        }
        return value
      })
      .finally(() => {
        if (this.pending.get(key) === promise) this.pending.delete(key)
      })
    this.pending.set(key, promise)
    return promise
  }

  clear() {
    this.values.clear()
    this.pending.clear()
  }
}

/** A shared limit avoids multiplying upstream concurrency when several strips load together. */
export function concurrencyLimit(max: number) {
  let active = 0
  const waiting: (() => void)[] = []
  return async <T>(load: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve))
    else active++
    try {
      return await load()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
}
