import { mediaRequest, type EncoreAccount } from './access.js'
import type { LiveItem } from './liveItems.js'
/** Preserve user additions and removals while reconciling the last managed set. */
export function reconcileEncoreMembership(current:string[],baseline:string[],desired:string[]) {
  const old=new Set(baseline), next=new Set(desired), now=new Set(current)
  const manuallyRemoved=new Set(baseline.filter(id=>!now.has(id)))
  const remove=current.filter(id=>old.has(id) && !next.has(id))
  const add=desired.filter(id=>!now.has(id) && !manuallyRemoved.has(id))
  return {remove,add,target:[...current.filter(id=>!remove.includes(id)),...add],manualAdditions:current.filter(id=>!old.has(id)),manualRemovals:[...manuallyRemoved]}
}
export async function readEncorePlaylist(account:EncoreAccount,playlistId:string) {
  const data=await mediaRequest<{Items:LiveItem[];TotalRecordCount?:number}>(account,`/Playlists/${encodeURIComponent(playlistId)}/Items?UserId=${encodeURIComponent(account.provider_user_id)}&Limit=1000`)
  if(!Array.isArray(data.Items) || (data.TotalRecordCount??data.Items.length)>1000) throw new Error('The playlist cannot be reconciled safely within the supported bound')
  return data.Items
}
export async function syncEncorePlaylist(account:EncoreAccount,playlistId:string,baseline:string[],desired:string[]) {
  const before=await readEncorePlaylist(account,playlistId)
  const diff=reconcileEncoreMembership(before.map(i=>i.Id),baseline,desired)
  const entryIds=before.filter(i=>diff.remove.includes(i.Id)).map(i=>i.PlaylistItemId)
  if(entryIds.some(id=>!id)) throw new Error('Emby did not return playlist entry identifiers')
  if(entryIds.length) await mediaRequest(account,`/Playlists/${encodeURIComponent(playlistId)}/Items?${new URLSearchParams({EntryIds:entryIds.join(',')})}`,{method:'DELETE'})
  // Re-read after removal. If an append succeeded before an interrupted run, don't append it twice.
  const current=await readEncorePlaylist(account,playlistId),present=new Set(current.map(i=>i.Id))
  const add=diff.add.filter(id=>!present.has(id))
  if(add.length) await mediaRequest(account,`/Playlists/${encodeURIComponent(playlistId)}/Items?${new URLSearchParams({Ids:add.join(','),UserId:account.provider_user_id})}`,{method:'POST'})
  const after=await readEncorePlaylist(account,playlistId),actual=after.map(i=>i.Id)
  if(diff.target.some(id=>!actual.includes(id)) || diff.remove.some(id=>actual.includes(id))) throw new Error('Playlist membership changed during the operation. Review Emby before retrying.')
  return {...diff,itemCount:after.length,providerIds:actual}
}
