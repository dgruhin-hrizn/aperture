/**
 * Setup Handlers Index
 * Re-exports all handler registration functions
 */

export { registerStatusHandlers, isAdminRequest, requireSetupWritable } from './status.js'
export type { SetupProgressBody } from './status.js'
export { registerMediaServerHandlers } from './mediaServer.js'
export { registerLibrariesHandlers } from './libraries.js'
export { registerOutputHandlers } from './output.js'
export { registerValidationHandlers } from './validation.js'
export { registerUsersHandlers } from './users.js'
export { registerOpenAIHandlers } from './openai.js'
export { registerJobsHandlers } from './jobs.js'
export { registerTopPicksHandlers } from './topPicks.js'
export { registerAIHandlers } from './ai.js'
export { registerAdminHandlers } from './admin.js'
