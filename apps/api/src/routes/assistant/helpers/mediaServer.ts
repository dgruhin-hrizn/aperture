/**
 * Media server helper functions for generating play links
 */
import { getMediaServerConfig, createMediaServerProvider } from '@aperture/core'
import type { MediaServerInfo } from '../types.js'

/**
 * Get media server configuration for generating play links
 */
export async function getMediaServerInfo(): Promise<MediaServerInfo | null> {
  try {
    const config = await getMediaServerConfig()
    if (!config.baseUrl || !config.apiKey || !config.type) return null

    let serverId = ''
    try {
      const provider = createMediaServerProvider(config.type, config.baseUrl)
      if ('getServerInfo' in provider) {
        const info = await (
          provider as { getServerInfo: (key: string) => Promise<{ id: string; name: string }> }
        ).getServerInfo(config.apiKey)
        serverId = info.id
      }
    } catch {
      // Server ID is optional for link generation
    }

    return {
      baseUrl: config.baseUrl,
      type: config.type as 'emby' | 'jellyfin',
      serverId,
    }
  } catch {
    return null
  }
}

/**
 * Build a play link for content on the media server
 */
export function buildPlayLink(
  mediaServer: MediaServerInfo | null,
  providerItemId: string | null | undefined,
  _type: 'movie' | 'series'
): string | null {
  if (!mediaServer?.baseUrl || !providerItemId) return null

  const serverIdParam = mediaServer.serverId ? `&serverId=${mediaServer.serverId}` : ''
  const itemPath =
    mediaServer.type === 'jellyfin'
      ? `#!/details?id=${providerItemId}${serverIdParam}`
      : `#!/item?id=${providerItemId}${serverIdParam}`

  return `${mediaServer.baseUrl}/web/index.html${itemPath}`
}

