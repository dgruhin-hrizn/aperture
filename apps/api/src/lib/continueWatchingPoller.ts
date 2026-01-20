/**
 * Continue Watching Polling Service
 * 
 * Polls the Emby/Jellyfin Resume API at regular intervals to keep
 * the Continue Watching library up to date.
 * 
 * Uses setInterval instead of cron since we need sub-minute polling.
 */

import { createChildLogger, query, queryOne, processContinueWatchingForUser } from '@aperture/core'

const logger = createChildLogger('continue-watching-poller')

let pollingInterval: NodeJS.Timeout | null = null
let isPolling = false
let currentUserIndex = 0
let users: Array<{ id: string; provider_user_id: string; display_name: string }> = []
let lastUserRefresh = 0
const USER_REFRESH_INTERVAL = 5 * 60 * 1000 // Refresh user list every 5 minutes

/**
 * Get continue watching config from database
 */
async function getConfig(): Promise<{
  enabled: boolean
  pollIntervalSeconds: number
} | null> {
  const row = await queryOne<{
    enabled: boolean
    poll_interval_seconds: number
  }>(
    `SELECT enabled, poll_interval_seconds FROM continue_watching_config LIMIT 1`
  )
  
  if (!row) return null
  
  return {
    enabled: row.enabled,
    pollIntervalSeconds: row.poll_interval_seconds,
  }
}

/**
 * Refresh the list of users to poll
 */
async function refreshUserList(): Promise<void> {
  const result = await query<{ id: string; provider_user_id: string; display_name: string | null; username: string }>(
    `SELECT id, provider_user_id, COALESCE(display_name, username) as display_name 
     FROM users 
     WHERE provider_user_id IS NOT NULL`
  )
  
  users = result.rows.map(r => ({
    id: r.id,
    provider_user_id: r.provider_user_id,
    display_name: r.display_name || r.username,
  }))
  
  lastUserRefresh = Date.now()
  logger.debug({ userCount: users.length }, 'Refreshed user list for polling')
}

/**
 * Poll the next user in the rotation
 * This staggers requests across the polling interval to avoid bursts
 */
async function pollNextUser(): Promise<void> {
  if (isPolling || users.length === 0) return
  
  isPolling = true
  
  try {
    // Refresh user list periodically
    if (Date.now() - lastUserRefresh > USER_REFRESH_INTERVAL) {
      await refreshUserList()
    }
    
    if (users.length === 0) {
      logger.debug('No users to poll')
      return
    }
    
    // Get next user in rotation
    const user = users[currentUserIndex % users.length]
    currentUserIndex = (currentUserIndex + 1) % users.length
    
    logger.debug({ userId: user.id, displayName: user.display_name }, 'Polling continue watching for user')
    
    await processContinueWatchingForUser(user.id, user.provider_user_id, user.display_name)
    
  } catch (err) {
    logger.error({ err }, 'Error polling continue watching')
  } finally {
    isPolling = false
  }
}

/**
 * Start the polling service
 */
export async function startContinueWatchingPoller(): Promise<void> {
  const config = await getConfig()
  
  if (!config?.enabled) {
    logger.info('Continue watching polling disabled')
    return
  }
  
  // Stop existing poller if running
  stopContinueWatchingPoller()
  
  // Refresh user list
  await refreshUserList()
  
  if (users.length === 0) {
    logger.info('No users configured, continue watching polling not started')
    return
  }
  
  // Calculate per-user interval to spread requests across the polling interval
  // e.g., 60 second interval with 40 users = poll one user every 1.5 seconds
  const pollIntervalMs = config.pollIntervalSeconds * 1000
  const perUserIntervalMs = Math.max(1000, Math.floor(pollIntervalMs / users.length))
  
  logger.info({ 
    pollIntervalSeconds: config.pollIntervalSeconds,
    userCount: users.length,
    perUserIntervalMs,
  }, 'Starting continue watching polling')
  
  // Start polling
  pollingInterval = setInterval(pollNextUser, perUserIntervalMs)
  
  // Poll immediately for first user
  pollNextUser()
}

/**
 * Stop the polling service
 */
export function stopContinueWatchingPoller(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
    logger.info('Continue watching polling stopped')
  }
}

/**
 * Restart the polling service (e.g., after config change)
 */
export async function restartContinueWatchingPoller(): Promise<void> {
  stopContinueWatchingPoller()
  await startContinueWatchingPoller()
}

/**
 * Get polling status
 */
export function getPollingStatus(): {
  isRunning: boolean
  userCount: number
  currentUserIndex: number
} {
  return {
    isRunning: pollingInterval !== null,
    userCount: users.length,
    currentUserIndex,
  }
}
