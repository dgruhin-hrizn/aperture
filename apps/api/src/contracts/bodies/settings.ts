import { z } from 'zod'
import { VALID_EMBEDDING_DIMENSIONS, providerTypeSchema, aiFunctionSchema } from '@aperture/core'

export const provider = providerTypeSchema
export const aiFunction = aiFunctionSchema
export const aiModelDiscoveryBody = z.object({
  provider: z.enum(['openai', 'openai-compatible']),
  function: aiFunction,
  apiKey: z.string().trim().min(1).max(10000).optional(),
  baseUrl: z.string().trim().url().max(2000).optional(),
})
const model = z.object({
  provider, model: z.string().trim().min(1).max(500),
  apiKey: z.string().max(10000).optional(),
  baseUrl: z.union([z.string().url().max(2000), z.literal('')]).optional(),
})
const count = z.number().int().min(0).max(1000000)
export const outputModes = z.object({
  moviesOutputMode: z.enum(['library', 'off', 'playlist']).optional(),
  seriesOutputMode: z.enum(['library', 'off', 'playlist']).optional(),
  moviesUseSymlinks: z.boolean().optional(), seriesUseSymlinks: z.boolean().optional(),
})
const integration = z.object({ apiKey: z.string().max(10000).optional(), enabled: z.boolean().optional() })

export const settingsBodies = {
  'PUT /api/settings/ai': z.object({
    embeddings: model.nullable().optional(), chat: model.nullable().optional(),
    textGeneration: model.nullable().optional(), exploration: model.nullable().optional(),
  }),
  'PATCH /api/settings/ai/:function': model,
  'POST /api/settings/ai/test': model.extend({ function: aiFunction }),
  'POST /api/settings/ai/models': aiModelDiscoveryBody,
  'POST /api/settings/ai/custom-models': z.object({
    provider: z.enum(['ollama', 'openai-compatible', 'openrouter', 'huggingface']),
    function: aiFunction, modelId: z.string().min(1).max(500),
    embeddingDimensions: z.number().int().refine(value => VALID_EMBEDDING_DIMENSIONS.includes(value as typeof VALID_EMBEDDING_DIMENSIONS[number]), 'Unsupported embedding dimensions').optional(),
  }).refine(value => value.function !== 'embeddings' || value.embeddingDimensions !== undefined, 'Embedding models require dimensions'),
  'DELETE /api/settings/ai/custom-models': z.object({ provider, function: aiFunction, modelId: z.string().min(1).max(500) }),
  'PATCH /api/settings/cost-inputs/estimates': z.object({
    weeklyMoviesAdded: count.optional(), weeklyShowsAdded: count.optional(),
    weeklyEpisodesAdded: count.optional(), weeklyChatMessagesPerUser: count.optional(),
  }),
  'PATCH /api/settings/output-format': z.object({ moviesUseSymlinks: z.boolean().optional(), seriesUseSymlinks: z.boolean().optional() }),
  'PATCH /api/settings/ai-explanation/user/:userId': z.object({ overrideAllowed: z.boolean() }),
  'PUT /api/settings/taste-profile/franchises': z.object({
    franchises: z.array(z.object({
      franchiseName: z.string().min(1).max(500), mediaType: z.enum(['movie', 'series', 'both']),
      preferenceScore: z.number().min(-1).max(1),
    })).max(10000),
  }),
  'PUT /api/settings/taste-profile/genres': z.object({
    genres: z.array(z.object({ genre: z.string().min(1).max(100), weight: z.number().min(0).max(2) })).max(1000),
  }),
  'PATCH /api/settings/streaming-discovery': z.object({
    streamingDiscoveryEnabled: z.boolean().optional(),
    providerStrips: z.array(z.string().min(1).max(100)).max(1000).optional(),
  }),
  'POST /api/settings/top-picks/preview': z.object({
    moviesMinViewers: count, moviesTimeWindowDays: count,
    seriesMinViewers: count, seriesTimeWindowDays: count,
  }),
  'PATCH /api/settings/user': z.object({ libraryName: z.string().max(255).nullable().optional(), seriesLibraryName: z.string().max(255).nullable().optional() }),
  'PUT /api/settings/user/include-watched': z.object({ includeWatched: z.boolean() }),
  'PATCH /api/settings/user/dislike-behavior': z.object({ dislikeBehavior: z.enum(['exclude', 'penalize']) }),
  'PATCH /api/settings/user/similarity-prefs': z.object({ fullFranchiseMode: z.boolean().optional(), hideWatched: z.boolean().optional() }),
  'PATCH /api/settings/tmdb': integration,
  'PATCH /api/settings/omdb': integration.extend({ paidTier: z.boolean().optional() }),
  'PATCH /api/settings/studio-logos': z.object({ pushToEmby: z.boolean().optional() }),
  'PATCH /api/settings/ai-recs/output': outputModes,
  'PATCH /api/settings/ai-explanation': z.object({ enabled: z.boolean().optional(), userOverrideAllowed: z.boolean().optional() }),
  'PATCH /api/settings/library-titles': z.object({ moviesTemplate: z.string().max(1000).optional(), seriesTemplate: z.string().max(1000).optional() }),
  'POST /api/settings/taste-profile/rebuild': z.object({ mediaType: z.enum(['movie', 'series']), mode: z.enum(['reset', 'merge']).optional() }),
  'PATCH /api/settings/taste-profile': z.object({
    mediaType: z.enum(['movie', 'series']), isLocked: z.boolean().optional(),
    refreshIntervalDays: z.number().int().nonnegative().optional(),
    minFranchiseItems: z.number().int().positive().optional(), minFranchiseSize: z.number().int().positive().optional(),
  }),
  'POST /api/settings/taste-profile/interests': z.object({ interestText: z.string().trim().min(1).max(500), weight: z.number().min(0).max(2).optional() }),
}
