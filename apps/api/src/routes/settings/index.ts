/**
 * Settings Routes Module
 * 
 * This module aggregates all settings-related API endpoints:
 * - Media server configuration
 * - Library configuration
 * - Recommendation algorithm settings
 * - User preferences and settings
 * - AI configuration (multi-provider)
 * - Legacy AI model settings
 * - Integration settings (TMDb, OMDb, etc.)
 * - Top Picks configuration
 * - AI output and explanation settings
 * - Taste profile management
 */
import type { FastifyPluginAsync } from 'fastify'
import {
  registerMediaServerHandlers,
  registerLibraryHandlers,
  registerRecommendationHandlers,
  registerUserSettingsHandlers,
  registerAiConfigHandlers,
  registerIntegrationHandlers,
  registerTopPicksHandlers,
  registerAiOutputHandlers,
  registerTasteProfileHandlers,
  registerLegacyAiModelsHandlers,
} from './handlers/index.js'

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register all settings handlers
  registerMediaServerHandlers(fastify)
  registerLibraryHandlers(fastify)
  registerRecommendationHandlers(fastify)
  registerUserSettingsHandlers(fastify)
  registerAiConfigHandlers(fastify)
  registerIntegrationHandlers(fastify)
  registerTopPicksHandlers(fastify)
  registerAiOutputHandlers(fastify)
  registerTasteProfileHandlers(fastify)
  registerLegacyAiModelsHandlers(fastify)
}

export default settingsRoutes
