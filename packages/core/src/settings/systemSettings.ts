import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'

const logger = createChildLogger('system-settings')

export interface SystemSetting {
  key: string
  value: string
  description: string | null
  updatedAt: Date
}

/**
 * Get a system setting by key
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  const result = await queryOne<{ value: string }>(
    'SELECT value FROM system_settings WHERE key = $1',
    [key]
  )
  return result?.value ?? null
}

/**
 * Get a system setting with metadata
 */
export async function getSystemSettingFull(key: string): Promise<SystemSetting | null> {
  const result = await queryOne<{
    key: string
    value: string
    description: string | null
    updated_at: Date
  }>('SELECT key, value, description, updated_at FROM system_settings WHERE key = $1', [key])

  if (!result) return null

  return {
    key: result.key,
    value: result.value,
    description: result.description,
    updatedAt: result.updated_at,
  }
}

/**
 * Set a system setting
 */
export async function setSystemSetting(
  key: string,
  value: string,
  description?: string
): Promise<void> {
  await query(
    `INSERT INTO system_settings (key, value, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       description = COALESCE(EXCLUDED.description, system_settings.description),
       updated_at = NOW()`,
    [key, value, description ?? null]
  )
  logger.info({ key, value }, 'System setting updated')
}

/**
 * Get all system settings
 */
export async function getAllSystemSettings(): Promise<SystemSetting[]> {
  const result = await query<{
    key: string
    value: string
    description: string | null
    updated_at: Date
  }>('SELECT key, value, description, updated_at FROM system_settings ORDER BY key')

  return result.rows.map((row) => ({
    key: row.key,
    value: row.value,
    description: row.description,
    updatedAt: row.updated_at,
  }))
}

// ============================================================================
// Embedding Model Setting
// ============================================================================

export type EmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large'

export const EMBEDDING_MODELS: { id: EmbeddingModel; name: string; description: string; dimensions: number; costPer1M: string }[] = [
  {
    id: 'text-embedding-3-small',
    name: 'Small (Recommended)',
    description: 'Fast, cost-effective, good quality. Best for most use cases.',
    dimensions: 1536,
    costPer1M: '$0.02',
  },
  {
    id: 'text-embedding-3-large',
    name: 'Large (Premium)',
    description: 'Best quality, captures nuanced similarities. ~6x more expensive.',
    dimensions: 3072,
    costPer1M: '$0.13',
  },
]

/**
 * Get the configured embedding model
 * Falls back to environment variable, then to default (large for best quality)
 */
export async function getEmbeddingModel(): Promise<EmbeddingModel> {
  // First check database setting
  const dbValue = await getSystemSetting('embedding_model')
  if (dbValue && isValidEmbeddingModel(dbValue)) {
    return dbValue
  }

  // Fall back to environment variable
  const envValue = process.env.OPENAI_EMBED_MODEL
  if (envValue && isValidEmbeddingModel(envValue)) {
    return envValue
  }

  // Default to large model for best quality recommendations
  return 'text-embedding-3-large'
}

/**
 * Set the embedding model
 */
export async function setEmbeddingModel(model: EmbeddingModel): Promise<void> {
  if (!isValidEmbeddingModel(model)) {
    throw new Error(`Invalid embedding model: ${model}`)
  }
  await setSystemSetting(
    'embedding_model',
    model,
    'OpenAI embedding model. Options: text-embedding-3-small, text-embedding-3-large'
  )
}

function isValidEmbeddingModel(model: string): model is EmbeddingModel {
  return EMBEDDING_MODELS.some((m) => m.id === model)
}

// ============================================================================
// Media Server Settings
// ============================================================================

export type MediaServerType = 'emby' | 'jellyfin'

export interface MediaServerConfig {
  type: MediaServerType | null
  baseUrl: string | null
  apiKey: string | null
  isConfigured: boolean
}

const MEDIA_SERVER_TYPES: MediaServerType[] = ['emby', 'jellyfin']

/**
 * Get media server configuration from database
 * Falls back to environment variables for backwards compatibility
 */
export async function getMediaServerConfig(): Promise<MediaServerConfig> {
  // Try database first
  const dbType = await getSystemSetting('media_server_type')
  const dbBaseUrl = await getSystemSetting('media_server_base_url')
  const dbApiKey = await getSystemSetting('media_server_api_key')

  // If any DB settings exist, use them (even if partial)
  if (dbType || dbBaseUrl || dbApiKey) {
    return {
      type: isValidMediaServerType(dbType) ? dbType : null,
      baseUrl: dbBaseUrl || null,
      apiKey: dbApiKey || null,
      isConfigured: !!(dbType && dbBaseUrl && dbApiKey),
    }
  }

  // Fall back to environment variables
  const envType = process.env.MEDIA_SERVER_TYPE
  const envBaseUrl = process.env.MEDIA_SERVER_BASE_URL
  const envApiKey = process.env.MEDIA_SERVER_API_KEY

  return {
    type: isValidMediaServerType(envType) ? envType : null,
    baseUrl: envBaseUrl || null,
    apiKey: envApiKey || null,
    isConfigured: !!(envType && envBaseUrl && envApiKey),
  }
}

