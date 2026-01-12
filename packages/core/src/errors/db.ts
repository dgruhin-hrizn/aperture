/**
 * API Errors Database Functions
 * 
 * Manages the api_errors table for tracking and displaying
 * rate limits, auth failures, and service outages.
 */

import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import type { ApiErrorRecord, ParsedApiError } from './types.js'
import { toApiErrorRecord } from './handler.js'

const logger = createChildLogger('api-errors-db')

interface ApiErrorRow {
  id: string
  provider: string
  error_type: string
  error_code: string | null
  http_status: number
  job_id: string | null
  error_message: string | null
  reset_at: Date | null
  action_url: string | null
  created_at: Date
  dismissed_at: Date | null
}

function rowToRecord(row: ApiErrorRow): ApiErrorRecord {
  return {
    id: row.id,
    provider: row.provider as ApiErrorRecord['provider'],
    errorType: row.error_type as ApiErrorRecord['errorType'],
    errorCode: row.error_code,
    httpStatus: row.http_status,
    jobId: row.job_id,
    errorMessage: row.error_message || '',
    resetAt: row.reset_at,
    actionUrl: row.action_url,
    createdAt: row.created_at,
    dismissedAt: row.dismissed_at,
  }
}

/**
 * Log an API error to the database
 */
export async function logApiError(
  error: ParsedApiError,
  jobId?: string
): Promise<ApiErrorRecord> {
  const record = toApiErrorRecord(error, jobId)
  
  const result = await queryOne<ApiErrorRow>(
    `INSERT INTO api_errors (provider, error_type, error_code, http_status, job_id, error_message, reset_at, action_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      record.provider,
      record.errorType,
      record.errorCode,
      record.httpStatus,
      record.jobId,
      record.errorMessage,
      record.resetAt,
      record.actionUrl,
    ]
  )
  
  if (!result) {
    throw new Error('Failed to log API error')
  }
  
  logger.info({ provider: record.provider, type: record.errorType }, 'API error logged')
  return rowToRecord(result)
}

/**
 * Get all active (non-dismissed) API errors
 */
export async function getActiveApiErrors(): Promise<ApiErrorRecord[]> {
  const result = await query<ApiErrorRow>(
    `SELECT * FROM api_errors
     WHERE dismissed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 50`
  )
  
  return result.rows.map(rowToRecord)
}

/**
 * Get active errors by provider
 */
export async function getActiveErrorsByProvider(
  provider: ApiErrorRecord['provider']
): Promise<ApiErrorRecord[]> {
  const result = await query<ApiErrorRow>(
    `SELECT * FROM api_errors
     WHERE provider = $1 AND dismissed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 10`,
    [provider]
  )
  
  return result.rows.map(rowToRecord)
}

/**
 * Get the most recent error for a provider (for display)
 */
export async function getLatestErrorByProvider(
  provider: ApiErrorRecord['provider']
): Promise<ApiErrorRecord | null> {
  const result = await queryOne<ApiErrorRow>(
    `SELECT * FROM api_errors
     WHERE provider = $1 AND dismissed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [provider]
  )
  
  return result ? rowToRecord(result) : null
}

/**
 * Dismiss an API error (user acknowledges it)
 */
export async function dismissApiError(errorId: string): Promise<void> {
  await query(
    `UPDATE api_errors SET dismissed_at = NOW() WHERE id = $1`,
    [errorId]
  )
  logger.debug({ errorId }, 'API error dismissed')
}

/**
 * Dismiss all errors for a provider
 */
export async function dismissErrorsByProvider(
  provider: ApiErrorRecord['provider']
): Promise<number> {
  const result = await query(
    `UPDATE api_errors SET dismissed_at = NOW()
     WHERE provider = $1 AND dismissed_at IS NULL`,
    [provider]
  )
  
  const count = result.rowCount ?? 0
  logger.info({ provider, count }, 'API errors dismissed for provider')
  return count
}

/**
 * Cleanup old dismissed errors (older than 7 days)
 */
export async function cleanupOldErrors(): Promise<number> {
  const result = await query(
    `DELETE FROM api_errors
     WHERE dismissed_at IS NOT NULL
       AND dismissed_at < NOW() - INTERVAL '7 days'`
  )
  
  const count = result.rowCount ?? 0
  if (count > 0) {
    logger.info({ count }, 'Old API errors cleaned up')
  }
  return count
}

/**
 * Check if a similar error exists recently (to avoid duplicates)
 * Returns true if a similar error was logged in the last 5 minutes
 */
export async function hasRecentSimilarError(
  provider: ApiErrorRecord['provider'],
  errorType: string,
  httpStatus: number
): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM api_errors
     WHERE provider = $1
       AND error_type = $2
       AND http_status = $3
       AND created_at > NOW() - INTERVAL '5 minutes'`,
    [provider, errorType, httpStatus]
  )
  
  return parseInt(result?.count || '0', 10) > 0
}

/**
 * Get error summary by provider (for dashboard display)
 */
export async function getErrorSummary(): Promise<
  Array<{
    provider: string
    activeCount: number
    latestErrorType: string | null
    latestCreatedAt: Date | null
  }>
> {
  const result = await query<{
    provider: string
    active_count: string
    latest_error_type: string | null
    latest_created_at: Date | null
  }>(
    `SELECT 
       provider,
       COUNT(*) as active_count,
       (SELECT error_type FROM api_errors e2 
        WHERE e2.provider = e1.provider AND e2.dismissed_at IS NULL 
        ORDER BY created_at DESC LIMIT 1) as latest_error_type,
       MAX(created_at) as latest_created_at
     FROM api_errors e1
     WHERE dismissed_at IS NULL
     GROUP BY provider
     ORDER BY MAX(created_at) DESC`
  )
  
  return result.rows.map((row) => ({
    provider: row.provider,
    activeCount: parseInt(row.active_count, 10),
    latestErrorType: row.latest_error_type,
    latestCreatedAt: row.latest_created_at,
  }))
}

