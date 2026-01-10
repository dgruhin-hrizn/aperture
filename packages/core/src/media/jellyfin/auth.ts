/**
 * Jellyfin Authentication Module
 */

import type { AuthResult } from '../types.js'
import type { JellyfinAuthResponse, JellyfinSystemInfo } from './types.js'
import type { JellyfinProviderBase } from './base.js'

export async function authenticateByName(
  provider: JellyfinProviderBase,
  username: string,
  password: string
): Promise<AuthResult> {
  const url = `${provider.baseUrl}/Users/AuthenticateByName`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: provider.getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Username: username,
      Pw: password,
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid username or password')
    }
    throw new Error(`Authentication failed: ${response.status}`)
  }

  const data = (await response.json()) as JellyfinAuthResponse

  return {
    userId: data.User.Id,
    accessToken: data.AccessToken,
    userName: data.User.Name,
    isAdmin: data.User.Policy.IsAdministrator,
    serverId: data.User.ServerId,
  }
}

export async function getServerInfo(
  provider: JellyfinProviderBase,
  apiKey: string
): Promise<{ id: string; name: string; version: string }> {
  const data = await provider.fetch<JellyfinSystemInfo>('/System/Info', apiKey)
  return {
    id: data.Id,
    name: data.ServerName,
    version: data.Version,
  }
}



