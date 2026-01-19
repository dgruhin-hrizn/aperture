/**
 * API Key Authentication Module
 *
 * Provides functions for creating, validating, and managing API keys
 * for programmatic access to the Aperture API.
 */

import { randomBytes, createHash } from 'crypto'
import { query, queryOne } from './lib/db.js'
import { createChildLogger } from './lib/logger.js'

const logger = createChildLogger('api-keys')

// API key prefix for easy identification
const API_KEY_PREFIX = 'apt_'

// Key length (excluding prefix)
const KEY_LENGTH = 32

export interface ApiKey {
  id: string
  userId: string
  name: string
  keyPrefix: string
  expiresAt: Date | null
  lastUsedAt: Date | null
  createdAt: Date
  revokedAt: Date | null
}

export interface ApiKeyWithUser extends ApiKey {
  username: string
  displayName: string | null
  isAdmin: boolean
  isEnabled: boolean
  canManageWatchHistory: boolean
}

export interface CreateApiKeyResult {
  /** The API key record (without plaintext key) */
  apiKey: ApiKey
  /** The plaintext key - only returned once at creation time */
  plaintextKey: string
}

interface ApiKeyRow {
  id: string
  user_id: string
  name: string
  key_hash: string
  key_prefix: string
  expires_at: Date | null
  last_used_at: Date | null
  created_at: Date
  revoked_at: Date | null
}

interface ApiKeyWithUserRow extends ApiKeyRow {
  username: string
  display_name: string | null
  is_admin: boolean
  is_enabled: boolean
  can_manage_watch_history: boolean
}

/**
 * Predefined expiration options (in days) matching AWS IAM style
 */
export const EXPIRATION_OPTIONS = [
  { label: 'Never', days: null },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
  { label: '180 days', days: 180 },
  { label: '365 days', days: 365 },
] as const

/**
 * Generate a new random API key
 * Format: apt_<32 random hex chars>
 */
function generateApiKey(): string {
  const randomPart = randomBytes(KEY_LENGTH / 2).toString('hex')
  return `${API_KEY_PREFIX}${randomPart}`
}

/**
 * Hash an API key for storage
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Convert database row to ApiKey object
 */
function rowToApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  }
}

/**
 * Convert database row to ApiKeyWithUser object
 */
function rowToApiKeyWithUser(row: ApiKeyWithUserRow): ApiKeyWithUser {
  return {
    ...rowToApiKey(row),
    username: row.username,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    isEnabled: row.is_enabled,
    canManageWatchHistory: row.can_manage_watch_history,
  }
}

/**
 * Create a new API key for a user
 *
 * @param userId - The user ID to create the key for
 * @param name - A descriptive name for the key
 * @param expiresInDays - Days until expiration (null = never expires)
 * @returns The created API key with the plaintext key (only returned once)
 */
export async function createApiKey(
  userId: string,
  name: string,
  expiresInDays: number | null = null
): Promise<CreateApiKeyResult> {
  const plaintextKey = generateApiKey()
  const keyHash = hashApiKey(plaintextKey)
  const keyPrefix = plaintextKey.substring(0, 8)

  let expiresAt: Date | null = null
  if (expiresInDays !== null) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)
  }

  const row = await queryOne<ApiKeyRow>(
    `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, name, key_hash, key_prefix, expires_at, last_used_at, created_at, revoked_at`,
    [userId, name, keyHash, keyPrefix, expiresAt]
  )

  if (!row) {
    throw new Error('Failed to create API key')
  }

  logger.info({ userId, keyPrefix, name }, 'Created new API key')

  return {
    apiKey: rowToApiKey(row),
    plaintextKey,
  }
}

/**
 * Validate an API key and return the associated user if valid
 *
 * @param key - The plaintext API key to validate
 * @returns The user info if valid, null otherwise
 */
export async function validateApiKey(key: string): Promise<ApiKeyWithUser | null> {
  // Quick format check
  if (!key || !key.startsWith(API_KEY_PREFIX)) {
    return null
  }

  const keyHash = hashApiKey(key)

  // Find the key and join with user data
  const row = await queryOne<ApiKeyWithUserRow>(
    `SELECT 
       ak.id, ak.user_id, ak.name, ak.key_hash, ak.key_prefix,
       ak.expires_at, ak.last_used_at, ak.created_at, ak.revoked_at,
       u.username, u.display_name, u.is_admin, u.is_enabled, u.can_manage_watch_history
     FROM api_keys ak
     JOIN users u ON u.id = ak.user_id
     WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL`,
    [keyHash]
  )

  if (!row) {
    logger.debug({ keyPrefix: key.substring(0, 8) }, 'API key not found or revoked')
    return null
  }

  // Check expiration
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    logger.debug({ keyPrefix: row.key_prefix }, 'API key expired')
    return null
  }

  // Check if user is enabled
  if (!row.is_enabled) {
    logger.debug({ keyPrefix: row.key_prefix, userId: row.user_id }, 'API key user is disabled')
    return null
  }

  // Update last_used_at (fire and forget)
  query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]).catch((err) => {
    logger.warn({ err, keyId: row.id }, 'Failed to update API key last_used_at')
  })

  return rowToApiKeyWithUser(row)
}

