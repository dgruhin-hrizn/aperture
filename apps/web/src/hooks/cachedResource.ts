interface ResourceEntry {
  controller: AbortController
  promise: Promise<unknown>
  subscribers: number
  expires: number
  value?: unknown
}
const resources = new Map<string, ResourceEntry>()

/** Short-lived, user-scoped config/label cache. Only abort upstream when its last reader leaves. */
export function cachedResource<T>(
  userId: string,
  url: string,
  signal: AbortSignal,
  ttlMs = 60_000
): Promise<T> {
  const key = JSON.stringify([userId, url])
  let entry = resources.get(key)
  if (entry && (entry.controller.signal.aborted || (entry.expires && entry.expires < Date.now()))) {
    resources.delete(key)
    entry = undefined
  }
  if (!entry) {
    const controller = new AbortController()
    const next: ResourceEntry = {
      controller,
      subscribers: 0,
      expires: 0,
      promise: Promise.resolve(),
    }
    next.promise = fetch(url, {
      credentials: 'include',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load data')
        const data: unknown = await res.json()
        next.value = data
        next.expires = Date.now() + ttlMs
        return data
      })
      .catch((err) => {
        if (resources.get(key) === next) resources.delete(key)
        throw err
      })
    resources.set(key, next)
    while (resources.size > 32) {
      const removable = [...resources].find(([, e]) => e.expires > 0)
      if (!removable) break
      resources.delete(removable[0])
    }
    entry = next
  }
  const current = entry
  current.subscribers++
  return new Promise<T>((resolve, reject) => {
    let finished = false
    const finish = () => {
      if (finished) return false
      finished = true
      signal.removeEventListener('abort', abort)
      current.subscribers--
      if (!current.subscribers && !current.expires) current.controller.abort()
      return true
    }
    const abort = () => {
      if (finish()) reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    current.promise.then(
      (value) => {
        if (finish()) resolve(value as T)
      },
      (err) => {
        if (finish()) reject(err)
      }
    )
    if (signal.aborted) abort()
  })
}

export function invalidateCachedResource(userId: string, url: string) {
  resources.delete(JSON.stringify([userId, url]))
}

/** Shared snapshots for completed preference writes; an older load cannot replace this entry. */
export function setCachedResource<T>(userId: string, url: string, value: T, ttlMs = 30_000) {
  resources.set(JSON.stringify([userId, url]), {
    controller: new AbortController(),
    promise: Promise.resolve(value),
    subscribers: 0,
    expires: Date.now() + ttlMs,
    value,
  })
}

export function peekCachedResource<T>(userId: string, url: string): T | undefined {
  const entry = resources.get(JSON.stringify([userId, url]))
  return entry && entry.expires > Date.now() ? (entry.value as T) : undefined
}
