/**
 * Emby Users Module
 */

import type { MediaServerUser } from '../types.js'
import type { EmbyUser } from './types.js'
import type { EmbyProviderBase } from './base.js'

export async function getUsers(
  provider: EmbyProviderBase,
  apiKey: string
): Promise<MediaServerUser[]> {
  const users = await provider.fetch<EmbyUser[]>('/Users', apiKey)

  return users.map((user) => ({
    id: user.Id,
    name: user.Name,
    serverId: user.ServerId,
    isAdmin: user.Policy.IsAdministrator,
    isDisabled: user.Policy.IsDisabled,
    lastActivityDate: user.LastActivityDate,
    primaryImageTag: user.PrimaryImageTag,
    maxParentalRating: user.Policy.MaxParentalRating,
  }))
}

export async function getUserById(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string
): Promise<MediaServerUser> {
  const user = await provider.fetch<EmbyUser>(`/Users/${userId}`, apiKey)

  return {
    id: user.Id,
    name: user.Name,
    serverId: user.ServerId,
    isAdmin: user.Policy.IsAdministrator,
    isDisabled: user.Policy.IsDisabled,
    lastActivityDate: user.LastActivityDate,
    primaryImageTag: user.PrimaryImageTag,
    maxParentalRating: user.Policy.MaxParentalRating,
  }
}

