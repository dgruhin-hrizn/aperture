import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'

const logger = createChildLogger('system-settings')

// Keys that contain sensitive data and should be redacted in logs
const SENSITIVE_SETTING_KEYS = new Set([
  'media_server_api_key',
  'openai_api_key',
  'tmdb_api_key',
  'omdb_api_key',
  'trakt_client_secret',
])

/**
 * Check if a setting key contains sensitive data that should be redacted
 */
function isSensitiveSetting(key: string): boolean {
  return (
    SENSITIVE_SETTING_KEYS.has(key) ||
    key.includes('api_key') ||
    key.includes('secret') ||
    key.includes('password') ||
    key.includes('token')
  )
}

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
  const logValue = isSensitiveSetting(key) ? '[REDACTED]' : value
  logger.info({ key, value: logValue }, 'System setting updated')
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
// Setup Wizard Progress (Resumable Onboarding)
// ============================================================================

export type SetupStepId =
  | 'mediaServer'
  | 'mediaLibraries'
  | 'aiRecsLibraries'
  | 'users'
  | 'topPicksEnable'
  | 'topPicksOutput'
  | 'openai'
  | 'initialJobs'

export interface SetupProgress {
  completedSteps: SetupStepId[]
  currentStep: SetupStepId | null
  completedAt: Date | null
  updatedAt: Date
}

async function ensureSetupProgressRow(): Promise<void> {
  await query(`INSERT INTO setup_progress (id) VALUES (1) ON CONFLICT (id) DO NOTHING`)
}

export async function getSetupProgress(): Promise<SetupProgress> {
  await ensureSetupProgressRow()

  const row = await queryOne<{
    completed_steps: unknown
    current_step: string | null
    completed_at: Date | null
    updated_at: Date
  }>(
    `SELECT completed_steps, current_step, completed_at, updated_at
     FROM setup_progress WHERE id = 1`
  )

  const completedSteps = Array.isArray((row?.completed_steps as unknown[] | undefined) ?? [])
    ? (row!.completed_steps as unknown[] as string[])
    : []

  return {
    completedSteps: completedSteps.filter(Boolean) as SetupStepId[],
    currentStep: (row?.current_step as SetupStepId | null) ?? null,
    completedAt: row?.completed_at ?? null,
    updatedAt: row?.updated_at ?? new Date(),
  }
}

export async function setSetupCurrentStep(step: SetupStepId | null): Promise<void> {
  await ensureSetupProgressRow()
  await query(`UPDATE setup_progress SET current_step = $1 WHERE id = 1`, [step])
}

export async function markSetupStepCompleted(step: SetupStepId): Promise<void> {
  await ensureSetupProgressRow()
  await query(
    `UPDATE setup_progress
     SET completed_steps =
       CASE
         WHEN completed_steps ? $1 THEN completed_steps
         ELSE completed_steps || to_jsonb($1::text)
       END,
       current_step = $1
     WHERE id = 1`,
    [step]
  )
}

export async function resetSetupProgress(): Promise<void> {
  await ensureSetupProgressRow()
  await query(
    `UPDATE setup_progress
     SET completed_steps = '[]'::jsonb,
         current_step = NULL,
         completed_at = NULL
     WHERE id = 1`
  )
}

/**
 * Setup is considered complete if either:
 * - legacy system setting `setup_complete` is true, OR
 * - setup_progress.completed_at is set
 */
export async function isSetupComplete(): Promise<boolean> {
  const legacy = await getSystemSetting('setup_complete')
  if (legacy === 'true') return true

  try {
    const progress = await getSetupProgress()
    return !!progress.completedAt
  } catch {
    return false
  }
}

export async function markSetupComplete(): Promise<void> {
  await ensureSetupProgressRow()
  await query(`UPDATE setup_progress SET completed_at = NOW() WHERE id = 1`)
  await setSystemSetting('setup_complete', 'true', 'Initial setup has been completed')
}

// ============================================================================
// Embedding Model Setting
// ============================================================================

export type EmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large'

