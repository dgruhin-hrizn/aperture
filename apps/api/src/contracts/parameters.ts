import { z } from 'zod'
import { aiFunction } from './bodies/settings.js'

export const parameterContracts = {
  // The old shared "delete taste item" schema incorrectly required a UUID named id here.
  'DELETE /api/settings/taste-profile/franchises/:franchiseName': z.object({ franchiseName: z.string().min(1).max(500) }),
  'DELETE /api/settings/taste-profile/genres/:genre': z.object({ genre: z.string().min(1).max(100) }),
  'PATCH /api/settings/ai/:function': z.object({ function: aiFunction }),
}
