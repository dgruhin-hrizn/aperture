import { query, queryOne } from '../lib/db.js'
import { resolveEncoreItems } from './liveItems.js'
import { packViewingWindows, planInput } from './planScheduling.js'
import type { z } from 'zod'
export interface EncorePlan {
  id: string
  name: string
  status: 'draft' | 'saved'
  revision: number
  input: z.infer<typeof planInput>
  schedule: ReturnType<typeof packViewingWindows>
  updated_at: string
}
const columns = 'id,name,status,revision,input,schedule,updated_at'
export async function listEncorePlans(userId: string) {
  return {
    kind: 'plans' as const,
    plans: (
      await query<EncorePlan>(
        `SELECT ${columns} FROM encore_watch_plans WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50`,
        [userId]
      )
    ).rows,
  }
}
export async function getEncorePlan(userId: string, id: string) {
  const plan = await queryOne<EncorePlan>(
    `SELECT ${columns} FROM encore_watch_plans WHERE user_id=$1 AND id=$2`,
    [userId, id]
  )
  if (!plan) throw new Error('Watch plan not found')
  return plan
}
export async function createEncorePlan(userId: string, input: z.infer<typeof planInput>) {
  const data = planInput.parse(input),
    candidates = await resolveEncoreItems(userId, data.items, data.allowRewatch)
  const schedule = packViewingWindows(data, candidates)
  const row = await queryOne<EncorePlan>(
    `INSERT INTO encore_watch_plans(user_id,name,input,schedule) VALUES ($1,$2,$3,$4) RETURNING ${columns}`,
    [userId, data.name, JSON.stringify(data), JSON.stringify(schedule)]
  )
  return { kind: 'watchPlan' as const, plan: row! }
}
export async function updateEncorePlan(
  userId: string,
  id: string,
  revision: number,
  operation: 'save' | 'refresh',
  input?: z.infer<typeof planInput>
) {
  const existing = await getEncorePlan(userId, id)
  const data = planInput.parse(input ?? existing.input)
  // Saving rechecks runtime, progress and permissions rather than endorsing a stale draft.
  const schedule = packViewingWindows(
    data,
    await resolveEncoreItems(userId, data.items, data.allowRewatch)
  )
  const plan = await queryOne<EncorePlan>(
    `UPDATE encore_watch_plans SET name=$4,input=$5,schedule=$6,status=$7,revision=revision+1,updated_at=now()
    WHERE user_id=$1 AND id=$2 AND revision=$3 RETURNING ${columns}`,
    [
      userId,
      id,
      revision,
      data.name,
      JSON.stringify(data),
      JSON.stringify(schedule),
      operation === 'save' ? 'saved' : 'draft',
    ]
  )
  if (!plan) throw new Error('This plan changed. Refresh before editing it.')
  return { kind: 'watchPlan' as const, plan }
}
export async function deleteEncorePlan(userId: string, id: string) {
  if (
    !(await query('DELETE FROM encore_watch_plans WHERE user_id=$1 AND id=$2', [userId, id]))
      .rowCount
  )
    throw new Error('Watch plan not found')
  return { kind: 'planDeleted' as const, id }
}