export const EMBEDDING_MODELS: {
  id: EmbeddingModel
  name: string
  description: string
  dimensions: number
  costPer1M: string
}[] = [
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
      throw new Error(
        `Invalid media server type: ${config.type}. Valid options: ${MEDIA_SERVER_TYPES.join(', ')}`
      )
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
    logger.warn(
      { err, config: { type: config.type, baseUrl: config.baseUrl } },
      'Media server connection test failed'
    )
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

/**
 * Get media server API key from database (with env fallback)
 */
export async function getMediaServerApiKey(): Promise<string | null> {
  const config = await getMediaServerConfig()
  return config.apiKey
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

export type TextGenerationModel = 'gpt-4.1-mini' | 'gpt-4.1-nano' | 'gpt-4o-mini'

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
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini (Recommended)',
    description: 'Fast and capable. 1M context window.',
    inputCostPerMillion: 0.4,
    outputCostPerMillion: 1.6,
    contextWindow: '1M',
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano (Budget)',
    description: 'Fastest and cheapest. Good for simple tasks.',
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.4,
    contextWindow: '1M',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Previous generation. Good balance of quality and cost.',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    contextWindow: '128K',
  },
]

/**
 * Get the configured text generation model
 * Falls back to default (gpt-4.1-mini for best quality and 1M context)
 */
export async function getTextGenerationModel(): Promise<TextGenerationModel> {
  const dbValue = await getSystemSetting('text_generation_model')
  if (dbValue && isValidTextGenerationModel(dbValue)) {
    return dbValue
  }
  // Default to gpt-4.1-mini for best quality and 1M context
  return 'gpt-4.1-mini'
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
    'OpenAI model for text generation (recommendations, taste synopses). Options: gpt-4.1-mini, gpt-4.1-nano, gpt-4o-mini'
  )
}

function isValidTextGenerationModel(model: string): model is TextGenerationModel {
  return TEXT_GENERATION_MODELS.some((m) => m.id === model)
}

// ============================================================================
// Chat Assistant Model Settings
// ============================================================================

export type ChatAssistantModel =
  | 'gpt-5-mini'
  | 'gpt-5-nano'
  | 'gpt-4.1-mini'
  | 'gpt-4.1-nano'
  | 'gpt-4.1'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o3-mini'

export interface ChatAssistantModelInfo {
  id: ChatAssistantModel
  name: string
  description: string
  inputCostPerMillion: number
  outputCostPerMillion: number
  contextWindow: string
}

export const CHAT_ASSISTANT_MODELS: ChatAssistantModelInfo[] = [
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano (Recommended)',
    description: 'Fastest and cheapest. 1M context window.',
    inputCostPerMillion: 0.1,
    outputCostPerMillion: 0.4,
    contextWindow: '1M',
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Fast and capable. 1M context window.',
    inputCostPerMillion: 0.4,
    outputCostPerMillion: 1.6,
    contextWindow: '1M',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'More detailed answers but slower due to thinking time.',
    inputCostPerMillion: 0.25,
    outputCostPerMillion: 2.0,
    contextWindow: '400K',
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    description: 'Expanded reasoning but slower due to thinking time.',
    inputCostPerMillion: 0.05,
    outputCostPerMillion: 0.4,
    contextWindow: '400K',
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini (Reasoning)',
    description: 'Latest reasoning model. Best for complex analysis.',
    inputCostPerMillion: 1.1,
    outputCostPerMillion: 4.4,
    contextWindow: '200K',
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1 (Full)',
    description: 'Full GPT-4.1 model. Best quality in the 4.1 family.',
    inputCostPerMillion: 2.0,
    outputCostPerMillion: 8.0,
    contextWindow: '1M',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Multimodal model with vision capabilities.',
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10,
    contextWindow: '128K',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Previous generation mini model.',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    contextWindow: '128K',
  },
]

/**
 * Get the configured chat assistant model
 * Falls back to default (gpt-4.1-nano - fastest and cheapest)
 */
export async function getChatAssistantModel(): Promise<ChatAssistantModel> {
  const dbValue = await getSystemSetting('chat_assistant_model')
  if (dbValue && isValidChatAssistantModel(dbValue)) {
    return dbValue
  }
  return 'gpt-4.1-nano'
}

/**
 * Set the chat assistant model
 */
