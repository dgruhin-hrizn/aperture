/**
 * MDBList API Error Codes
 * https://mdblist.com/api
 */

import type { ApiErrorDefinition } from './types.js'

/**
 * MDBList error definitions mapped by HTTP status code
 */
export const MDBLIST_ERRORS: Record<number, ApiErrorDefinition> = {
  // Authentication
  401: {
    type: 'auth',
    message: 'Invalid MDBList API key',
    action: 'Generate a new key at mdblist.com/preferences',
    actionUrl: 'https://mdblist.com/preferences/',
    severity: 'error',
  },
  403: {
    type: 'auth',
    message: 'MDBList API access forbidden',
    action: 'Check your API key permissions',
    actionUrl: 'https://mdblist.com/preferences/',
    severity: 'error',
  },
  
  // Rate limit
  429: {
    type: 'rate_limit',
    message: 'MDBList daily request limit reached. Resets at midnight UTC.',
    action: 'Consider upgrading to supporter tier',
    actionUrl: 'https://mdblist.com/pricing/',
    severity: 'warning',
  },
  
  // Server errors
  500: {
    type: 'outage',
    message: 'MDBList server error. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 60,
    severity: 'info',
  },
  502: {
    type: 'outage',
    message: 'MDBList gateway error. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
  503: {
    type: 'outage',
    message: 'MDBList is temporarily unavailable. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 60,
    severity: 'info',
  },
  504: {
    type: 'outage',
    message: 'MDBList timeout. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
}

