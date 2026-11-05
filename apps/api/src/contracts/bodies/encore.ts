import { z } from 'zod'
import { ENCORE_READ_SCOPES, ENCORE_SCOPES } from '@aperture/core/encore'

export const chatBody = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(z.object({
    id: z.string().min(1).max(200), role: z.enum(['user', 'assistant']),
    // The chat handler accepts text from the last user message only; client tool history is ignored.
    parts: z.array(z.unknown()).max(100),
  })).max(100),
  trigger: z.string().optional(),
  timezone: z.string().max(80).default('UTC').refine(timeZone => {
    try { new Intl.DateTimeFormat('en', { timeZone }); return true } catch { return false }
  }, 'Invalid timezone'),
})
export const connectionBody = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(ENCORE_SCOPES)).min(1).default([...ENCORE_READ_SCOPES]),
  days: z.number().int().min(1).max(365).default(90),
})
export const approvalBody = z.object({ approved: z.literal(true) })
export const curationControlBody = approvalBody.extend({ operation: z.enum(['enable', 'pause', 'run', 'delete']) })
const title = z.string().trim().min(1).max(255)

export const encoreBodies = {
  'POST /api/assistant/chat': chatBody,
  'POST /api/assistant/connections': connectionBody,
  'POST /api/assistant/conversations': z.object({ title: title.optional() }).default({}),
  'PATCH /api/assistant/conversations/:id': z.object({ title }),
  'POST /api/assistant/curations/:id/control': curationControlBody,
  'POST /api/assistant/actions/:id/approve': approvalBody,
}
