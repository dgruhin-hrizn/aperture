/**
 * Jellyfin Users Module
 */

import type { MediaServerUser } from '../types.js'
import type { JellyfinUser } from './types.js'
import type { JellyfinProviderBase } from './base.js'

export async function getUsers(
  provider: JellyfinProviderBase,
  apiKey: string
): Promise<MediaServerUser[]> {
  const users = await provider.fetch<JellyfinUser[]>('/Users', apiKey)

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
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string
): Promise<MediaServerUser> {
  const user = await provider.fetch<JellyfinUser>(`/Users/${userId}`, apiKey)

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