/**
 * List all API keys for a user
 *
 * @param userId - The user ID to list keys for
 * @param includeRevoked - Whether to include revoked keys
 * @returns List of API keys (without key hashes)
 */
export async function listApiKeys(
  userId: string,
  includeRevoked = false
): Promise<ApiKey[]> {
  const whereClause = includeRevoked
    ? 'WHERE user_id = $1'
    : 'WHERE user_id = $1 AND revoked_at IS NULL'

  const result = await query<ApiKeyRow>(
    `SELECT id, user_id, name, key_hash, key_prefix, expires_at, last_used_at, created_at, revoked_at
     FROM api_keys
     ${whereClause}
     ORDER BY created_at DESC`,
    [userId]
  )

  return result.rows.map(rowToApiKey)
}

/**
 * List all API keys (admin function)
 *
 * @param includeRevoked - Whether to include revoked keys
 * @returns List of all API keys with user info
 */
export async function listAllApiKeys(includeRevoked = false): Promise<ApiKeyWithUser[]> {
  const whereClause = includeRevoked ? '' : 'WHERE ak.revoked_at IS NULL'

  const result = await query<ApiKeyWithUserRow>(
    `SELECT 
       ak.id, ak.user_id, ak.name, ak.key_hash, ak.key_prefix,
       ak.expires_at, ak.last_used_at, ak.created_at, ak.revoked_at,
       u.username, u.display_name, u.is_admin, u.is_enabled, u.can_manage_watch_history
     FROM api_keys ak
     JOIN users u ON u.id = ak.user_id
     ${whereClause}
     ORDER BY ak.created_at DESC`
  )

  return result.rows.map(rowToApiKeyWithUser)
}

/**
 * Get a single API key by ID
 *
 * @param id - The API key ID
 * @returns The API key or null if not found
 */
export async function getApiKey(id: string): Promise<ApiKey | null> {
  const row = await queryOne<ApiKeyRow>(
    `SELECT id, user_id, name, key_hash, key_prefix, expires_at, last_used_at, created_at, revoked_at
     FROM api_keys
     WHERE id = $1`,
    [id]
  )

  return row ? rowToApiKey(row) : null
}

/**
 * Revoke an API key (soft delete)
 *
 * @param id - The API key ID to revoke
 * @returns True if revoked, false if not found
 */
export async function revokeApiKey(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
    [id]
  )

  if (result.rowCount && result.rowCount > 0) {
    logger.info({ keyId: id }, 'Revoked API key')
    return true
  }

  return false
}

/**
 * Delete an API key permanently (hard delete)
 *
 * @param id - The API key ID to delete
 * @returns True if deleted, false if not found
 */
export async function deleteApiKey(id: string): Promise<boolean> {
  const result = await query('DELETE FROM api_keys WHERE id = $1', [id])

  if (result.rowCount && result.rowCount > 0) {
    logger.info({ keyId: id }, 'Deleted API key')
    return true
  }

  return false
}

/**
 * Update an API key's name or expiration
 *
 * @param id - The API key ID to update
 * @param updates - Fields to update
 * @returns The updated API key or null if not found
 */
export async function updateApiKey(
  id: string,
  updates: { name?: string; expiresAt?: Date | null }
): Promise<ApiKey | null> {
  const setClauses: string[] = []
  const values: (string | Date | null)[] = []
  let paramIndex = 1

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex}`)
    values.push(updates.name)
    paramIndex++
  }

  if (updates.expiresAt !== undefined) {
    setClauses.push(`expires_at = $${paramIndex}`)
    values.push(updates.expiresAt)
    paramIndex++
  }

  if (setClauses.length === 0) {
    // No updates, just return current key
    return getApiKey(id)
  }

  values.push(id)

  const row = await queryOne<ApiKeyRow>(
    `UPDATE api_keys 
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex} AND revoked_at IS NULL
     RETURNING id, user_id, name, key_hash, key_prefix, expires_at, last_used_at, created_at, revoked_at`,
    values
  )

  if (row) {
    logger.info({ keyId: id, updates }, 'Updated API key')
    return rowToApiKey(row)
  }

  return null
}

/**
 * Delete all API keys for a user
 *
 * @param userId - The user ID
 * @returns Number of keys deleted
 */
export async function deleteAllUserApiKeys(userId: string): Promise<number> {
  const result = await query('DELETE FROM api_keys WHERE user_id = $1', [userId])
  const count = result.rowCount || 0

  if (count > 0) {
    logger.info({ userId, count }, 'Deleted all API keys for user')
  }

  return count
}

/**
 * Check if an API key is expired
 */
export function isApiKeyExpired(apiKey: ApiKey): boolean {
  if (!apiKey.expiresAt) {
    return false
  }
  return new Date(apiKey.expiresAt) < new Date()
}

/**
 * Check if an API key is revoked
 */
export function isApiKeyRevoked(apiKey: ApiKey): boolean {
  return apiKey.revokedAt !== null
}

/**
 * Get a summary of API key status
 */
export function getApiKeyStatus(apiKey: ApiKey): 'active' | 'expired' | 'revoked' {
  if (isApiKeyRevoked(apiKey)) return 'revoked'
  if (isApiKeyExpired(apiKey)) return 'expired'
  return 'active'
}
