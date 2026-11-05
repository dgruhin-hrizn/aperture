import { transaction } from '../lib/db.js'
import { encoreServer,getEncoreCollection,type EncoreAction } from './collectionTypes.js'
import { mediaRequest } from './access.js'
export async function reconcileEncoreCreation(userId:string,actionId:string,playlistUrl:string) {
  const url=new URL(playlistUrl),hashQuery=url.hash.split('?')[1]
  const id=url.searchParams.get('id')??new URLSearchParams(hashQuery).get('id')
  if(!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw new Error('Paste an Emby playlist details link containing its item ID')
  const {account,serverId}=await encoreServer(userId)
  return transaction(async db=>{
    const action=(await db.query<EncoreAction>('SELECT * FROM encore_actions WHERE id=$1 AND user_id=$2 FOR UPDATE',[actionId,userId])).rows[0]
    if(!action || action.operation!=='create' || action.status!=='unknown')throw new Error('Only an unknown creation can be reconciled')
    const collection=await getEncoreCollection(userId,action.collection_id)
    if(collection.provider_playlist_id || collection.server_id!==serverId)throw new Error('This collection is already tracked or belongs to another server')
    const data=await mediaRequest<{Items:Array<{Id:string;Name:string;Type:string;CanManageAccess?:boolean}>}>(account,`/Users/${encodeURIComponent(account.provider_user_id)}/Items?${new URLSearchParams({Ids:id,Recursive:'true',IncludeItemTypes:'Playlist',Limit:'10'})}`)
    const playlist=data.Items?.find(item=>item.Id===id && item.Type==='Playlist' && item.Name===collection.name)
    if(!playlist?.CanManageAccess)throw new Error('The matching playlist must be visible and managed by your Emby account')
    await db.query('UPDATE encore_collections SET provider_playlist_id=$3,updated_at=now() WHERE id=$1 AND user_id=$2',[collection.id,userId,id])
    await db.query("UPDATE encore_actions SET status='failed',error=NULL,updated_at=now() WHERE id=$1 AND user_id=$2",[actionId,userId])
    return {kind:'actionProposal' as const,action:{...action,status:'failed' as const,error:null},collection:{...collection,provider_playlist_id:id}}
  })
}