export async function setChatAssistantModel(model: ChatAssistantModel): Promise<void> {
  if (!isValidChatAssistantModel(model)) {
    throw new Error(`Invalid chat assistant model: ${model}`)
  }
  await setSystemSetting(
    'chat_assistant_model',
    model,
    'OpenAI model for the chat assistant. Options: gpt-5-mini, gpt-5-nano, o3-mini, gpt-4.1-mini, gpt-4.1-nano, gpt-4.1, gpt-4o, gpt-4o-mini'
  )
}

function isValidChatAssistantModel(model: string): model is ChatAssistantModel {
  return CHAT_ASSISTANT_MODELS.some((m) => m.id === model)
}

// ============================================================================
// AI Recommendations Output Format Settings
// ============================================================================

export interface AiRecsOutputConfig {
  moviesUseSymlinks: boolean
  seriesUseSymlinks: boolean
}

/**
 * Get AI recommendations output format configuration
 */
export async function getAiRecsOutputConfig(): Promise<AiRecsOutputConfig> {
  const movies = await getSystemSetting('ai_recs_movies_use_symlinks')
  const series = await getSystemSetting('ai_recs_series_use_symlinks')
  return {
    moviesUseSymlinks: movies !== 'false', // Defaults to true (symlinks recommended)
    seriesUseSymlinks: series !== 'false', // Defaults to true (symlinks recommended)
  }
}

/**
 * Set AI recommendations output format
 */
export async function setAiRecsOutputConfig(
  config: Partial<AiRecsOutputConfig>
): Promise<AiRecsOutputConfig> {
  if (config.moviesUseSymlinks !== undefined) {
    await setSystemSetting(
      'ai_recs_movies_use_symlinks',
      String(config.moviesUseSymlinks),
      'Use symlinks instead of STRM files for AI Movies library'
    )
  }
  if (config.seriesUseSymlinks !== undefined) {
    await setSystemSetting(
      'ai_recs_series_use_symlinks',
      String(config.seriesUseSymlinks),
      'Use symlinks instead of STRM files for AI Series library'
    )
  }
  return getAiRecsOutputConfig()
}

// ============================================================================
// Output Path Configuration Settings
// ============================================================================

export interface OutputPathConfig {
  /** Fixed path where Aperture writes libraries (inside Aperture container) */
  apertureLibrariesPath: string
  /** Path where media server sees the Aperture libraries folder */
  mediaServerLibrariesPath: string
  /** Base path where media server sees original media files (e.g., /mnt/) */
  mediaServerPathPrefix: string
  /** Use symlinks for movie recommendations */
  moviesUseSymlinks: boolean
  /** Use symlinks for series recommendations */
  seriesUseSymlinks: boolean
  /** Download and process images with ranking overlays (Sharp) */
  downloadImages: boolean
}

// Fixed container paths (not configurable - set by volume mounts)
const APERTURE_LIBRARIES_PATH = '/aperture-libraries'
const APERTURE_MEDIA_PATH = '/media/'

// Defaults for user-configured paths
const DEFAULT_MEDIA_SERVER_LIBRARIES_PATH = '/mnt/ApertureLibraries/'
const DEFAULT_MEDIA_SERVER_PATH_PREFIX = '/mnt/'

/**
 * Get output path configuration from database
 * All configuration is done via the setup wizard - no ENV var fallbacks
 */
export async function getOutputPathConfig(): Promise<OutputPathConfig> {
  const dbLibrariesPath = await getSystemSetting('media_server_libraries_path')
  const dbPathPrefix = await getSystemSetting('media_server_path_prefix')
  const dbMoviesSymlinks = await getSystemSetting('ai_recs_movies_use_symlinks')
  const dbSeriesSymlinks = await getSystemSetting('ai_recs_series_use_symlinks')
  const dbDownloadImages = await getSystemSetting('ai_recs_download_images')

  const moviesUseSymlinks = dbMoviesSymlinks !== null ? dbMoviesSymlinks === 'true' : true
  const seriesUseSymlinks = dbSeriesSymlinks !== null ? dbSeriesSymlinks === 'true' : true

  return {
    // Fixed paths (determined by Docker volume mounts)
    apertureLibrariesPath: APERTURE_LIBRARIES_PATH,
    // User-configured paths (set in setup wizard)
    mediaServerLibrariesPath: dbLibrariesPath || DEFAULT_MEDIA_SERVER_LIBRARIES_PATH,
    mediaServerPathPrefix: dbPathPrefix || DEFAULT_MEDIA_SERVER_PATH_PREFIX,
    moviesUseSymlinks,
    seriesUseSymlinks,
    // Download images: default true (required for STRM mode, optional for symlink mode rank overlays)
    downloadImages: dbDownloadImages !== null ? dbDownloadImages === 'true' : true,
  }
}

