/**
 * Match Aperture user profile fields to Seerr users (GET /user).
 */
import type { SeerrUser } from './types.js'

export interface ApertureUserProfileForSeerr {
  email: string | null | undefined
  username: string
  displayName: string | null | undefined
  provider: 'emby' | 'jellyfin'
  providerUserId: string
}

/**
 * Pick the Seerr user id that best matches the Aperture profile, or null.
 * Order: email (case-insensitive), Jellyfin user id, username / jellyfinUsername / display name.
 */
export function matchApertureProfileToSeerrUser(
  profile: ApertureUserProfileForSeerr,
  seerrUsers: SeerrUser[]
): number | null {
  const emailNorm = (profile.email || '').trim().toLowerCase()
  const userNorm = profile.username.trim().toLowerCase()
  const displayNorm = (profile.displayName || '').trim().toLowerCase()

  if (emailNorm) {
    for (const u of seerrUsers) {
      const e = (u.email || '').trim().toLowerCase()
      if (e && emailNorm === e) return u.id
    }
  }

  if (profile.provider === 'jellyfin' && profile.providerUserId) {
    const pid = profile.providerUserId.trim()
    for (const u of seerrUsers) {
      if (u.jellyfinUserId != null && pid === String(u.jellyfinUserId).trim()) {
        return u.id
      }
    }
  }

  for (const u of seerrUsers) {
    const un = (u.username || '').trim().toLowerCase()
    const jn = (u.jellyfinUsername || '').trim().toLowerCase()
    if (userNorm && (userNorm === un || (jn && userNorm === jn))) return u.id
    if (displayNorm && (displayNorm === un || (jn && displayNorm === jn))) return u.id
  }

  return null
}
