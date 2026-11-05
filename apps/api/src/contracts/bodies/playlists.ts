import { z } from 'zod'

const ids = z.array(z.string().uuid()).max(10000)
const channel = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(20000).optional(),
  genreFilters: z.array(z.string().min(1).max(100)).max(100).optional(),
  textPreferences: z.string().max(20000).optional(),
  exampleMovieIds: ids.optional(),
  isPinnedRow: z.boolean().optional(),
})
const channelPrompt = z.object({
  genres: z.array(z.string().min(1).max(100)).max(100).default([]),
  exampleMovieIds: ids.default([]),
  textPreferences: z.string().max(20000).optional(),
})
const graphSelection = z.object({ movieIds: ids.default([]), seriesIds: ids.default([]) })
const hasSelection = (value: z.infer<typeof graphSelection>) => value.movieIds.length + value.seriesIds.length > 0
const selectionMessage = 'Select at least one movie or series'

export const playlistBodies = {
  'POST /api/channels': channel,
  'PUT /api/channels/:id': channel.partial().extend({ isActive: z.boolean().optional() }),
  'POST /api/channels/ai-preferences': channelPrompt,
  'POST /api/channels/ai-name': channelPrompt,
  'POST /api/channels/ai-description': channelPrompt.extend({ playlistName: z.string().max(255).optional() }),
  // Native Emby/Jellyfin item IDs are opaque provider identifiers, not Aperture UUIDs.
  'POST /api/channels/:id/items': z.object({ itemIds: z.array(z.string().min(1).max(255)).min(1).max(10000) }),
  'POST /api/channels/:id/shares': z.object({ userId: z.string().uuid() }),
  'POST /api/graph-playlists/ai-name': graphSelection.refine(hasSelection, selectionMessage),
  'POST /api/graph-playlists/ai-description': graphSelection.extend({ name: z.string().max(255).optional() }).refine(hasSelection, selectionMessage),
  'POST /api/graph-playlists': graphSelection.extend({
    name: z.string().trim().min(1).max(255),
    description: z.string().max(20000).optional(),
    sourceItemId: z.string().uuid().optional(),
    sourceItemType: z.enum(['movie', 'series']).optional(),
  }).refine(hasSelection, selectionMessage),
}
