import { z } from 'zod'
import { queryOne } from '../lib/db.js'
import { getEncoreAccount, mediaRequest } from './access.js'
import { getMediaServerConfig } from '../settings/systemSettings.js'
export const selectionSchema=z.array(z.object({id:z.string().uuid(),type:z.enum(['movie','episode'])})).min(1).max(50)
export const actionInput=z.discriminatedUnion('operation',[
  z.object({operation:z.literal('create'),name:z.string().trim().min(1).max(100),items:selectionSchema}),
  z.object({operation:z.literal('update'),collectionId:z.string().uuid(),items:selectionSchema}),
  z.object({operation:z.enum(['pin','unpin']),collectionId:z.string().uuid()}),
])
export interface EncoreCollection {id:string;name:string;server_id:string;provider_playlist_id:string|null;section_id:string|null;baseline:string[];revision:number}
export interface EncoreAction {id:string;collection_id:string;operation:'create'|'update'|'pin'|'unpin';status:'proposed'|'running'|'succeeded'|'failed'|'unknown'|'cancelled';payload:{items?:Array<{id:string;type:'movie'|'episode'}>;preview?:Array<{title:string;providerId:string}>;revision:number};receipt:Record<string,unknown>|null;error:string|null;updated_at:string}
export async function getEncoreCollection(userId:string,id:string) {
  const row=await queryOne<EncoreCollection>('SELECT id,name,server_id,provider_playlist_id,section_id,baseline,revision FROM encore_collections WHERE user_id=$1 AND id=$2',[userId,id])
  if(!row) throw new Error('Managed collection not found')
  return row
}
export async function encoreServer(userId:string) {
  const account=await getEncoreAccount(userId), config=await getMediaServerConfig()
  if(account.provider!=='emby') throw new Error('Managed playlist and Home operations currently require Emby')
  const info=await mediaRequest<{Id?:string}>(account,'/System/Info/Public')
  if(!info.Id) throw new Error('Cannot identify this Emby server')
  return {account,config,serverId:info.Id}
}
