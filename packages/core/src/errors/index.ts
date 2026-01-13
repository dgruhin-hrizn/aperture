/**
 * API Error Handling Module
 * 
 * Provides structured error handling for external API integrations:
 * - OpenAI
 * - TMDb
 * - Trakt
 * - MDBList
 * - OMDb
 */

export * from './types.js'
export * from './handler.js'
export * from './db.js'

// Error constants for each provider
export { OPENAI_ERRORS, OPENAI_ERROR_PATTERNS } from './openai.js'
export { TMDB_ERRORS, TMDB_HTTP_TO_STATUS } from './tmdb.js'
export { TRAKT_ERRORS } from './trakt.js'
export { MDBLIST_ERRORS } from './mdblist.js'
export { OMDB_ERRORS, OMDB_ERROR_MESSAGES } from './omdb.js'

