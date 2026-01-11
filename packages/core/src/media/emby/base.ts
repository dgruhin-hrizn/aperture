/**
 * Emby Provider Base
 *
 * Core class with constructor, authentication helpers, and fetch functionality.
 * Extended by other modules for specific functionality.
 */

import { createChildLogger } from '../../lib/logger.js'

export const logger = createChildLogger('emby-provider')

export class EmbyProviderBase {
  readonly type = 'emby' as const
  readonly baseUrl: string
  protected readonly clientName = 'Aperture'
  protected readonly deviceId = 'aperture-server'
  protected readonly deviceName = 'Aperture Server'
  protected readonly clientVersion = '1.0.0'

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  getAuthHeader(apiKey: string): string {
    return `MediaBrowser Client="${this.clientName}", Device="${this.deviceName}", DeviceId="${this.deviceId}", Version="${this.clientVersion}", Token="${apiKey}"`
  }

  async fetch<T>(endpoint: string, apiKey: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'X-Emby-Authorization': this.getAuthHeader(apiKey),
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    logger.debug({ method: options.method || 'GET', url }, '📡 Emby API Request')

    // Add 30 second timeout with AbortController
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const startTime = Date.now()
    let response: Response
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime
      if (err instanceof Error && err.name === 'AbortError') {
        logger.error({ url, duration }, '⏱️ Emby API request timed out after 30 seconds')
        throw new Error(
          `Connection to Emby timed out after 30 seconds. Please check that your media server URL (${this.baseUrl}) is accessible from the Aperture container.`
        )
      }
      logger.error({ url, duration, err }, '❌ Emby API network error')
      throw new Error(
        `Failed to connect to Emby at ${this.baseUrl}. Please verify the URL is correct and the server is running.`
      )
    } finally {
      clearTimeout(timeoutId)
    }
    const duration = Date.now() - startTime

    if (!response.ok) {
      const text = await response.text()
      logger.error({ status: response.status, url, body: text, duration }, '❌ Emby API error')
      throw new Error(`Emby API error: ${response.status} ${response.statusText}`)
    }

    // Some endpoints return empty response
    const text = await response.text()
    if (!text) {
      logger.debug({ url, duration, empty: true }, '✅ Emby API Response (empty)')
      return {} as T
    }

    const data = JSON.parse(text) as T

    // Log response summary
    logger.debug(
      {
        url,
        duration,
        responseSize: text.length,
        // If it's an items response, log count
        ...(typeof data === 'object' && data !== null && 'Items' in data
          ? {
              itemCount: (data as { Items?: unknown[] }).Items?.length,
              totalRecordCount: (data as { TotalRecordCount?: number }).TotalRecordCount,
            }
          : {}),
      },
      '✅ Emby API Response'
    )

    return data
  }

  // Utility methods for image URLs
  getPosterUrl(itemId: string, imageTag?: string): string {
    const params = imageTag ? `?tag=${imageTag}` : ''
    return `${this.baseUrl}/Items/${itemId}/Images/Primary${params}`
  }

  getBackdropUrl(itemId: string, imageTag?: string): string {
    const params = imageTag ? `?tag=${imageTag}` : ''
    return `${this.baseUrl}/Items/${itemId}/Images/Backdrop${params}`
  }

  getStreamUrl(apiKey: string, itemId: string): string {
    return `${this.baseUrl}/Videos/${itemId}/stream?api_key=${apiKey}`
  }
}



