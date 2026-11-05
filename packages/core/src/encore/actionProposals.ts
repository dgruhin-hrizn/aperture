import { createHash } from 'node:crypto'
import { query, queryOne } from '../lib/db.js'
import {
  actionInput,
  encoreServer,
  getEncoreCollection,
  type EncoreAction,
  type EncoreCollection,
} from './collectionTypes.js'
import { resolveEncoreItems } from './liveItems.js'
import type { z } from 'zod'
export async function listEncoreActions(userId: string) {
  const [collections, actions] = await Promise.all([
    query<EncoreCollection>(
      'SELECT id,name,server_id,provider_playlist_id,section_id,baseline,manual_exclusions,revision FROM encore_collections WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50',
      [userId]
    ),
    query<EncoreAction>(
      'SELECT id,collection_id,operation,status,payload,receipt,error,updated_at FROM encore_actions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50',
      [userId]
    ),
  ])
  return { kind: 'actions' as const, collections: collections.rows, actions: actions.rows }
}
export async function proposeEncoreAction(userId: string, input: z.infer<typeof actionInput>) {
  const data = actionInput.parse(input),
    { serverId } = await encoreServer(userId)
  const preview = 'items' in data ? await resolveEncoreItems(userId, data.items, true) : []
  if (preview.some((i) => i.reason === 'unavailable'))
    throw new Error('One or more selected items are unavailable')
  let collection: EncoreCollection
  if (data.operation === 'create') {
    collection = (await queryOne<EncoreCollection>(
      `INSERT INTO encore_collections(user_id,name,server_id) VALUES ($1,$2,$3)
      ON CONFLICT(user_id,server_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING *`,
      [userId, data.name, serverId]
    ))!
    if (collection.provider_playlist_id)
      throw new Error('This managed collection already exists. Propose an update instead.')
  } else collection = await getEncoreCollection(userId, data.collectionId)
  if (collection.server_id !== serverId)
    throw new Error('This collection belongs to a different Emby server')
  const payload = {
    items: 'items' in data ? data.items : undefined,
    preview: preview.map((i) => ({ title: i.title, providerId: i.providerId })),
    revision: collection.revision,
  }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ collection: collection.id, operation: data.operation, payload }))
    .digest('hex')
  const action = await queryOne<EncoreAction>(
    `INSERT INTO encore_actions(user_id,collection_id,operation,fingerprint,payload) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(user_id,fingerprint) DO UPDATE SET fingerprint=EXCLUDED.fingerprint RETURNING id,collection_id,operation,status,payload,receipt,error,updated_at`,
    [userId, collection.id, data.operation, fingerprint, JSON.stringify(payload)]
  )
  return { kind: 'actionProposal' as const, action: action!, collection, requiresApproval: true }
}
export async function cancelEncoreAction(userId: string, id: string) {
  if (
    !(
      await query(
        "UPDATE encore_actions SET status='cancelled',updated_at=now() WHERE user_id=$1 AND id=$2 AND status='proposed'",
        [userId, id]
      )
    ).rowCount
  )
    throw new Error('Only a pending proposal can be cancelled')
  return { kind: 'actionCancelled' as const, id }
}

export async function getEncoreActionResult(userId: string, id: string) {
  const action = await queryOne<EncoreAction>(
    'SELECT id,collection_id,operation,status,payload,receipt,error,updated_at FROM encore_actions WHERE id=$1 AND user_id=$2',
    [id, userId]
  )
  if (!action) throw new Error('Action not found')
  return {
    kind: action.status === 'succeeded' ? ('actionReceipt' as const) : ('actionProposal' as const),
    action,
    collection: await getEncoreCollection(userId, action.collection_id),
  }
}
