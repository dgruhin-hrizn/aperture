import { ENCORE_SCOPES, requireEncoreScope, type EncoreScope } from './permissions.js'
import { getPool, query, queryOne, transaction } from '../lib/db.js'
import { mediaRequest } from './access.js'
import { encoreServer, getEncoreCollection, type EncoreAction } from './collectionTypes.js'
import { resolveEncoreItems } from './liveItems.js'
import { syncEncorePlaylist } from './collectionSync.js'
import { EmbyProvider } from '../media/emby/EmbyProvider.js'
import {
  addEmbyHomePin,
  removeEmbyHomePin,
  getEmbyHomeSections,
} from '../media/emby/homeSections.js'

/** Execute only an owned proposal explicitly approved in the native UI or MCP client. */
export async function executeEncoreAction(
  userId: string,
  actionId: string,
  scopes: readonly EncoreScope[] = ENCORE_SCOPES
) {
  const action = await queryOne<EncoreAction>(
    'SELECT id,collection_id,operation,status,payload,receipt,error,updated_at FROM encore_actions WHERE user_id=$1 AND id=$2',
    [userId, actionId]
  )
  if (!action) throw new Error('Action not found')
  requireEncoreScope(
    scopes,
    ['pin', 'unpin'].includes(action.operation) ? 'home:write' : 'playlists:write'
  )
  const client = await getPool().connect()
  let locked = false,
    createStarted = false
  try {
    locked = (
      await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(hashtextextended($1,0)) locked',
        [`encore-collection:${action.collection_id}`]
      )
    ).rows[0].locked
    if (!locked) throw new Error('This collection is already being changed')
    const latest = (
      await client.query<EncoreAction>('SELECT * FROM encore_actions WHERE user_id=$1 AND id=$2', [
        userId,
        actionId,
      ])
    ).rows[0]
    if (latest.status === 'succeeded')
      return {
        kind: 'actionReceipt' as const,
        action: latest,
        collection: await getEncoreCollection(userId, action.collection_id),
      }
    if (latest.status === 'cancelled') throw new Error('This proposal was cancelled')
    const collection = await getEncoreCollection(userId, action.collection_id),
      { account, config, serverId } = await encoreServer(userId)
    if (collection.server_id !== serverId) throw new Error('The configured Emby server changed')
    if (
      latest.operation === 'create' &&
      !collection.provider_playlist_id &&
      ['unknown', 'running'].includes(latest.status)
    )
      throw new Error(
        'The previous creation has an unknown outcome. Inspect Emby and reconcile its playlist ID before retrying.'
      )
    if (
      latest.operation === 'create' &&
      !collection.provider_playlist_id &&
      (await queryOne(
        "SELECT id FROM encore_actions WHERE collection_id=$1 AND user_id=$2 AND id<>$3 AND operation='create' AND status IN ('unknown','running') LIMIT 1",
        [collection.id, userId, actionId]
      ))
    )
      throw new Error(
        'An earlier creation has an unknown outcome. Reconcile it before creating another playlist.'
      )
    if (collection.revision !== latest.payload.revision)
      throw new Error('The collection changed since this proposal. Create a fresh proposal.')
    await query(
      "UPDATE encore_actions SET status='running',error=NULL,updated_at=now() WHERE id=$1 AND user_id=$2",
      [actionId, userId]
    )
    let providerId = collection.provider_playlist_id
    const provider = new EmbyProvider(config.baseUrl!)
    if (latest.operation === 'create' || latest.operation === 'update') {
      const selected = await resolveEncoreItems(userId, latest.payload.items ?? [], true)
      if (selected.some((i) => i.reason === 'unavailable'))
        throw new Error('An item in this proposal is no longer available')
      if (!providerId) {
        createStarted = true
        // Create empty as the signed-in user; persist the returned ID before any follow-up request.
        const created = await mediaRequest<{ Id?: string }>(
          account,
          `/Playlists?${new URLSearchParams({ Name: collection.name, UserId: account.provider_user_id, MediaType: 'Video', IsPublic: 'false' })}`,
          { method: 'POST' }
        )
        if (!created.Id) throw new Error('Emby did not return the new playlist identifier')
        providerId = created.Id
        await query(
          'UPDATE encore_collections SET provider_playlist_id=$3,updated_at=now() WHERE id=$1 AND user_id=$2',
          [collection.id, userId, providerId]
        )
      }
      if (latest.operation === 'create')
        await mediaRequest(account, `/Items/${encodeURIComponent(providerId)}/MakePrivate`, {
          method: 'POST',
        })
      const result = await syncEncorePlaylist(
        account,
        providerId,
        collection.baseline,
        selected.map((i) => i.providerId),
        collection.manual_exclusions ?? [],
        latest.intent,
        async (intent) => {
          await query(
            'UPDATE encore_actions SET intent=$3,updated_at=now() WHERE id=$1 AND user_id=$2 AND intent IS NULL',
            [actionId, userId, JSON.stringify(intent)]
          )
        }
      )
      const receipt = {
        operation: latest.operation,
        playlistId: providerId,
        ...result,
        completedAt: new Date().toISOString(),
      }
      await transaction(async (db) => {
        await db.query(
          'UPDATE encore_collections SET baseline=$3,manual_exclusions=$4,revision=revision+1,updated_at=now() WHERE id=$1 AND user_id=$2',
          [
            collection.id,
            userId,
            JSON.stringify(
              selected
                .map((i) => i.providerId)
                .filter(
                  (id) =>
                    !result.manualAdditions.includes(id) && !result.manualRemovals.includes(id)
                )
            ),
            JSON.stringify(result.manualRemovals),
          ]
        )
        await db.query(
          "UPDATE encore_actions SET status='succeeded',receipt=$3,updated_at=now() WHERE id=$1 AND user_id=$2",
          [actionId, userId, JSON.stringify(receipt)]
        )
      })
    } else {
      if (!providerId) throw new Error('Create this playlist before managing its Home row')
      let sectionId = collection.section_id
      if (latest.operation === 'pin') {
        // An interrupted pin can be recovered by its exact managed playlist/name match.
        const sections = await getEmbyHomeSections(
          provider,
          account.provider_access_token,
          account.provider_user_id
        )
        const matches = sections.filter(
          (s) =>
            s.SectionType === 'playlist' &&
            s.ParentId === providerId &&
            s.CustomName === collection.name
        )
        if (!sectionId && ['running', 'unknown'].includes(latest.status) && matches.length === 1)
          sectionId = matches[0].Id
        if (!sectionId)
          sectionId = await addEmbyHomePin(
            provider,
            account.provider_access_token,
            config.apiKey ?? '',
            account.provider_user_id,
            providerId,
            collection.name
          )
      } else if (sectionId) {
        await removeEmbyHomePin(
          provider,
          account.provider_access_token,
          account.provider_user_id,
          providerId,
          sectionId
        )
        sectionId = null
      }
      await transaction(async (db) => {
        await db.query(
          'UPDATE encore_collections SET section_id=$3,revision=revision+1,updated_at=now() WHERE id=$1 AND user_id=$2',
          [collection.id, userId, sectionId]
        )
        await db.query(
          "UPDATE encore_actions SET status='succeeded',receipt=$3,updated_at=now() WHERE id=$1 AND user_id=$2",
          [
            actionId,
            userId,
            JSON.stringify({
              operation: latest.operation,
              playlistId: providerId,
              sectionId,
              completedAt: new Date().toISOString(),
            }),
          ]
        )
      })
    }
    return {
      kind: 'actionReceipt' as const,
      action: (await queryOne<EncoreAction>(
        'SELECT * FROM encore_actions WHERE id=$1 AND user_id=$2',
        [actionId, userId]
      ))!,
      collection: await getEncoreCollection(userId, collection.id),
    }
  } catch (error) {
    if (locked) {
      const message = error instanceof Error ? error.message : 'Emby action failed'
      await query(
        "UPDATE encore_actions SET status=CASE WHEN $3 THEN 'unknown' WHEN status='running' AND operation='pin' THEN 'unknown' WHEN status='running' THEN 'failed' ELSE status END,error=$4,updated_at=now() WHERE id=$1 AND user_id=$2 AND status<>'succeeded'",
        [actionId, userId, createStarted, message]
      )
    }
    throw error
  } finally {
    if (locked)
      await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [
        `encore-collection:${action.collection_id}`,
      ])
    client.release()
  }
}