/**
 * Get the fixed path where Aperture reads media files (inside Aperture container)
 */
export function getApertureMediaPath(): string {
  return APERTURE_MEDIA_PATH
}

/**
 * Set output path configuration
 */
export async function setOutputPathConfig(
  config: Partial<OutputPathConfig>
): Promise<OutputPathConfig> {
  if (config.mediaServerLibrariesPath !== undefined) {
    await setSystemSetting(
      'media_server_libraries_path',
      config.mediaServerLibrariesPath,
      'Path where media server sees Aperture libraries (e.g., /mnt/ApertureLibraries/)'
    )
  }
  if (config.mediaServerPathPrefix !== undefined) {
    await setSystemSetting(
      'media_server_path_prefix',
      config.mediaServerPathPrefix,
      'Base path where media server sees original media files (e.g., /mnt/)'
    )
  }
  if (config.moviesUseSymlinks !== undefined) {
    await setSystemSetting(
      'ai_recs_movies_use_symlinks',
      String(config.moviesUseSymlinks),
      'Use symlinks instead of STRM files for AI Movies library'
    )
  }
  if (config.seriesUseSymlinks !== undefined) {
    await setSystemSetting(
      'ai_recs_series_use_symlinks',
      String(config.seriesUseSymlinks),
      'Use symlinks instead of STRM files for AI Series library'
    )
  }
  if (config.downloadImages !== undefined) {
    await setSystemSetting(
      'ai_recs_download_images',
      String(config.downloadImages),
      'Download and process images with ranking overlays for AI recommendation libraries'
    )
  }
  logger.info({ config }, 'Output path config updated')
  return getOutputPathConfig()
}

/**
 * Auto-detect path mappings by comparing media server file paths with local filesystem
 * 
 * This works by:
 * 1. Getting a sample movie from the media server with its file path
 * 2. Finding the same file in Aperture's /media/ mount
 * 3. Computing the path prefix mapping
 * 
 * @returns Detected paths or null if detection failed
 */
export async function detectPathMappings(): Promise<{
  mediaServerPathPrefix: string
  mediaServerLibrariesPath: string
  sampleMediaServerPath: string
  sampleAperturePath: string
} | null> {
  const { getMediaServerProvider } = await import('../media/index.js')
  const fs = await import('fs/promises')
  const path = await import('path')
  
  try {
    const provider = await getMediaServerProvider()
    const apiKey = await getMediaServerApiKey()
    
    if (!apiKey) {
      logger.warn('Cannot detect paths: No media server API key configured')
      return null
    }
    
    // Get a sample movie with file path
    const result = await provider.getMovies(apiKey, { limit: 10 })
    
    if (result.items.length === 0) {
      logger.warn('Cannot detect paths: No movies found in media server')
      return null
    }
    
    // Find a movie with a valid path
    const movieWithPath = result.items.find(m => m.path && m.path.length > 0)
    if (!movieWithPath?.path) {
      logger.warn('Cannot detect paths: No movies have file path information')
      return null
    }
    
    const mediaServerPath = movieWithPath.path
    logger.info({ mediaServerPath }, 'Sample movie path from media server')
    
    // Aperture mounts media at /media/
    const apertureMediaRoot = '/media'
    
    // Try to find the file by walking up the path and checking different prefixes
    // Media server might see: /mnt/Movies/Inception/Inception.mkv
    // Aperture sees: /media/Movies/Inception/Inception.mkv
    
    // Extract the relative path after the media server prefix
    // We try common prefixes and see which one works
    const pathParts = mediaServerPath.split('/')
    
    for (let i = 1; i < pathParts.length - 1; i++) {
      const potentialPrefix = pathParts.slice(0, i + 1).join('/') + '/'
      const relativePath = mediaServerPath.substring(potentialPrefix.length)
      const aperturePath = path.join(apertureMediaRoot, relativePath)
      
      try {
        await fs.access(aperturePath)
        // Found it!
        logger.info(
          { mediaServerPrefix: potentialPrefix, aperturePath },
          'Detected path mapping'
        )
        
        // Infer libraries path: if media is at /mnt/, libraries are probably at /mnt/ApertureLibraries/
        const librariesPath = potentialPrefix + 'ApertureLibraries/'
        
        return {
          mediaServerPathPrefix: potentialPrefix,
          mediaServerLibrariesPath: librariesPath,
          sampleMediaServerPath: mediaServerPath,
          sampleAperturePath: aperturePath,
        }
      } catch {
        // File not found at this prefix, try next
        continue
      }
    }
    
    logger.warn(
      { mediaServerPath },
      'Could not find media server file in Aperture /media/ mount. Check volume mounts.'
    )
    return null
  } catch (err) {
    logger.error({ err }, 'Failed to detect path mappings')
    return null
  }
}

