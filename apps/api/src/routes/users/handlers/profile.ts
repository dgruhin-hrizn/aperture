import type { FastifyInstance } from 'fastify'
import { registerWatchHistoryHandlers } from './profile/watchHistory.js'
import { registerUserPreferencesHandlers } from './profile/userPreferences.js'
import { registerTasteProfileHandlers } from './profile/tasteProfile.js'
import { registerWatchStatsHandlers } from './profile/watchStats.js'
import { registerWatchHistoryManagementHandlers } from './profile/watchHistoryManagement.js'
import { registerLibraryExclusionsHandlers } from './profile/libraryExclusions.js'
import { registerAlgorithmSettingsHandlers } from './profile/algorithmSettings.js'
import { registerEmailSettingsHandlers } from './profile/emailSettings.js'

export function registerProfileHandlers(fastify: FastifyInstance) {
  registerWatchHistoryHandlers(fastify)
  registerUserPreferencesHandlers(fastify)
  registerTasteProfileHandlers(fastify)
  registerWatchStatsHandlers(fastify)
  registerWatchHistoryManagementHandlers(fastify)
  registerLibraryExclusionsHandlers(fastify)
  registerAlgorithmSettingsHandlers(fastify)
  registerEmailSettingsHandlers(fastify)
}