/**
 * Set media server configuration
 */
export async function setMediaServerConfig(config: {
  type?: MediaServerType
  baseUrl?: string
  apiKey?: string
}): Promise<MediaServerConfig> {
  if (config.type !== undefined) {
    if (!isValidMediaServerType(config.type)) {
      throw new Error(`Invalid media server type: ${config.type}. Valid options: ${MEDIA_SERVER_TYPES.join(', ')}`)
    }
    await setSystemSetting('media_server_type', config.type, 'Media server type: emby or jellyfin')
  }

  if (config.baseUrl !== undefined) {
    await setSystemSetting('media_server_base_url', config.baseUrl, 'Media server base URL')
  }

  if (config.apiKey !== undefined) {
    await setSystemSetting('media_server_api_key', config.apiKey, 'Media server API key')
  }

  logger.info('Media server config updated')
  return getMediaServerConfig()
}

/**
 * Test media server connection with given credentials
 */
export async function testMediaServerConnection(config: {
  type: MediaServerType
  baseUrl: string
  apiKey: string
}): Promise<{ success: boolean; serverName?: string; error?: string }> {
  try {
    // Import dynamically to avoid circular dependencies
    const { createMediaServerProvider } = await import('../media/index.js')
    const provider = createMediaServerProvider(config.type, config.baseUrl)

    // Try to get server info as a connection test
    if ('getServerInfo' in provider) {
      const info = await (
        provider as { getServerInfo: (key: string) => Promise<{ id: string; name: string }> }
      ).getServerInfo(config.apiKey)
      return { success: true, serverName: info.name }
    }

    // Fallback: try to get movie libraries
    const libraries = await provider.getMovieLibraries(config.apiKey)
    return { success: true, serverName: `${config.type} server (${libraries.length} libraries)` }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.warn({ err, config: { type: config.type, baseUrl: config.baseUrl } }, 'Media server connection test failed')
    return { success: false, error }
  }
}

/**
 * Check if media server is configured (either in DB or ENV)
 */
export async function isMediaServerConfigured(): Promise<boolean> {
  const config = await getMediaServerConfig()
  return config.isConfigured
}

function isValidMediaServerType(type: string | undefined | null): type is MediaServerType {
  return type !== undefined && type !== null && MEDIA_SERVER_TYPES.includes(type as MediaServerType)
}

/**
 * Get available media server types
 */
export function getMediaServerTypes(): { id: MediaServerType; name: string }[] {
  return [
    { id: 'emby', name: 'Emby' },
    { id: 'jellyfin', name: 'Jellyfin' },
  ]
}

// ============================================================================
// Text Generation Model Setting (for recommendations, taste synopses, etc.)
// ============================================================================

export type TextGenerationModel = 'gpt-4o-mini' | 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-4.1-mini'

export interface TextGenerationModelInfo {
  id: TextGenerationModel
  name: string
  description: string
  inputCostPerMillion: number
  outputCostPerMillion: number
  contextWindow: string
}

export const TEXT_GENERATION_MODELS: TextGenerationModelInfo[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini (Recommended)',
    description: 'Best balance of quality and cost. Good for most use cases.',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.60,
    contextWindow: '128K',
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano (Budget)',
    description: 'Fastest and cheapest. Good for simple tasks.',
    inputCostPerMillion: 0.05,
    outputCostPerMillion: 0.40,
    contextWindow: '400K',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini (Premium)',
    description: 'Latest model, best quality. Higher output costs.',
    inputCostPerMillion: 0.25,
    outputCostPerMillion: 2.00,
    contextWindow: '400K',
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Previous generation mini model.',
    inputCostPerMillion: 0.40,
    outputCostPerMillion: 1.60,
    contextWindow: '128K',
  },
]

/**
 * Get the configured text generation model
 * Falls back to default (gpt-4o-mini for best cost/quality balance)
 */
export async function getTextGenerationModel(): Promise<TextGenerationModel> {
  const dbValue = await getSystemSetting('text_generation_model')
  if (dbValue && isValidTextGenerationModel(dbValue)) {
    return dbValue
  }
  // Default to gpt-4o-mini for best balance of quality and cost
  return 'gpt-4o-mini'
}

/**
 * Set the text generation model
 */
export async function setTextGenerationModel(model: TextGenerationModel): Promise<void> {
  if (!isValidTextGenerationModel(model)) {
    throw new Error(`Invalid text generation model: ${model}`)
  }
  await setSystemSetting(
    'text_generation_model',
    model,
    'OpenAI model for text generation (recommendations, taste synopses). Options: gpt-4o-mini, gpt-5-nano, gpt-5-mini, gpt-4.1-mini'
  )
}

function isValidTextGenerationModel(model: string): model is TextGenerationModel {
  return TEXT_GENERATION_MODELS.some((m) => m.id === model)
}

