/**
 * Jellyfin Provider Base
 *
 * Core class with constructor, authentication helpers, and fetch functionality.
 */

import { createChildLogger } from '../../lib/logger.js'

export const logger = createChildLogger('jellyfin-provider')

export class JellyfinProviderBase {
  readonly type = 'jellyfin' as const
  readonly baseUrl: string
  protected readonly clientName = 'Aperture'
  protected readonly deviceId = 'aperture-server'
  protected readonly deviceName = 'Aperture Server'
  protected readonly clientVersion = '1.0.0'

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  getAuthHeader(apiKey?: string): string {
    let header = `MediaBrowser Client="${this.clientName}", Device="${this.deviceName}", DeviceId="${this.deviceId}", Version="${this.clientVersion}"`
    if (apiKey) {
      header += `, Token="${apiKey}"`
    }
    return header
  }

  async fetch<T>(endpoint: string, apiKey: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(apiKey),
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    // Add 60 second timeout with AbortController (increased from 30s for large libraries)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

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
        logger.error({ url, duration }, '⏱️ Jellyfin API request timed out after 60 seconds')
        throw new Error(
          `Connection to Jellyfin timed out after 60 seconds. Please check that your media server URL (${this.baseUrl}) is accessible from the Aperture container.`
        )
      }
      logger.error({ url, duration, err }, '❌ Jellyfin API network error')
      throw new Error(
        `Failed to connect to Jellyfin at ${this.baseUrl}. Please verify the URL is correct and the server is running.`
      )
    } finally {
      clearTimeout(timeoutId)
    }
    const duration = Date.now() - startTime

    if (!response.ok) {
      const text = await response.text()
      logger.error({ status: response.status, url, body: text, duration }, '❌ Jellyfin API error')
      throw new Error(`Jellyfin API error: ${response.status} ${response.statusText}`)
    }

    // Some endpoints return empty response
    const text = await response.text()
    if (!text) {
      logger.debug({ url, duration, empty: true }, '✅ Jellyfin API Response (empty)')
      return {} as T
    }

    const data = JSON.parse(text) as T
    logger.debug({ url, duration, responseSize: text.length }, '✅ Jellyfin API Response')

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



