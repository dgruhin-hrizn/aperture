/** Bound reads without changing the caller's cancellation or authentication behavior. */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15_000) {
  const deadline = AbortSignal.timeout(timeoutMs)
  return fetch(input, {
    credentials: 'include',
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
  })
}

export async function apiJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await apiFetch(url, { signal })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}
