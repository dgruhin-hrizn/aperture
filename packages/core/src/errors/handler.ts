/**
 * Unified API Error Handler
 * 
 * Parses errors from external APIs and returns structured error definitions
 * for user-friendly display and database logging.
 */

import { createChildLogger } from '../lib/logger.js'
import type { ApiErrorDefinition, ParsedApiError, ApiErrorRecord } from './types.js'
import { OPENAI_ERRORS, OPENAI_ERROR_PATTERNS } from './openai.js'
import { TMDB_ERRORS, TMDB_HTTP_TO_STATUS } from './tmdb.js'
import { TRAKT_ERRORS } from './trakt.js'
import { MDBLIST_ERRORS } from './mdblist.js'
import { OMDB_ERRORS, OMDB_ERROR_MESSAGES } from './omdb.js'

const logger = createChildLogger('api-error-handler')

/**
 * Default error definition for unknown errors
 */
const DEFAULT_ERROR: ApiErrorDefinition = {
  type: 'outage',
  message: 'Service temporarily unavailable. Will retry automatically.',
  autoRetry: true,
  retryAfterSeconds: 60,
  severity: 'info',
}

/**
 * Parse an OpenAI error response
 */
function parseOpenAIError(
  status: number,
  errorMessage?: string
): ApiErrorDefinition {
  const errorDef = OPENAI_ERRORS[status]
  
  if (!errorDef) {
    return DEFAULT_ERROR
  }
  
  // If multiple possible errors for this status, use message patterns
  if (Array.isArray(errorDef)) {
    if (errorMessage) {
      const messageLower = errorMessage.toLowerCase()
      for (const [pattern, match] of Object.entries(OPENAI_ERROR_PATTERNS)) {
        if (match.status === status && messageLower.includes(pattern)) {
          return errorDef[match.index] || errorDef[0]
        }
      }
    }
    return errorDef[0] // Default to first option
  }
  
  return errorDef
}

/**
 * Parse a TMDb error response
 */
function parseTMDbError(
  status: number,
  responseBody?: { status_code?: number; status_message?: string }
): ApiErrorDefinition {
  // Try to get TMDb status_code from response body
  const tmdbStatus = responseBody?.status_code || TMDB_HTTP_TO_STATUS[status]
  
  if (tmdbStatus && TMDB_ERRORS[tmdbStatus]) {
    return TMDB_ERRORS[tmdbStatus]
  }
  
  return DEFAULT_ERROR
}

/**
 * Parse a Trakt error response
 */
function parseTraktError(status: number): ApiErrorDefinition {
  return TRAKT_ERRORS[status] || DEFAULT_ERROR
}

/**
 * Parse an MDBList error response
 */
function parseMDBListError(status: number): ApiErrorDefinition {
  return MDBLIST_ERRORS[status] || DEFAULT_ERROR
}

/**
 * Parse an OMDb error response
 */
function parseOMDbError(
  status: number,
  errorMessage?: string
): ApiErrorDefinition {
  // Check for message-based errors first (OMDb often returns 200 with error in body)
  if (errorMessage) {
    for (const [pattern, def] of Object.entries(OMDB_ERROR_MESSAGES)) {
      if (errorMessage.includes(pattern)) {
        return def
      }
    }
  }
  
  return OMDB_ERRORS[status] || DEFAULT_ERROR
}

/**
 * Parse an API error and return a structured definition
 */
export function parseApiError(
  provider: ParsedApiError['provider'],
  status: number,
  options: {
    errorMessage?: string
    responseBody?: Record<string, unknown>
    retryAfterHeader?: string
  } = {}
): ParsedApiError {
  let definition: ApiErrorDefinition
  let errorCode: string | undefined
  
  switch (provider) {
    case 'openai':
      definition = parseOpenAIError(status, options.errorMessage)
      break
    case 'tmdb':
      definition = parseTMDbError(status, options.responseBody as { status_code?: number })
      errorCode = (options.responseBody as { status_code?: number })?.status_code?.toString()
      break
    case 'trakt':
      definition = parseTraktError(status)
      break
    case 'mdblist':
      definition = parseMDBListError(status)
      break
    case 'omdb':
      definition = parseOMDbError(status, options.errorMessage)
      break
    default:
      definition = DEFAULT_ERROR
  }
  
  // Parse reset time from headers if available
  let resetAt: Date | undefined
  if (options.retryAfterHeader) {
    const retryAfter = parseInt(options.retryAfterHeader, 10)
    if (!isNaN(retryAfter)) {
      resetAt = new Date(Date.now() + retryAfter * 1000)
    } else {
      // Could be a date string
      const parsed = new Date(options.retryAfterHeader)
      if (!isNaN(parsed.getTime())) {
        resetAt = parsed
      }
    }
  }
  
  const result: ParsedApiError = {
    provider,
    httpStatus: status,
    errorCode,
    rawMessage: options.errorMessage,
    definition,
    resetAt,
  }
  
  logger.debug({ ...result, definition: definition.message }, 'Parsed API error')
  
  return result
}

/**
 * Convert parsed error to database record
 */
export function toApiErrorRecord(
  error: ParsedApiError,
  jobId?: string
): Omit<ApiErrorRecord, 'id' | 'createdAt'> {
  return {
    provider: error.provider,
    errorType: error.definition.type,
    errorCode: error.errorCode || null,
    httpStatus: error.httpStatus,
    jobId: jobId || null,
    errorMessage: error.rawMessage || error.definition.message,
    resetAt: error.resetAt || null,
    actionUrl: error.definition.actionUrl || null,
  }
}

/**
 * Check if an error should be retried automatically
 */
export function shouldAutoRetry(error: ParsedApiError): boolean {
  return error.definition.autoRetry === true
}

/**
 * Get retry delay in milliseconds
 */
export function getRetryDelay(error: ParsedApiError): number {
  if (error.resetAt) {
    const delay = error.resetAt.getTime() - Date.now()
    return Math.max(delay, 1000) // At least 1 second
  }
  
  const seconds = error.definition.retryAfterSeconds || 60
  return seconds * 1000
}

