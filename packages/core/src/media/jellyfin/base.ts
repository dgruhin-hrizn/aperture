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

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const text = await response.text()
      logger.error({ status: response.status, url, body: text }, 'Jellyfin API error')
      throw new Error(`Jellyfin API error: ${response.status} ${response.statusText}`)
    }

    // Some endpoints return empty response
    const text = await response.text()
    if (!text) {
      return {} as T
    }

    return JSON.parse(text) as T
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



