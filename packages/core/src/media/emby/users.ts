/**
 * Emby Users Module
 */

import type { MediaServerUser } from '../types.js'
import type { EmbyUser } from './types.js'
import type { EmbyProviderBase } from './base.js'

// Helper to check if a string looks like an email
function isValidEmail(str: string | undefined): boolean {
  if (!str) return false
  // Basic email validation - must contain @ and have text before and after
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)
}

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
    // ConnectUserName is the Emby Connect username - only use if it looks like an email
    // Note: Emby does NOT expose actual email addresses via API for privacy reasons
    email: isValidEmail(user.ConnectUserName) ? user.ConnectUserName : undefined,
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
    // Only use ConnectUserName if it looks like an email
    email: isValidEmail(user.ConnectUserName) ? user.ConnectUserName : undefined,
  }
}



