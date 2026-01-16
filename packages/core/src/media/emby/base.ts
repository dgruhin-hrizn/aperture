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
    // Add api_key to query params (more reliable than header for some endpoints)
    const separator = endpoint.includes('?') ? '&' : '?'
    const url = `${this.baseUrl}${endpoint}${separator}api_key=${apiKey}`
    
    const headers: Record<string, string> = {
      'X-Emby-Authorization': this.getAuthHeader(apiKey),
      ...((options.headers as Record<string, string>) || {}),
    }
    
    // Only add Content-Type for requests with body
    if (options.body) {
      headers['Content-Type'] = 'application/json'
    }

    // Debug: log body if present (for troubleshooting library creation)
    if (options.body) {
      logger.debug({ method: options.method || 'GET', url, bodyPreview: String(options.body).substring(0, 200) }, '📡 Emby API Request (with body)')
    } else {
      logger.debug({ method: options.method || 'GET', url }, '📡 Emby API Request')
    }

    // Add 30 second timeout with AbortController
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const startTime = Date.now()
    let response: Response
    
    // Build fetch options explicitly to ensure body is included
    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
      signal: controller.signal,
    }
    if (options.body) {
      fetchOptions.body = options.body
    }
    
    try {
      response = await fetch(url, fetchOptions)
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



