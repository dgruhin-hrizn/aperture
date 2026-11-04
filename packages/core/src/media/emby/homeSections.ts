import { isDeepStrictEqual } from 'node:util'
import type { EmbyProvider } from './EmbyProvider.js'
import { getVisibleRecommendationItems } from './recommendationAccess.js'

interface HomeSection {
  Id: string
  ParentId?: string
  SectionType: string
  CustomName?: string
}

export class EmbyHomeConflict extends Error {}

export function getEmbyHomeSections(provider: EmbyProvider, token: string, userId: string) {
  return provider.fetch<HomeSection[]>(`/Users/${encodeURIComponent(userId)}/HomeSections`, token)
}

export async function removeEmbyHomePin(
  provider: EmbyProvider,
  token: string,
  userId: string,
  playlistId: string,
  sectionId: string
): Promise<void> {
  const before = await getEmbyHomeSections(provider, token, userId)
  const section = before.find((row) => row.Id === sectionId)
  if (!section) return
  if (section.SectionType !== 'playlist' || section.ParentId !== playlistId) {
    throw new EmbyHomeConflict('This shelf was changed in Emby. Manage it directly in Emby Home settings.')
  }

  await provider.fetch(`/Users/${encodeURIComponent(userId)}/HomeSections/Delete`, token, {
    method: 'POST',
    body: JSON.stringify({ Ids: [sectionId] }),
  })
  const after = await getEmbyHomeSections(provider, token, userId)
  if (!isDeepStrictEqual(after, before.filter((row) => row.Id !== sectionId))) {
    throw new EmbyHomeConflict('Emby Home changed during unpinning. Refresh to see the current sections.')
  }
}

export async function addEmbyHomePin(
  provider: EmbyProvider,
  token: string,
  apiKey: string,
  userId: string,
  playlistId: string,
  name: string
): Promise<string> {
  const owned = await getVisibleRecommendationItems(provider, token, userId, [playlistId], 'Playlist')
  if (!owned.has(playlistId)) throw new EmbyHomeConflict('This playlist is no longer available in Emby.')
  const otherUsers = (await provider.getUsers(apiKey)).filter(
    (user) => user.id !== userId && !user.isDisabled && !user.isAdmin
  )
  for (let offset = 0; offset < otherUsers.length; offset += 5) {
    const visible = await Promise.all(otherUsers.slice(offset, offset + 5).map(
      (user) => getVisibleRecommendationItems(provider, apiKey, user.id, [playlistId], 'Playlist')
    ))
    if (visible.some((items) => items.has(playlistId))) {
      throw new EmbyHomeConflict('Only private AI Picks playlists can be pinned.')
    }
  }

  const before = await getEmbyHomeSections(provider, token, userId)
  if (before.some((row) => row.SectionType === 'playlist' && row.ParentId === playlistId)) {
    throw new EmbyHomeConflict('This playlist already has a shelf. Manage that shelf directly in Emby.')
  }
  const path = `/Users/${encodeURIComponent(userId)}/HomeSections`
  await provider.fetch(path, token, {
    method: 'POST',
    body: JSON.stringify({ SectionType: 'playlist', ParentId: playlistId, CustomName: name }),
  })

  const after = await getEmbyHomeSections(provider, token, userId)
  const oldIds = new Set(before.map((row) => row.Id))
  const added = after.filter((row) => row.Id && !oldIds.has(row.Id)
    && row.SectionType === 'playlist' && row.ParentId === playlistId && row.CustomName === name)
  if (added.length !== 1) throw new EmbyHomeConflict('Could not identify the new Emby shelf. Check Emby Home before trying again.')
  if (!isDeepStrictEqual(after.filter((row) => row.Id !== added[0].Id), before)) {
    await removeEmbyHomePin(provider, token, userId, playlistId, added[0].Id)
    throw new EmbyHomeConflict('Emby Home changed during pinning. The new shelf was removed.')
  }
  return added[0].Id
}
