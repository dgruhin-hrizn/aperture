import { createHash, randomBytes } from 'node:crypto'
import { query, queryOne } from '../lib/db.js'
import { ENCORE_SCOPES, type EncoreScope } from './permissions.js'

export interface EncoreConnection { id: string; name: string; token_prefix: string; scopes: EncoreScope[]; expires_at: Date; created_at: Date; last_used_at: Date | null }
const columns = 'id, name, token_prefix, scopes, expires_at, created_at, last_used_at'
export function hashEncoreToken(token: string) { return createHash('sha256').update(token).digest('hex') }
export async function listEncoreConnections(userId: string): Promise<EncoreConnection[]> {
  return (await query<EncoreConnection>(`SELECT ${columns} FROM encore_mcp_connections WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`, [userId])).rows
}
export async function createEncoreConnection(userId: string, name: string, scopes: EncoreScope[], days: number) {
  if (!name.trim() || name.length > 80 || !scopes.length || scopes.some((s) => !ENCORE_SCOPES.includes(s)) || !Number.isInteger(days) || days < 1 || days > 365) throw new Error('Invalid connection configuration')
  const token = `apmcp_${randomBytes(32).toString('base64url')}`
  const connection = await queryOne<EncoreConnection>(`INSERT INTO encore_mcp_connections(user_id, name, token_hash, token_prefix, scopes, expires_at)
    SELECT id, $2, $3, $4, $5, now() + ($6::integer * interval '1 day') FROM users WHERE id = $1 AND is_enabled AND NOT provider_disabled
    RETURNING ${columns}`, [userId, name.trim(), hashEncoreToken(token), token.slice(0, 12), [...new Set(scopes)], days])
  if (!connection) throw new Error('This Aperture account is disabled')
  return { connection, token }
}
export async function revokeEncoreConnection(userId: string, id: string) {
  return !!await queryOne('UPDATE encore_mcp_connections SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id', [id, userId])
}
export async function authenticateEncoreConnection(token: string) {
  if (!/^apmcp_[\w-]{43}$/.test(token)) return null
  const connection = await queryOne<{ id: string; user_id: string; scopes: EncoreScope[] }>(`SELECT c.id, c.user_id, c.scopes FROM encore_mcp_connections c JOIN users u ON u.id = c.user_id
    WHERE c.token_hash = $1 AND c.revoked_at IS NULL AND c.expires_at > now() AND u.is_enabled AND NOT u.provider_disabled`, [hashEncoreToken(token)])
  if (!connection) return null
  await query('UPDATE encore_mcp_connections SET last_used_at = now() WHERE id = $1', [connection.id])
  return connection
}