// ============================================================================
// AI Explanation Settings
// ============================================================================

export interface AiExplanationConfig {
  enabled: boolean
  userOverrideAllowed: boolean
}

/**
 * Get global AI explanation configuration
 */
export async function getAiExplanationConfig(): Promise<AiExplanationConfig> {
  const enabled = await getSystemSetting('ai_explanation_enabled')
  const userOverrideAllowed = await getSystemSetting('ai_explanation_user_override_allowed')

  return {
    enabled: enabled !== 'false', // Default to true
    userOverrideAllowed: userOverrideAllowed === 'true', // Default to false
  }
}

/**
 * Set global AI explanation configuration
 */
export async function setAiExplanationConfig(
  config: Partial<AiExplanationConfig>
): Promise<AiExplanationConfig> {
  if (config.enabled !== undefined) {
    await setSystemSetting(
      'ai_explanation_enabled',
      String(config.enabled),
      'Include AI-generated explanation of why media was recommended in NFO plot field'
    )
  }
  if (config.userOverrideAllowed !== undefined) {
    await setSystemSetting(
      'ai_explanation_user_override_allowed',
      String(config.userOverrideAllowed),
      'Allow administrators to grant individual users the ability to toggle AI explanations'
    )
  }
  return getAiExplanationConfig()
}

// ============================================================================
// Watching Library Settings (Shows You Watch)
// ============================================================================

export interface WatchingLibraryConfig {
  enabled: boolean
  useSymlinks: boolean
}

/**
 * Get watching library configuration
 */
export async function getWatchingLibraryConfig(): Promise<WatchingLibraryConfig> {
  const enabled = await getSystemSetting('watching_library_enabled')
  const useSymlinks = await getSystemSetting('watching_library_use_symlinks')

  return {
    enabled: enabled !== 'false', // Default to true
    useSymlinks: useSymlinks !== 'false', // Default to true (symlinks recommended for series)
  }
}

/**
 * Set watching library configuration
 */
export async function setWatchingLibraryConfig(
  config: Partial<WatchingLibraryConfig>
): Promise<WatchingLibraryConfig> {
  if (config.enabled !== undefined) {
    await setSystemSetting(
      'watching_library_enabled',
      String(config.enabled),
      'Enable "Shows You Watch" library feature'
    )
  }
  if (config.useSymlinks !== undefined) {
    await setSystemSetting(
      'watching_library_use_symlinks',
      String(config.useSymlinks),
      'Use symlinks instead of STRM files for watching libraries'
    )
  }
  return getWatchingLibraryConfig()
}

// ============================================================================
// Library Title Template Settings
// ============================================================================

export interface LibraryTitleConfig {
  moviesTemplate: string
  seriesTemplate: string
}

// Default templates if not configured
const DEFAULT_MOVIES_TEMPLATE = "{{username}}'s AI Picks - Movies"
const DEFAULT_SERIES_TEMPLATE = "{{username}}'s AI Picks - TV Series"

/**
 * Get library title template configuration
 */
