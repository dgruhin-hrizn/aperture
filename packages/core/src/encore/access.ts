import { queryOne } from '../lib/db.js'
import { getMediaServerConfig } from '../settings/systemSettings.js'
import type { CatalogScope } from './scopedDb.js'

export interface EncoreAccount {
  id: string
  provider: 'emby' | 'jellyfin'
  provider_user_id: string
  provider_access_token: string
  is_enabled: boolean
  provider_disabled: boolean
}
export async function getEncoreAccount(userId: string): Promise<EncoreAccount> {
  const account = await queryOne<EncoreAccount>(
    'SELECT id, provider, provider_user_id, provider_access_token, is_enabled, provider_disabled FROM users WHERE id = $1',
    [userId]
  )
  if (!account?.is_enabled || account.provider_disabled)
    throw new Error('This Aperture account is disabled')
  if (!account.provider_access_token)
    throw new Error('Sign into Aperture with your media server before accessing your collection')
  return account
}
export async function mediaRequest<T>(
  account: EncoreAccount,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const config = await getMediaServerConfig()
  if (!config.baseUrl || config.type !== account.provider)
    throw new Error('The media server is unavailable')
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      'X-Emby-Token': account.provider_access_token,
    },
  })
  if (!response.ok) throw new Error(`Media server request failed (${response.status})`)
  const text = await response.text()
  return !text ? (undefined as T) : (JSON.parse(text) as T)
}

/** Exact IDs from the user's unparented server view include parental/item restrictions. */
export async function getCatalogScope(userId: string, signal?: AbortSignal): Promise<CatalogScope> {
  const account = await getEncoreAccount(userId)
  const deadline = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
    : AbortSignal.timeout(30_000)
  const scope: CatalogScope = { movieIds: [], seriesIds: [] }
  for (let offset = 0; offset < 200_000; offset += 1000) {
    deadline.throwIfAborted()
    const params = new URLSearchParams({
      Recursive: 'true',
      IncludeItemTypes: 'Movie,Series',
      EnableImages: 'false',
      EnableUserData: 'false',
      Limit: '1000',
      StartIndex: String(offset),
      SortBy: 'SortName',
    })
    const page = await mediaRequest<{
      Items: Array<{ Id: string; Type: string }>
      TotalRecordCount?: number
    }>(account, `/Users/${encodeURIComponent(account.provider_user_id)}/Items?${params}`, {
      signal: deadline,
    })
    if (!Array.isArray(page.Items))
      throw new Error('The media server did not return an explicit accessible catalog')
    for (const item of page.Items) {
      if (item.Type === 'Movie') scope.movieIds.push(item.Id)
      if (item.Type === 'Series') scope.seriesIds.push(item.Id)
    }
    if (
      page.Items.length < 1000 ||
      (page.TotalRecordCount !== undefined && offset + page.Items.length >= page.TotalRecordCount)
    )
      return scope
  }
  throw new Error('The accessible catalog exceeds the supported request bound')
}
