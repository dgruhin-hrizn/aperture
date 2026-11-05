import { getCatalogScope } from './access.js'
import { encoreCatalogScope, queryOne as scopedOne } from './scopedDb.js'
import { query, queryOne, transaction } from '../lib/db.js'
import {
  curationInput,
  nextEncoreCurationRun,
  type EncoreCuration,
  type CurationRun,
} from './curationSchemas.js'
import { getEncoreCollection, encoreServer } from './collectionTypes.js'
import { requireEncoreScope, ENCORE_SCOPES, type EncoreScope } from './permissions.js'
import type { ToolContext } from './types.js'
import type { z } from 'zod'
export function requireCurationScopes(scopes: readonly EncoreScope[]) {
  for (const scope of [
    'curation:write',
    'playlists:write',
    'library:read',
    'profile:read',
  ] as const)
    requireEncoreScope(scopes, scope)
}
export async function listEncoreCurations(userId: string) {
  const [curations, runs] = await Promise.all([
    query<EncoreCuration>(
      'SELECT * FROM encore_curations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 20',
      [userId]
    ),
    query<CurationRun>(
      'SELECT r.* FROM encore_curation_runs r JOIN encore_curations c ON c.id=r.curation_id WHERE c.user_id=$1 ORDER BY r.started_at DESC LIMIT 60',
      [userId]
    ),
  ])
  return { kind: 'curations' as const, curations: curations.rows, runs: runs.rows }
}
export async function prepareEncoreCuration(
  ctx: ToolContext,
  input: z.infer<typeof curationInput>,
  scopes: readonly EncoreScope[] = ENCORE_SCOPES,
  id?: string,
  revision?: number
) {
  requireCurationScopes(scopes)
  const data = curationInput.parse(input),
    collection = await getEncoreCollection(ctx.userId, data.collectionId),
    { serverId } = await encoreServer(ctx.userId)
  if (!collection.provider_playlist_id || collection.server_id !== serverId)
    throw new Error('Choose an existing managed playlist on the current Emby server')
  if (data.recipe.mediaType === 'episodes') {
    const series = await encoreCatalogScope.run(await getCatalogScope(ctx.userId), () =>
      scopedOne<{ title: string }>('SELECT title FROM series WHERE id=$1', [data.recipe.seriesId])
    )
    if (!series) throw new Error('The selected series is not currently accessible')
    data.recipe.seriesName = series.title
  }
  nextEncoreCurationRun(data.schedule)
  const curation = await transaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `encore-curations:${ctx.userId}`,
    ])
    if (
      !id &&
      Number(
        (
          await db.query<{ count: string }>(
            'SELECT count(*) FROM encore_curations WHERE user_id=$1',
            [ctx.userId]
          )
        ).rows[0].count
      ) >= 20
    )
      throw new Error('Twenty recurring rules is the current account limit')
    if (id) {
      const result = await db.query<EncoreCuration>(
        `UPDATE encore_curations SET name=$4,collection_id=$5,recipe=$6,schedule=$7,enabled=false,next_run_at=NULL,revision=revision+1,
        source=$8,source_id=$9,lease_id=NULL,lease_expires_at=NULL,updated_at=now() WHERE user_id=$1 AND id=$2 AND revision=$3 RETURNING *`,
        [
          ctx.userId,
          id,
          revision,
          data.name,
          data.collectionId,
          JSON.stringify(data.recipe),
          JSON.stringify(data.schedule),
          ctx.source ?? 'encore',
          ctx.sourceId ?? null,
        ]
      )
      if (!result.rows[0]) throw new Error('This rule changed. Refresh before editing.')
      return result.rows[0]
    }
    const existing = (
      await db.query<EncoreCuration>(
        'SELECT * FROM encore_curations WHERE user_id=$1 AND collection_id=$2',
        [ctx.userId, data.collectionId]
      )
    ).rows[0]
    if (existing)
      throw new Error('This playlist already has a curation rule. Edit that rule instead.')
    return (
      await db.query<EncoreCuration>(
        'INSERT INTO encore_curations(user_id,collection_id,name,recipe,schedule,source,source_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [
          ctx.userId,
          data.collectionId,
          data.name,
          JSON.stringify(data.recipe),
          JSON.stringify(data.schedule),
          ctx.source ?? 'encore',
          ctx.sourceId ?? null,
        ]
      )
    ).rows[0]
  })
  return { kind: 'curation' as const, curation, requiresOptIn: true }
}
export async function controlEncoreCuration(
  ctx: ToolContext,
  id: string,
  operation: 'enable' | 'pause' | 'run' | 'delete',
  scopes: readonly EncoreScope[] = ENCORE_SCOPES
) {
  requireCurationScopes(scopes)
  const curation = await queryOne<EncoreCuration>(
    'SELECT * FROM encore_curations WHERE id=$1 AND user_id=$2',
    [id, ctx.userId]
  )
  if (!curation) throw new Error('Curation rule not found')
  if (operation === 'delete') {
    await query('DELETE FROM encore_curations WHERE id=$1 AND user_id=$2', [id, ctx.userId])
    return { kind: 'curationDeleted' as const, id }
  }
  if (operation === 'run' && !curation.enabled)
    throw new Error('Enable this rule before running it')
  const next =
    operation === 'pause'
      ? null
      : operation === 'run'
        ? new Date().toISOString()
        : nextEncoreCurationRun(curation.schedule)
  if (operation !== 'pause') await encoreServer(ctx.userId)
  const result = await queryOne<EncoreCuration>(
    `UPDATE encore_curations SET enabled=$3,next_run_at=$4,revision=revision+1,source=$5,source_id=$6,
    lease_id=NULL,lease_expires_at=NULL,last_error=NULL,updated_at=now() WHERE id=$1 AND user_id=$2 AND revision=$7 RETURNING *`,
    [
      id,
      ctx.userId,
      operation !== 'pause',
      next,
      ctx.source ?? 'encore',
      ctx.sourceId ?? null,
      curation.revision,
    ]
  )
  if (!result) throw new Error('This rule changed. Refresh and retry.')
  return { kind: 'curation' as const, curation: result }
}
export async function validateCurationAuthority(curation: EncoreCuration) {
  if (curation.source !== 'mcp') return
  const valid = await queryOne(
    'SELECT id FROM encore_mcp_connections WHERE id::text=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>now() AND scopes @> $3::text[]',
    [
      curation.source_id,
      curation.user_id,
      ['curation:write', 'playlists:write', 'library:read', 'profile:read'],
    ]
  )
  if (!valid)
    throw new Error(
      'The MCP connection authorizing this rule expired, was revoked, or lost required scopes. Re-enable the rule in Encore to authorize it directly.'
    )
}