export async function getLibraryTitleConfig(): Promise<LibraryTitleConfig> {
  const moviesTemplate = await getSystemSetting('ai_library_movies_title_template')
  const seriesTemplate = await getSystemSetting('ai_library_series_title_template')

  return {
    moviesTemplate: moviesTemplate || DEFAULT_MOVIES_TEMPLATE,
    seriesTemplate: seriesTemplate || DEFAULT_SERIES_TEMPLATE,
  }
}

/**
 * Set library title template configuration
 */
export async function setLibraryTitleConfig(
  config: Partial<LibraryTitleConfig>
): Promise<LibraryTitleConfig> {
  if (config.moviesTemplate !== undefined) {
    await setSystemSetting(
      'ai_library_movies_title_template',
      config.moviesTemplate,
      'Default title template for AI movie libraries. Supports: {{username}}, {{type}}, {{count}}, {{date}}'
    )
  }
  if (config.seriesTemplate !== undefined) {
    await setSystemSetting(
      'ai_library_series_title_template',
      config.seriesTemplate,
      'Default title template for AI series libraries. Supports: {{username}}, {{type}}, {{count}}, {{date}}'
    )
  }
  return getLibraryTitleConfig()
}

// ============================================================================
// OpenAI API Key Settings
// ============================================================================

/**
 * Get OpenAI API key from database, falling back to environment variable
 */
export async function getOpenAIApiKey(): Promise<string | null> {
  // First check database
  const dbKey = await getSystemSetting('openai_api_key')
  if (dbKey) {
    return dbKey
  }

  // Fall back to environment variable
  return process.env.OPENAI_API_KEY || null
}

/**
 * Set OpenAI API key in database
 */
export async function setOpenAIApiKey(apiKey: string): Promise<void> {
  await setSystemSetting(
    'openai_api_key',
    apiKey,
    'OpenAI API key for AI features (embeddings, recommendations, chat assistant)'
  )
  logger.info('OpenAI API key updated')
}

/**
 * Check if OpenAI API key is configured (either in DB or ENV)
 */
export async function hasOpenAIApiKey(): Promise<boolean> {
  const key = await getOpenAIApiKey()
  return !!key && key.length > 0
}

/**
 * Test OpenAI API connection with the configured key
 */
export async function testOpenAIConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = await getOpenAIApiKey()
    if (!apiKey) {
      return { success: false, error: 'No API key configured' }
    }

    // Make a simple API call to test the key
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (response.ok) {
      return { success: true }
    } else {
      const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
      return {
        success: false,
        error: data.error?.message || `API returned status ${response.status}`,
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.warn({ err }, 'OpenAI connection test failed')
    return { success: false, error }
  }
}

// ============================================================================
// TMDb API Settings
// ============================================================================

export interface TMDbConfig {
  apiKey: string | null
  enabled: boolean
  hasApiKey: boolean
}

/**
 * Get TMDb configuration
 */
export async function getTMDbConfig(): Promise<TMDbConfig> {
  const apiKey = await getSystemSetting('tmdb_api_key')
  const enabled = await getSystemSetting('tmdb_enabled')

  return {
    apiKey: apiKey || null,
    enabled: enabled !== 'false' && !!apiKey, // Enabled by default if key exists
    hasApiKey: !!apiKey,
  }
}

/**
 * Get TMDb API key
 */
export async function getTMDbApiKey(): Promise<string | null> {
  return await getSystemSetting('tmdb_api_key')
}

/**
 * Set TMDb configuration
 */
export async function setTMDbConfig(config: {
  apiKey?: string
  enabled?: boolean
}): Promise<TMDbConfig> {
  if (config.apiKey !== undefined) {
    await setSystemSetting(
      'tmdb_api_key',
      config.apiKey,
      'TMDb API key for keywords, collections, and crew data'
    )
  }
  if (config.enabled !== undefined) {
    await setSystemSetting('tmdb_enabled', String(config.enabled), 'Enable TMDb integration')
  }
  logger.info('TMDb config updated')
  return getTMDbConfig()
}

/**
 * Test TMDb API connection
 */
