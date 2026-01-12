/**
 * TMDb API Error Codes
 * https://developer.themoviedb.org/docs/errors
 */

import type { ApiErrorDefinition } from './types.js'

/**
 * TMDb error definitions mapped by their status_code (not HTTP status)
 * TMDb returns errors in the response body with a `status_code` field
 */
export const TMDB_ERRORS: Record<number, ApiErrorDefinition> = {
  // Authentication errors
  3: {
    type: 'auth',
    message: 'TMDb authentication failed',
    action: 'Verify your API key is correct',
    actionUrl: 'https://www.themoviedb.org/settings/api',
    severity: 'error',
  },
  7: {
    type: 'auth',
    message: 'Invalid TMDb API key',
    action: 'Check your API key at TMDb settings',
    actionUrl: 'https://www.themoviedb.org/settings/api',
    severity: 'error',
  },
  10: {
    type: 'auth',
    message: 'TMDb API key suspended',
    action: 'Check your API key status at TMDb',
    actionUrl: 'https://www.themoviedb.org/settings/api',
    severity: 'error',
  },
  14: {
    type: 'auth',
    message: 'TMDb authentication failed',
    action: 'Verify your API key is correct',
    actionUrl: 'https://www.themoviedb.org/settings/api',
    severity: 'error',
  },
  
  // Service errors
  9: {
    type: 'outage',
    message: 'TMDb service temporarily offline. Jobs will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 60,
    severity: 'info',
  },
  11: {
    type: 'outage',
    message: 'TMDb internal error. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
  24: {
    type: 'outage',
    message: 'TMDb timeout. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
  43: {
    type: 'outage',
    message: 'TMDb session timeout. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
  46: {
    type: 'outage',
    message: 'TMDb is under maintenance. Try again later.',
    autoRetry: true,
    retryAfterSeconds: 300,
    severity: 'info',
  },
  
  // Rate limit
  25: {
    type: 'rate_limit',
    message: 'TMDb request limit exceeded. Automatically retrying.',
    autoRetry: true,
    retryAfterSeconds: 10,
    severity: 'warning',
  },
  
  // Validation errors
  6: {
    type: 'validation',
    message: 'Invalid TMDb ID',
    severity: 'error',
  },
  34: {
    type: 'validation',
    message: 'Resource not found on TMDb',
    severity: 'error',
  },
}

/**
 * HTTP status to TMDb status_code mapping for common cases
 */
export const TMDB_HTTP_TO_STATUS: Record<number, number> = {
  401: 7,   // Usually invalid API key
  403: 10,  // Suspended key
  404: 34,  // Not found
  429: 25,  // Rate limit
  500: 11,  // Internal error
  502: 9,   // Offline
  503: 9,   // Offline
  504: 24,  // Timeout
}

