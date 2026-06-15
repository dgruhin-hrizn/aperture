/**
 * Emby fetch helpers — timeout, error normalization, and response parsing.
 */

export const EMBY_FETCH_TIMEOUT_MS = 60_000

export function embyTimeoutError(baseUrl: string): Error {
  return new Error(
    `Connection to Emby timed out after ${EMBY_FETCH_TIMEOUT_MS / 1000} seconds. Please check that your media server URL (${baseUrl}) is accessible from the Aperture container.`
  )
}

export function embyConnectionError(baseUrl: string): Error {
  return new Error(
    `Failed to connect to Emby at ${baseUrl}. Please verify the URL is correct and the server is running.`
  )
}

export function embyHttpError(status: number, statusText: string): Error {
  return new Error(`Emby API error: ${status} ${statusText}`)
}

export function isEmbyNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('404')
}

export function parseEmbyResponseBody<T>(text: string): T {
  if (!text) {
    return {} as T
  }
  return JSON.parse(text) as T
}

export function summarizeEmbyItemsResponse(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null || !('Items' in data)) {
    return {}
  }
  const itemsResponse = data as { Items?: unknown[]; TotalRecordCount?: number }
  return {
    itemCount: itemsResponse.Items?.length,
    totalRecordCount: itemsResponse.TotalRecordCount,
  }
}