export async function testTMDbConnection(
  apiKey?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = apiKey || (await getTMDbApiKey())
    if (!key) {
      return { success: false, error: 'No API key configured' }
    }

    // Test with a simple API call
    const response = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${key}`)

    if (response.ok) {
      return { success: true }
    } else {
      const data = (await response.json().catch(() => ({}))) as {
        status_message?: string
      }
      return {
        success: false,
        error: data.status_message || `API returned status ${response.status}`,
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.warn({ err }, 'TMDb connection test failed')
    return { success: false, error }
  }
}

// ============================================================================
// OMDb API Settings
// ============================================================================

export interface OMDbConfig {
  apiKey: string | null
  enabled: boolean
  hasApiKey: boolean
  /** Whether user has a paid OMDb subscription (100k requests/day vs 1k free) */
  paidTier: boolean
}

/**
 * Get OMDb configuration
 */
export async function getOMDbConfig(): Promise<OMDbConfig> {
  const apiKey = await getSystemSetting('omdb_api_key')
  const enabled = await getSystemSetting('omdb_enabled')
  const paidTier = await getSystemSetting('omdb_paid_tier')

  return {
    apiKey: apiKey || null,
    enabled: enabled !== 'false' && !!apiKey, // Enabled by default if key exists
    hasApiKey: !!apiKey,
    paidTier: paidTier === 'true',
  }
}

/**
 * Get OMDb API key
 */
export async function getOMDbApiKey(): Promise<string | null> {
  return await getSystemSetting('omdb_api_key')
}

/**
 * Set OMDb configuration
 */
export async function setOMDbConfig(config: {
  apiKey?: string
  enabled?: boolean
  paidTier?: boolean
}): Promise<OMDbConfig> {
  if (config.apiKey !== undefined) {
    await setSystemSetting(
      'omdb_api_key',
      config.apiKey,
      'OMDb API key for Rotten Tomatoes scores, Metacritic, and awards'
    )
  }
  if (config.enabled !== undefined) {
    await setSystemSetting('omdb_enabled', String(config.enabled), 'Enable OMDb integration')
  }
  if (config.paidTier !== undefined) {
    await setSystemSetting(
      'omdb_paid_tier',
      String(config.paidTier),
      'Whether using paid OMDb subscription (100k requests/day vs 1k free)'
    )
  }
  logger.info('OMDb config updated')
  return getOMDbConfig()
}

/**
 * Check if user has paid OMDb tier
 */
export async function isOMDbPaidTier(): Promise<boolean> {
  const paidTier = await getSystemSetting('omdb_paid_tier')
  return paidTier === 'true'
}

/**
 * Test OMDb API connection
 */
export async function testOMDbConnection(
  apiKey?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = apiKey || (await getOMDbApiKey())
    if (!key) {
      return { success: false, error: 'No API key configured' }
    }

    // Test with a simple API call (search for a known movie)
    const response = await fetch(`https://www.omdbapi.com/?apikey=${key}&i=tt0111161`)

    if (response.ok) {
      const data = (await response.json()) as { Response?: string; Error?: string }
      if (data.Response === 'True') {
        return { success: true }
      } else {
        return { success: false, error: data.Error || 'Unknown error' }
      }
    } else {
      return { success: false, error: `API returned status ${response.status}` }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.warn({ err }, 'OMDb connection test failed')
    return { success: false, error }
  }
}

// ============================================================================
// Studio Logo Settings
// ============================================================================

export interface StudioLogosConfig {
  pushToEmby: boolean
}

/**
 * Get studio logos configuration
 */
export async function getStudioLogosConfig(): Promise<StudioLogosConfig> {
  const pushToEmby = await getSystemSetting('studio_logos_push_to_emby')

  return {
    pushToEmby: pushToEmby === 'true', // Default to false
  }
}

/**
 * Set studio logos configuration
 */
export async function setStudioLogosConfig(
  config: Partial<StudioLogosConfig>
): Promise<StudioLogosConfig> {
  if (config.pushToEmby !== undefined) {
    await setSystemSetting(
      'studio_logos_push_to_emby',
      String(config.pushToEmby),
      'Push fetched studio/network logos to Emby/Jellyfin'
    )
  }
  logger.info({ config }, 'Studio logos config updated')
  return getStudioLogosConfig()
}
