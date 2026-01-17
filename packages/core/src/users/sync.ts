/**
 * User Sync Module
 * 
 * Syncs users from Emby/Jellyfin media server to Aperture database.
 * - Imports new users automatically
 * - Updates email for existing users (if not locked)
 * - Updates admin status
 */

import { randomUUID } from 'crypto'
import { query } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerConfig, getMediaServerApiKey } from '../settings/systemSettings.js'
import {
  createJobProgress,
  setJobStep,
  updateJobProgress,
  addLog,
  completeJob,
  failJob,
} from '../jobs/progress.js'

const logger = createChildLogger('user-sync')

export interface SyncUsersResult {
  imported: number
  updated: number
  total: number
  jobId: string
}

/**
 * Sync all users from media server to Aperture database
 */
export async function syncUsersFromMediaServer(
  existingJobId?: string
): Promise<SyncUsersResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'sync-users', 2)

  try {
    const provider = await getMediaServerProvider()
    const apiKey = await getMediaServerApiKey()

    if (!apiKey) {
      throw new Error('MEDIA_SERVER_API_KEY environment variable is required')
    }

    // Step 1: Fetch all users from media server
    setJobStep(jobId, 0, 'Fetching users from media server')
    addLog(jobId, 'info', '📡 Fetching user list from media server...')

    const providerUsers = await provider.getUsers(apiKey)
    addLog(jobId, 'info', `👥 Found ${providerUsers.length} user(s) on media server`)

    // Get existing users from our database
    const existingUsers = await query<{ 
      provider_user_id: string
      email: string | null
      email_locked: boolean
      is_admin: boolean
    }>(
      'SELECT provider_user_id, email, email_locked, is_admin FROM users WHERE provider_user_id IS NOT NULL'
    )
    const existingUserMap = new Map(
      existingUsers.rows.map(u => [u.provider_user_id, u])
    )

    // Step 2: Process users
    setJobStep(jobId, 1, 'Syncing users', providerUsers.length)

    const msConfig = await getMediaServerConfig()
    const providerType = msConfig.type || 'emby'
    
    let imported = 0
    let updated = 0

    for (let i = 0; i < providerUsers.length; i++) {
      const pu = providerUsers[i]
      updateJobProgress(jobId, i, providerUsers.length, pu.name)

      const existing = existingUserMap.get(pu.id)

      if (!existing) {
        // New user - import
        await query(
          `INSERT INTO users (username, provider_user_id, provider, is_admin, is_enabled, movies_enabled, series_enabled, email)
           VALUES ($1, $2, $3, $4, false, false, false, $5)`,
          [pu.name, pu.id, providerType, pu.isAdmin || false, pu.email || null]
        )
        imported++
        addLog(jobId, 'info', `➕ Imported new user: ${pu.name}${pu.email ? ` (${pu.email})` : ''}`)
      } else {
        // Existing user - check for updates
        const updates: string[] = []
        const values: (string | boolean | null)[] = []
        let paramIndex = 1

        // Update admin status if changed
        if (existing.is_admin !== (pu.isAdmin || false)) {
          updates.push(`is_admin = $${paramIndex}`)
          values.push(pu.isAdmin || false)
          paramIndex++
        }

        // Update email if not locked and different
        if (!existing.email_locked && pu.email && existing.email !== pu.email) {
          updates.push(`email = $${paramIndex}`)
          values.push(pu.email)
          paramIndex++
        }

        if (updates.length > 0) {
          updates.push('updated_at = NOW()')
          values.push(pu.id)

          await query(
            `UPDATE users SET ${updates.join(', ')} WHERE provider_user_id = $${paramIndex}`,
            values
          )
          updated++
          addLog(jobId, 'info', `🔄 Updated user: ${pu.name}`)
        }
      }
    }

    updateJobProgress(jobId, providerUsers.length, providerUsers.length)

    const result = {
      imported,
      updated,
      total: providerUsers.length,
      jobId,
    }

    addLog(jobId, 'info', `✅ User sync complete: ${imported} imported, ${updated} updated, ${providerUsers.length} total`)
    completeJob(jobId, result)

    logger.info(result, 'User sync completed')
    return result

  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err }, 'User sync failed')
    addLog(jobId, 'error', `❌ User sync failed: ${error}`)
    failJob(jobId, error)
    throw err
  }
}

