import { getEmbeddingModelInstance, getActiveEmbeddingModelId } from '../lib/ai-provider.js'
import { getMediaServerConfig } from '../settings/systemSettings.js'
import type { ToolContext } from './types.js'
export async function createEncoreContext(userId: string, isAdmin = false): Promise<ToolContext> {
  const [embeddingModel, embeddingModelId, config] = await Promise.all([
    getEmbeddingModelInstance().catch(() => null), getActiveEmbeddingModelId(), getMediaServerConfig(),
  ])
  return { userId, isAdmin, embeddingModel, embeddingModelId: embeddingModelId ?? '',
    mediaServer: config.baseUrl && config.type ? { baseUrl: config.baseUrl, type: config.type, serverId: '' } : null }
}
