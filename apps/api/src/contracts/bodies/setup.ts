import { z } from 'zod'
import { aiModelDiscoveryBody, outputModes } from './settings.js'

export const setupBodies = {
  'POST /api/setup/ai/models': aiModelDiscoveryBody,
  'POST /api/setup/ai-recs-output': outputModes.default({}),
  'POST /api/setup/output-config': z.object({
    apertureLibrariesPath: z.string().max(2000).optional(), mediaServerLibrariesPath: z.string().max(2000).optional(),
    mediaServerPathPrefix: z.string().max(2000).optional(), moviesUseSymlinks: z.boolean().optional(),
    seriesUseSymlinks: z.boolean().optional(), downloadImages: z.boolean().optional(),
  }).default({}),
}
