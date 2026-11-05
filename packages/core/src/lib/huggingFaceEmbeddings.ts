import type { EmbeddingModel } from 'ai'

/** The current HF Responses adapter has no embeddings; use its feature-extraction API. */
export function huggingFaceEmbeddings(config: { model: string; apiKey?: string; baseUrl?: string }): EmbeddingModel {
  return {
    specificationVersion: 'v3', provider: 'huggingface.inference', modelId: config.model,
    maxEmbeddingsPerCall: 32, supportsParallelCalls: true,
    doEmbed: async ({ values, abortSignal, headers }) => {
      const endpoint = config.baseUrl ?? `https://router.huggingface.co/hf-inference/models/${config.model.split('/').map(encodeURIComponent).join('/')}`
      const response = await fetch(endpoint, {
        method: 'POST', signal: abortSignal ? AbortSignal.any([abortSignal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
        headers: { ...headers, 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey ?? process.env.HUGGINGFACE_API_KEY ?? ''}` },
        body: JSON.stringify({ inputs: values, truncate: true }),
      })
      if (!response.ok) throw new Error(`Hugging Face embedding request failed (${response.status})`)
      const data: unknown = await response.json()
      if (!Array.isArray(data) || data.length !== values.length || !data.every((row) => Array.isArray(row) && row.length > 0 && row.every((v: unknown) => typeof v === 'number' && Number.isFinite(v))))
        throw new Error('Hugging Face returned invalid embedding vectors')
      const embeddings = data as number[][]
      if (embeddings.some((row) => row.length !== embeddings[0].length)) throw new Error('Hugging Face returned inconsistent embedding dimensions')
      return { embeddings, warnings: [] }
    },
  }
}
