import { z } from 'zod'

const algorithm = z.object({
  similarityWeight: z.number().min(0).max(1).optional(),
  noveltyWeight: z.number().min(0).max(1).optional(),
  ratingWeight: z.number().min(0).max(1).optional(),
  diversityWeight: z.number().min(0).max(1).optional(),
  recentWatchLimit: z.number().int().min(1).max(10000).optional(),
})

export const userBodies = {
  'PUT /api/users/:id': z.object({
    displayName: z.string().max(255).optional(),
    isEnabled: z.boolean().optional(),
    moviesEnabled: z.boolean().optional(),
    seriesEnabled: z.boolean().optional(),
    discoverEnabled: z.boolean().optional(),
    discoverRequestEnabled: z.boolean().optional(),
    canManageWatchHistory: z.boolean().optional(),
    seerrUserId: z.number().int().positive().nullable().optional(),
  }),
  'PUT /api/users/:id/excluded-libraries': z.object({
    excludedLibraryIds: z.array(z.string().min(1).max(255)).max(1000),
  }),
  'PATCH /api/users/:id/excluded-libraries/:libraryId': z.object({ excluded: z.boolean() }),
  'PATCH /api/users/:id/algorithm-settings': z.object({
    enabled: z.boolean().optional(), movie: algorithm.optional(), series: algorithm.optional(),
  }),
  'PATCH /api/users/:id/email-settings': z.object({
    email: z.union([z.string().email().max(320), z.literal('')]).nullable().optional(),
    emailNotificationsEnabled: z.boolean().optional(),
  }),
  'POST /api/users/import': z.object({
    providerUserId: z.string().min(1).max(255),
    isEnabled: z.boolean().optional(),
    moviesEnabled: z.boolean().optional(),
    seriesEnabled: z.boolean().optional(),
  }),
}
