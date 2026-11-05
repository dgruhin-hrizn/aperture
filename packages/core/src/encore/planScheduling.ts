import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'
export const planInput = z.object({
  name: z.string().trim().min(1).max(100),
  timezone: z.string().min(1).max(80),
  windows: z
    .array(
      z.object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
        minutes: z.number().int().min(10).max(720),
      })
    )
    .min(1)
    .max(28),
  items: z
    .array(z.object({ id: z.string().uuid(), type: z.enum(['movie', 'episode']) }))
    .min(1)
    .max(50),
  breakMinutes: z.number().int().min(0).max(60).default(5),
  allowRewatch: z.boolean().default(false),
})
export interface PlanCandidate {
  id: string
  type: 'movie' | 'episode'
  title: string
  minutes: number | null
  providerId: string
  seriesId?: string
  order?: number
  reason?: string
}
export interface PlanSlot extends PlanCandidate {
  start: string
  end: string
}
export function packViewingWindows(input: z.infer<typeof planInput>, candidates: PlanCandidate[]) {
  const data = planInput.parse(input)
  const windows = data.windows
    .map((w) => {
      const start = Temporal.PlainDateTime.from(w.start)
        .toZonedDateTime(data.timezone, { disambiguation: 'reject' })
        .toInstant()
      return { start, end: start.add({ minutes: w.minutes }), minutes: w.minutes }
    })
    .sort((a, b) => Temporal.Instant.compare(a.start, b.start))
  for (let i = 1; i < windows.length; i++)
    if (Temporal.Instant.compare(windows[i].start, windows[i - 1].end) < 0)
      throw new Error('Viewing windows overlap')
  const ordered = [...candidates]
  // Reorder only entries belonging to the same show, preserving interleaved movie choices.
  for (const series of new Set(ordered.map((c) => c.seriesId).filter(Boolean))) {
    const episodes = ordered
      .filter((c) => c.seriesId === series)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    let next = 0
    for (let i = 0; i < ordered.length; i++)
      if (ordered[i].seriesId === series) ordered[i] = episodes[next++]
  }
  const placed = new Set<string>(),
    slots: PlanSlot[] = []
  for (const window of windows) {
    let cursor = window.start
    const blocked = new Set<string>()
    for (const item of ordered) {
      if (placed.has(item.id)) continue
      if (item.reason || !item.minutes || (item.seriesId && blocked.has(item.seriesId))) {
        if (item.seriesId) blocked.add(item.seriesId)
        continue
      }
      const end = cursor.add({ minutes: item.minutes })
      if (Temporal.Instant.compare(end, window.end) > 0) {
        if (item.seriesId) blocked.add(item.seriesId)
        continue
      }
      slots.push({ ...item, start: cursor.toString(), end: end.toString() })
      placed.add(item.id)
      cursor = end.add({ minutes: data.breakMinutes })
    }
  }
  return {
    timezone: data.timezone,
    slots,
    unplaced: ordered
      .filter((c) => !placed.has(c.id))
      .map((c) => ({ ...c, reason: c.reason ?? (!c.minutes ? 'unknownRuntime' : 'doesNotFit') })),
    checkedAt: new Date().toISOString(),
  }
}
export function watchPlanCalendar(id: string, name: string, slots: PlanSlot[]) {
  const escape = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const date = (value: string) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aperture//Encore//EN',
    'CALSCALE:GREGORIAN',
    ...slots.flatMap((slot) => [
      'BEGIN:VEVENT',
      `UID:${id}-${slot.id}@aperture`,
      `DTSTAMP:${date(new Date().toISOString())}`,
      `DTSTART:${date(slot.start)}`,
      `DTEND:${date(slot.end)}`,
      `SUMMARY:${escape(slot.title)}`,
      `DESCRIPTION:${escape(name)}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  // Fold by UTF-8 byte length without splitting Unicode code points.
  return (
    lines
      .map((line) => {
        let result = '',
          chunk = ''
        for (const char of line) {
          if (Buffer.byteLength(chunk + char) > 73) {
            result += chunk + '\r\n '
            chunk = ''
          }
          chunk += char
        }
        return result + chunk
      })
      .join('\r\n') + '\r\n'
  )
}
