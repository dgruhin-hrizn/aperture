/**
 * Trakt API Error Codes
 * https://trakt.docs.apiary.io/#introduction/status-codes
 */

import type { ApiErrorDefinition } from './types.js'

/**
 * Trakt error definitions mapped by HTTP status code
 */
export const TRAKT_ERRORS: Record<number, ApiErrorDefinition> = {
  // Authentication errors
  401: {
    type: 'auth',
    message: 'Trakt OAuth authorization required',
    action: 'Re-connect Trakt in settings',
    actionUrl: '/settings#integrations',
    severity: 'error',
  },
  403: {
    type: 'auth',
    message: 'Invalid Trakt API key or unapproved app',
    action: 'Check Trakt app configuration',
    actionUrl: 'https://trakt.tv/oauth/applications',
    severity: 'error',
  },
  
  // Account limits
  420: {
    type: 'limit',
    message: 'Trakt account limit exceeded (lists, items, etc)',
    action: 'Review Trakt account limits',
    actionUrl: 'https://trakt.tv/settings',
    severity: 'warning',
  },
  423: {
    type: 'auth',
    message: 'Your Trakt account is locked',
    action: 'Contact Trakt support',
    actionUrl: 'https://trakt.tv/support',
    severity: 'error',
  },
  426: {
    type: 'limit',
    message: 'This feature requires Trakt VIP',
    action: 'Upgrade to VIP',
    actionUrl: 'https://trakt.tv/vip',
    severity: 'warning',
  },
  
  // Rate limit
  429: {
    type: 'rate_limit',
    message: 'Trakt rate limit exceeded. Retrying shortly.',
    autoRetry: true,
    retryAfterSeconds: 60,
    severity: 'warning',
  },
  
  // Server errors
  500: {
    type: 'outage',
    message: 'Trakt servers are having issues. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
  502: {
    type: 'outage',
    message: 'Trakt is overloaded. Will retry in 30 seconds.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
  503: {
    type: 'outage',
    message: 'Trakt is overloaded. Will retry in 30 seconds.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
  504: {
    type: 'outage',
    message: 'Trakt gateway timeout. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
  
  // Cloudflare errors
  520: {
    type: 'outage',
    message: 'Trakt/Cloudflare issues. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 60,
    severity: 'info',
  },
  521: {
    type: 'outage',
    message: 'Trakt is down. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 60,
    severity: 'info',
  },
  522: {
    type: 'outage',
    message: 'Trakt connection timeout. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 60,
    severity: 'info',
  },
}

