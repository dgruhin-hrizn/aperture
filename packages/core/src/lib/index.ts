export { createLogger, getLogger, createChildLogger, type Logger } from './logger.js'

export {
  getPool,
  query,
  queryOne,
  transaction,
  closePool,
  healthCheck,
  type QueryResult,
  type Pool,
  type PoolClient,
} from './db.js'

// AI Provider Abstraction
export {
  // Configuration
  getAIConfig,
  setAIConfig,
  getFunctionConfig,
  setFunctionConfig,
  // Model Factory (returns AI SDK model instances)
  getEmbeddingModelInstance,
  getChatModelInstance,
  getTextGenerationModelInstance,
  // Capability Checking
  getAICapabilitiesStatus,
  isAIFunctionConfigured,
  isAnyAIConfigured,
  isFullyConfigured,
  getCurrentEmbeddingDimensions,
  // Connection Testing
  testProviderConnection,
  // Backwards Compatibility
  getOpenAIApiKeyLegacy,
  // Re-exports from capabilities
  getProvider,
  getModel,
  getDefaultModel,
  validateCapabilityForFeature,
  getEmbeddingDimensions,
  getProvidersForFunction,
  getModelsForFunction,
  getPricingForModel,
  getPricingForModelAsync,
  PROVIDERS,
  // Pricing cache
  getPricingData,
  findModelPricing,
  refreshPricingCache,
  getPricingCacheStatus,
  // Types
  type ProviderType,
  type ProviderConfig,
  type AIConfig,
  type FunctionStatus,
  type AICapabilitiesStatus,
  type AIFunction,
  type ModelMetadata,
  type ProviderMetadata,
  type ModelCapabilities,
  type FunctionPricing,
} from './ai-provider.js'
