/**
 * Emby Provider Base
 */

import { WorkQueue } from '../../lib/workQueue.js'
import { createChildLogger } from '../../lib/logger.js'
import {
  EMBY_FETCH_TIMEOUT_MS,
  embyConnectionError,
  EmbyHttpError,
  embyTimeoutError,
  parseEmbyResponseBody,
  summarizeEmbyItemsResponse,
} from './fetchHelpers.js'

export const logger = createChildLogger('emby-provider')
const requests = new Map<string, WorkQueue>()

export class EmbyProviderBase {
  readonly type = 'emby' as const
  readonly baseUrl: string
  protected readonly clientName = 'Aperture'
  protected readonly deviceId = 'aperture-server'
  protected readonly deviceName = 'Aperture Server'
  protected readonly clientVersion = '1.0.0'
  protected readonly requestTimeoutMs: number = EMBY_FETCH_TIMEOUT_MS

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  getAuthHeader(apiKey: string): string {
    return `MediaBrowser Client="${this.clientName}", Device="${this.deviceName}", DeviceId="${this.deviceId}", Version="${this.clientVersion}", Token="${apiKey}"`
  }

  async fetch<T>(endpoint: string, apiKey: string, options: RequestInit = {}): Promise<T> {
    let queue = requests.get(this.baseUrl)
    if (!queue) {
      queue = new WorkQueue(4)
      requests.set(this.baseUrl, queue)
    }
    return queue.run(() => this.fetchResponse<T>(endpoint, apiKey, options))
  }

  private async fetchResponse<T>(endpoint: string, apiKey: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'X-Emby-Authorization': this.getAuthHeader(apiKey),
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs)
    const signal = options.signal
      ? AbortSignal.any([controller.signal, options.signal])
      : controller.signal
    const startTime = Date.now()
    logger.debug({ method: options.method || 'GET', url }, '📡 Emby API Request')
    try {
      const response = await fetch(url, { ...options, headers, signal })
      // Keep the deadline and concurrency slot until the entire body is read.
      const text = await response.text()
      const duration = Date.now() - startTime
      if (!response.ok) {
        logger.error({ status: response.status, url, duration }, '❌ Emby API error')
        throw new EmbyHttpError(response.status, response.statusText, text)
      }
      if (!text) return {} as T
      const data = parseEmbyResponseBody<T>(text)
      logger.debug({ url, duration, responseSize: text.length, ...summarizeEmbyItemsResponse(data) }, '✅ Emby API Response')
      return data
    } catch (err) {
      if (options.signal?.aborted) throw err
      if (controller.signal.aborted) {
        logger.error({ url, duration: Date.now() - startTime }, 'Emby request deadline exceeded')
        throw embyTimeoutError(this.baseUrl)
      }
      if (err instanceof EmbyHttpError) throw err
      // Preserve invalid-response errors rather than misreporting a connection failure.
      if (err instanceof Error && err.name === 'SyntaxError') throw err
      logger.error({ url, duration: Date.now() - startTime, err }, '❌ Emby API network error')
      throw embyConnectionError(this.baseUrl)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  getPosterUrl(itemId: string, imageTag?: string): string {
    const params = imageTag ? `?tag=${imageTag}` : ''
    return `${this.baseUrl}/Items/${itemId}/Images/Primary${params}`
  }

  getBackdropUrl(itemId: string, imageTag?: string): string {
    const params = imageTag ? `?tag=${imageTag}` : ''
    return `${this.baseUrl}/Items/${itemId}/Images/Backdrop${params}`
  }

  getBannerUrl(itemId: string, imageTag?: string): string {
    const params = imageTag ? `?tag=${imageTag}` : ''
    return `${this.baseUrl}/Items/${itemId}/Images/Banner${params}`
  }

  getLogoUrl(itemId: string, imageTag?: string): string {
    const params = imageTag ? `?tag=${imageTag}` : ''
    return `${this.baseUrl}/Items/${itemId}/Images/Logo${params}`
  }

  getArtUrl(itemId: string, imageTag?: string): string {
    const params = imageTag ? `?tag=${imageTag}` : ''
    return `${this.baseUrl}/Items/${itemId}/Images/Art${params}`
  }

  getThumbUrl(itemId: string, imageTag?: string): string {
    const params = imageTag ? `?tag=${imageTag}` : ''
    return `${this.baseUrl}/Items/${itemId}/Images/Thumb${params}`
  }

  getStreamUrl(itemId: string): string {
    return `${this.baseUrl}/Videos/${itemId}/stream`
  }
}
