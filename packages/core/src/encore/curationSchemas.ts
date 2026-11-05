import { z } from 'zod'
import { Temporal } from '@js-temporal/polyfill'
export const curationRecipe = z
  .object({
    mediaType: z.enum(['movies', 'episodes']).default('movies'),
    concept: z.string().trim().min(3).max(500).optional(),
    genre: z.string().trim().min(1).max(80).optional(),
    maxRuntime: z.number().int().min(10).max(480).optional(),
    minRating: z.number().min(0).max(10).optional(),
    excludeWatched: z.boolean().default(true),
    limit: z.number().int().min(1).max(30).default(10),
    seriesId: z.string().uuid().optional(),
    seriesName: z.string().max(200).optional(),
  })
  .refine(
    (data) => data.mediaType !== 'episodes' || Boolean(data.seriesId),
    'Episode curation requires an exact accessible series'
  )
  .refine(
    (data) => data.mediaType !== 'episodes' || !data.concept,
    'Episode curation uses an exact show and filters; mood search is supported for movies'
  )
export const curationSchedule = z.object({
  cadence: z.enum(['daily', 'weekly']),
  day: z.number().int().min(1).max(7).default(5),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(80),
})
export const curationInput = z.object({
  name: z.string().trim().min(1).max(100),
  collectionId: z.string().uuid(),
  recipe: curationRecipe,
  schedule: curationSchedule,
})
export type CurationRecipe = z.infer<typeof curationRecipe>
export type CurationSchedule = z.infer<typeof curationSchedule>
export interface EncoreCuration {
  id: string
  user_id: string
  collection_id: string
  name: string
  recipe: CurationRecipe
  schedule: CurationSchedule
  enabled: boolean
  revision: number
  source: string
  source_id: string | null
  next_run_at: string | null
  last_run_at: string | null
  last_error: string | null
  lease_id: string | null
  lease_expires_at: string | null
}
export interface CurationRun {
  id: string
  curation_id: string
  scheduled_for: string
  status: 'running' | 'succeeded' | 'failed'
  action_id: string | null
  result: Record<string, unknown> | null
  error: string | null
  attempts: number
  started_at: string
  finished_at: string | null
}
export function nextEncoreCurationRun(schedule: CurationSchedule, after = new Date()): string {
  const data = curationSchedule.parse(schedule),
    now = Temporal.Instant.from(after.toISOString()),
    local = now.toZonedDateTimeISO(data.timezone)
  for (let offset = 0; offset <= 14; offset++) {
    const date = local.toPlainDate().add({ days: offset })
    if (data.cadence === 'weekly' && date.dayOfWeek !== data.day) continue
    // Recurring wall-clock schedules use compatible DST resolution: spring shift forward; first fall occurrence.
    const at = date
      .toPlainDateTime(Temporal.PlainTime.from(data.time))
      .toZonedDateTime(data.timezone, { disambiguation: 'compatible' })
      .toInstant()
    if (Temporal.Instant.compare(at, now) > 0) return at.toString()
  }
  throw new Error('Cannot determine the next curation time')
}
