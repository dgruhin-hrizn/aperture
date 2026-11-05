import type { UIMessage } from 'ai'
import { query, queryOne } from '../../lib/db.js'

export interface StoredMessage {
  id: string
  message_key?: string
  role: string
  content: string
  parts?: UIMessage['parts'] | null
  tool_invocations?: Array<{ toolCallId: string; toolName: string; args: unknown; result?: unknown }> | null
}

/** Upgrade old rows once at the boundary; new rows preserve interleaved text and tools. */
export function decodeMessage(row: StoredMessage): UIMessage {
  const parts: UIMessage['parts'] = row.parts ?? [
    ...(row.content ? [{ type: 'text' as const, text: row.content }] : []),
    ...(row.tool_invocations ?? []).map((call) => ({
      type: 'dynamic-tool' as const, toolName: call.toolName, toolCallId: call.toolCallId,
      state: 'output-available' as const, input: call.args, output: call.result ?? null,
    })),
  ]
  return { id: row.message_key ?? row.id, role: row.role === 'user' ? 'user' : 'assistant', parts }
}

export async function loadMessages(conversationId: string): Promise<UIMessage[]> {
  const { rows } = await query<StoredMessage>(
    `SELECT * FROM (SELECT * FROM assistant_messages WHERE conversation_id = $1
     ORDER BY created_at DESC, id DESC LIMIT 80) recent ORDER BY created_at, id`, [conversationId])
  return rows.map(decodeMessage)
}

export async function saveMessage(conversationId: string, message: UIMessage): Promise<void> {
  const text = message.parts.filter((part) => part.type === 'text').map((part) => part.text).join('\n')
  await query(
    `INSERT INTO assistant_messages(conversation_id, message_key, role, content, parts)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (conversation_id, message_key) DO UPDATE SET content = EXCLUDED.content, parts = EXCLUDED.parts`,
    [conversationId, message.id, message.role, text, JSON.stringify(message.parts)])
  await query(`UPDATE assistant_conversations SET updated_at = now(),
    title = CASE WHEN title = 'New Chat' AND $2 = 'user' THEN LEFT($3, 60) ELSE title END
    WHERE id = $1`, [conversationId, message.role, text])
}

export async function claimRun(conversationId: string, userId: string, runId: string): Promise<boolean> {
  return !!await queryOne(`UPDATE assistant_conversations SET active_run_id = $3,
    run_expires_at = now() + interval '4 minutes' WHERE id = $1 AND user_id = $2
    AND (active_run_id IS NULL OR run_expires_at < now()) RETURNING id`, [conversationId, userId, runId])
}

export async function releaseRun(conversationId: string, runId: string): Promise<void> {
  await query(`UPDATE assistant_conversations SET active_run_id = NULL, run_expires_at = NULL
    WHERE id = $1 AND active_run_id = $2`, [conversationId, runId])
}
