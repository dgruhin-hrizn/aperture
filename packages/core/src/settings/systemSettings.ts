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

