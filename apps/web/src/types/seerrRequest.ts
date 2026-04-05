/** Optional fields forwarded to POST /api/seerr/request (Seerr POST /request). */
export interface SeerrRequestOptions {
  rootFolder?: string
  profileId?: number
  serverId?: number
  languageProfileId?: number
  is4k?: boolean
}
