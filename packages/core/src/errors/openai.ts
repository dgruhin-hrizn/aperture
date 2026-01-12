/**
 * OpenAI API Error Codes
 * https://platform.openai.com/docs/guides/error-codes
 */

import type { ApiErrorDefinition } from './types.js'

/**
 * OpenAI error definitions mapped by HTTP status code
 * Some status codes have multiple possible error types identified by message patterns
 */
export const OPENAI_ERRORS: Record<number, ApiErrorDefinition | ApiErrorDefinition[]> = {
  400: {
    type: 'validation',
    message: 'Invalid request to OpenAI API',
    action: 'Check request parameters',
    severity: 'error',
  },
  401: [
    {
      type: 'auth',
      message: 'Your OpenAI API key is incorrect',
      action: 'Check your API key at platform.openai.com/api-keys',
      actionUrl: 'https://platform.openai.com/api-keys',
      severity: 'error',
    },
    {
      type: 'auth',
      message: 'Your account is not part of an organization',
      action: 'Contact OpenAI or your organization admin',
      actionUrl: 'https://platform.openai.com/account/org-settings',
      severity: 'error',
    },
    {
      type: 'auth',
      message: 'Your IP address is not in the allowlist',
      action: 'Update your IP allowlist in OpenAI settings',
      actionUrl: 'https://platform.openai.com/account/org-settings',
      severity: 'error',
    },
  ],
  403: {
    type: 'auth',
    message: 'Your region is not supported by OpenAI',
    action: 'See OpenAI\'s supported countries page',
    actionUrl: 'https://platform.openai.com/docs/supported-countries',
    severity: 'error',
  },
  429: [
    {
      type: 'rate_limit',
      message: 'Sending requests too quickly. Automatically slowing down.',
      action: 'Will retry automatically',
      autoRetry: true,
      retryAfterSeconds: 60,
      severity: 'warning',
    },
    {
      type: 'limit',
      message: 'You\'ve run out of API credits or hit your monthly limit.',
      action: 'Buy credits at platform.openai.com/account/billing',
      actionUrl: 'https://platform.openai.com/account/billing',
      severity: 'error',
    },
  ],
  500: {
    type: 'outage',
    message: 'OpenAI servers are having issues. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
  502: {
    type: 'outage',
    message: 'OpenAI gateway error. Will retry automatically.',
    autoRetry: true,
    retryAfterSeconds: 30,
    severity: 'info',
  },
  503: [
    {
      type: 'outage',
      message: 'OpenAI is experiencing high traffic. Will retry automatically.',
      autoRetry: true,
      retryAfterSeconds: 60,
      severity: 'info',
    },
    {
      type: 'rate_limit',
      message: 'Request rate affecting service. Automatically reducing speed.',
      autoRetry: true,
      retryAfterSeconds: 30,
      severity: 'warning',
    },
  ],
}

/**
 * Message patterns to disambiguate errors with same status code
 */
export const OPENAI_ERROR_PATTERNS: Record<string, { status: number; index: number }> = {
  'rate limit reached': { status: 429, index: 0 },
  'quota exceeded': { status: 429, index: 1 },
  'insufficient_quota': { status: 429, index: 1 },
  'not a member': { status: 401, index: 1 },
  'ip not authorized': { status: 401, index: 2 },
  'overloaded': { status: 503, index: 0 },
  'slow down': { status: 503, index: 1 },
}

