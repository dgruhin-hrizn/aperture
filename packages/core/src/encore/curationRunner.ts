import { randomUUID } from 'node:crypto'
import { query, queryOne, transaction } from '../lib/db.js'
import { createEncoreContext } from './context.js'
import { getCatalogScope } from './access.js'
import { encoreCatalogScope } from './scopedDb.js'
import { selectEncoreCurationItems } from './curationSelection.js'
import { proposeEncoreAction, getEncoreActionResult } from './actionProposals.js'
import { executeEncoreAction } from './actions.js'
import { validateCurationAuthority } from './curations.js'
import { nextEncoreCurationRun, type EncoreCuration, type CurationRun } from './curationSchemas.js'

/** A persisted lease claims work across processes; a row lock makes pause/edit effective before mutation. */
export async function runDueEncoreCurations(
  options: { limit?: number; userId?: string; id?: string } = {}
) {
  const results: Array<{ id: string; status: string; error?: string }> = []
  for (let index = 0; index < Math.min(options.limit ?? 5, 20); index++) {
    const lease = randomUUID()
    const curation = await queryOne<EncoreCuration>(
      `WITH due AS (SELECT id FROM encore_curations WHERE enabled AND next_run_at<=now()
      AND (lease_id IS NULL OR lease_expires_at<now()) AND ($2::uuid IS NULL OR user_id=$2) AND ($3::uuid IS NULL OR id=$3)
      ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE encore_curations c SET lease_id=$1,lease_expires_at=now()+interval '5 minutes' FROM due WHERE c.id=due.id RETURNING c.*`,
      [lease, options.userId ?? null, options.id ?? null]
    )
    if (!curation) break
    const run = (await queryOne<CurationRun>(
      `INSERT INTO encore_curation_runs(curation_id,scheduled_for) VALUES($1,$2)
      ON CONFLICT(curation_id,scheduled_for) DO UPDATE SET attempts=encore_curation_runs.attempts+1,status='running',error=NULL,finished_at=NULL RETURNING *`,
      [curation.id, curation.next_run_at]
    ))!
    let status: 'succeeded' | 'failed' = 'failed',
      error: string | undefined,
      result: Record<string, unknown> | null = null
    try {
      await validateCurationAuthority(curation)
      const ctx = {
        ...(await createEncoreContext(curation.user_id)),
        source: 'curation' as const,
        sourceId: curation.id,
      }
      const catalog = await getCatalogScope(curation.user_id)
      const prior = run.action_id
        ? await getEncoreActionResult(curation.user_id, run.action_id)
        : null
      const selected =
        prior?.action.status === 'succeeded'
          ? []
          : await encoreCatalogScope.run(catalog, () =>
              selectEncoreCurationItems(ctx, curation.recipe)
            )
      if (!selected.length && prior?.action.status !== 'succeeded')
        throw new Error(
          'No eligible, currently available items matched. The playlist was left intact.'
        )
      result = await transaction(async (db) => {
        const current = (
          await db.query<EncoreCuration>('SELECT * FROM encore_curations WHERE id=$1 FOR UPDATE', [
            curation.id,
          ])
        ).rows[0]
        if (
          !current?.enabled ||
          current.lease_id !== lease ||
          current.revision !== curation.revision
        )
          throw new Error('This rule was paused or edited before its playlist update')
        await validateCurationAuthority(current)
        return encoreCatalogScope.run(catalog, async () => {
          if (prior?.action.status === 'succeeded')
            return {
              selected: (prior.action.payload.items ?? []).map((item, index) => ({
                id: item.id,
                title: prior.action.payload.preview?.[index]?.title ?? 'Managed title',
              })),
              actionId: prior.action.id,
              receipt: prior.action.receipt,
              recovered: true,
            }
          if (
            prior &&
            JSON.stringify(prior.action.payload.items) !==
              JSON.stringify(selected.map((item) => ({ id: item.id, type: item.type })))
          )
            throw new Error(
              'Eligibility changed after an interrupted update. Review its action receipt before resuming.'
            )
          let actionId = run.action_id
          if (!actionId) {
            const proposal = await proposeEncoreAction(curation.user_id, {
              operation: 'update',
              collectionId: curation.collection_id,
              items: selected.map((item) => ({ id: item.id, type: item.type })),
            })
            actionId = proposal.action.id
            // This survives a crash after Emby succeeds but before this run is marked finished.
            await query('UPDATE encore_curation_runs SET action_id=$2 WHERE id=$1', [
              run.id,
              actionId,
            ])
          }
          const receipt = await executeEncoreAction(curation.user_id, actionId)
          return {
            selected: selected.map((item) => ({ id: item.id, title: item.title })),
            actionId,
            receipt: receipt.action.receipt,
          }
        })
      })
      status = 'succeeded'
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Curation failed'
    }
    await query(
      'UPDATE encore_curation_runs SET status=$2,result=$3,error=$4,finished_at=now() WHERE id=$1',
      [run.id, status, result ? JSON.stringify(result) : null, error ?? null]
    )
    // Permission/provider failures pause the rule; no silent repeated costs or empty replacements.
    await query(
      `UPDATE encore_curations SET enabled=CASE WHEN $3='failed' THEN false ELSE enabled END,
      next_run_at=CASE WHEN $3='failed' THEN NULL ELSE $4::timestamptz END,last_run_at=now(),last_error=$5,lease_id=NULL,lease_expires_at=NULL,updated_at=now()
      WHERE id=$1 AND lease_id=$2 AND revision=$6`,
      [
        curation.id,
        lease,
        status,
        status === 'succeeded' ? nextEncoreCurationRun(curation.schedule) : null,
        error ?? null,
        curation.revision,
      ]
    )
    results.push({ id: curation.id, status, error })
  }
  return results
}
