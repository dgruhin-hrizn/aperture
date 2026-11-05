import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AsyncCache } from './asyncCache.js'
import { getModel } from './ai-capabilities.js'
import type { AIFunction, ModelMetadata } from './ai-capabilities.js'

export const OPENAI_BASE_URL = 'https://api.openai.com/v1'
export const COMPATIBLE_BASE_URL = 'http://localhost:1234/v1'

export function normalizeCompatibleBaseUrl(value: string): string {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Enter an HTTP or HTTPS API base URL without credentials or query parameters.')
  url.pathname = url.pathname.replace(/\/+$/, '') || '/v1'
  return url.href
}

const modelList = z.object({
  data: z
    .array(
      z.object({
        id: z.string().min(1).max(500),
        created: z.number().nullish(),
        shutdown_date: z.string().nullish(),
        model_type: z.string().nullish(),
        max_model_len: z.number().positive().nullish(),
        capabilities: z
          .object({
            supportsToolCalling: z.boolean().optional(),
            supportsObjectGeneration: z.boolean().optional(),
            supportsEmbeddings: z.boolean().optional(),
            reasoning: z.object({
              levels: z.array(z.union([z.string().max(30), z.boolean()])).max(16),
              defaultLevel: z.union([z.string().max(30), z.boolean()]).optional(),
            }).optional().catch(undefined),
          })
          .nullish(),
      })
    )
    .max(10000),
})

const cache = new AsyncCache<z.infer<typeof modelList>['data']>(5 * 60_000, 40)
const textModel =
  /^gpt-(?:4(?:o|\.1)|[5-9](?:\.\d+)?)(?:-(?:mini|nano|pro|astra|sol|terra|luna))*(?:-\d{4}-\d{2}-\d{2})?$|^o(?:1|3(?:-mini|-pro)?|4-mini)(?:-\d{4}-\d{2}-\d{2})?$/
const nonTextTypes = new Set([
  'embedding',
  'embeddings',
  'reranker',
  'rerank',
  'decision',
  'audio',
  'speech',
  'tts',
  'asr',
  'image',
  'video',
  'markitdown',
])

export function openAIModelMetadata(id: string, fn: AIFunction): ModelMetadata | undefined {
  const known = getModel('openai', id, fn)
  if (known) return known
  if (fn === 'embeddings' || !textModel.test(id)) return undefined
  return {
    id,
    name: id,
    capabilities: {
      supportsToolCalling: true,
      supportsToolStreaming: true,
      supportsObjectGeneration: true,
      supportsEmbeddings: false,
    },
  }
}

export async function discoverEndpointModels(
  provider: 'openai' | 'openai-compatible',
  fn: AIFunction,
  baseUrl: string,
  apiKey?: string,
  refresh = false,
  timeout = 8000
): Promise<ModelMetadata[]> {
  const key = createHash('sha256')
    .update(JSON.stringify([baseUrl, apiKey]))
    .digest('hex')
  const load = async () => {
    const response = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(timeout),
      redirect: 'error',
    })
    if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}.`)
    return modelList.parse(await response.json()).data
  }
  if (refresh) cache.delete(key)
  const rows = await cache.get(key, load)
  const today = new Date().toISOString().slice(0, 10)
  const models = new Map<string, ModelMetadata>()
  for (const row of [...rows].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))) {
    if (models.has(row.id) || (row.shutdown_date && row.shutdown_date <= today)) continue
    if (provider === 'openai') {
      const model = openAIModelMetadata(row.id, fn)
      if (
        model &&
        (fn !== 'chat' || model.capabilities.supportsToolCalling) &&
        (fn !== 'exploration' || model.capabilities.supportsObjectGeneration)
      )
        models.set(row.id, model)
      continue
    }

    const capabilities = row.capabilities
    const kind = row.model_type?.toLowerCase()
    const embedding =
      capabilities?.supportsEmbeddings ??
      (kind
        ? ['embedding', 'embeddings'].includes(kind)
        : /(?:embed|bge|gte|e5)(?:[\W_]|$)/i.test(row.id))
    const text =
      !nonTextTypes.has(kind ?? '') && !/(?:rerank|whisper|tts|speech)(?:[\W_]|$)/i.test(row.id)
    if (fn === 'embeddings' ? !embedding : !text || embedding) continue
    if (fn === 'chat' && capabilities?.supportsToolCalling === false) continue
    if (fn === 'exploration' && capabilities?.supportsObjectGeneration === false) continue
    models.set(row.id, {
      id: row.id,
      name: row.id,
      contextWindow: row.max_model_len?.toLocaleString('en-US'),
      capabilities: {
        supportsToolCalling: capabilities?.supportsToolCalling === true,
        supportsToolStreaming: false,
        supportsObjectGeneration: capabilities?.supportsObjectGeneration === true,
        supportsEmbeddings: embedding,
        ...(capabilities?.reasoning && { reasoning: capabilities.reasoning }),
      },
    })
  }
  return [...models.values()]
}
