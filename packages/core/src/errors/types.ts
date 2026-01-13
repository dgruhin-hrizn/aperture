/**
 * API Error Types
 * 
 * Shared types for handling and categorizing API errors
 * from external integrations (OpenAI, TMDb, Trakt, MDBList, OMDb)
 */

/**
 * Error category for user-facing display
 */
export type ErrorType = 'auth' | 'rate_limit' | 'limit' | 'outage' | 'validation'

/**
 * Severity level for UI display
 * - error (red): User action required (auth issues)
 * - warning (amber): May need action (rate limits, account limits)
 * - info (blue): Informational only (service outages)
 */
export type ErrorSeverity = 'error' | 'warning' | 'info'

/**
 * Definition of how to handle and display a specific error
 */
export interface ApiErrorDefinition {
  /** Error category */
  type: ErrorType
  /** User-friendly error message */
  message: string
  /** Suggested action for the user */
  action?: string
  /** URL where user can resolve the issue */
  actionUrl?: string
  /** Whether the system will automatically retry */
  autoRetry?: boolean
  /** Default retry delay in seconds */
  retryAfterSeconds?: number
  /** UI severity level */
  severity: ErrorSeverity
}

/**
 * Parsed error with all context needed for display
 */
export interface ParsedApiError {
  /** Which external API */
  provider: 'openai' | 'tmdb' | 'trakt' | 'mdblist' | 'omdb'
  /** HTTP status code from response */
  httpStatus: number
  /** Provider-specific error code (if available) */
  errorCode?: string
  /** Raw error message from API */
  rawMessage?: string
  /** Matched error definition */
  definition: ApiErrorDefinition
  /** When rate limit resets (if known) */
  resetAt?: Date
}

/**
 * API error record for database storage
 */
export interface ApiErrorRecord {
  id?: string
  provider: ParsedApiError['provider']
  errorType: ErrorType
  errorCode: string | null
  httpStatus: number
  jobId?: string | null
  errorMessage: string
  resetAt: Date | null
  actionUrl: string | null
  createdAt?: Date
  dismissedAt?: Date | null
}

