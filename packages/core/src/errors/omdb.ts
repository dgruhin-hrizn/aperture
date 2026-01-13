/**
 * OMDb API Error Codes
 * https://www.omdbapi.com/
 */

import type { ApiErrorDefinition } from './types.js'

/**
 * OMDb error definitions
 * 
 * Note: OMDb often returns 200 OK with error in response body
 * The 401 error is typically returned as a 401 HTTP status
 */
export const OMDB_ERRORS: Record<number, ApiErrorDefinition> = {
  // Authentication / Rate limit
  // OMDb uses 401 for both invalid key AND rate limit exceeded
  401: {
    type: 'limit',
    message: 'OMDb daily limit reached (1k free / 100k paid)',
    action: 'Upgrade at omdbapi.com',
    actionUrl: 'https://www.omdbapi.com/apikey.aspx',
    severity: 'warning',
  },
  
  // Server errors
  500: {
    type: 'outage',
    message: 'OMDb server error. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 60,
    severity: 'info',
  },
  503: {
    type: 'outage',
    message: 'OMDb is temporarily unavailable. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 60,
    severity: 'info',
  },
}

/**
 * OMDb error message patterns (from response body)
 */
export const OMDB_ERROR_MESSAGES: Record<string, ApiErrorDefinition> = {
  'Invalid API key!': {
    type: 'auth',
    message: 'Invalid OMDb API key',
    action: 'Get a new key at omdbapi.com/apikey.aspx',
    actionUrl: 'https://www.omdbapi.com/apikey.aspx',
    severity: 'error',
  },
  'Request limit reached!': {
    type: 'limit',
    message: 'OMDb daily limit reached (1,000 for free tier)',
    action: 'Upgrade to paid tier for 100,000 requests/day',
    actionUrl: 'https://www.omdbapi.com/apikey.aspx',
    severity: 'warning',
  },
}

