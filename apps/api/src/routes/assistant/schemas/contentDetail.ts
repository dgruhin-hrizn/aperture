/**
 * Schema for detailed content information
 */
import { z } from 'zod'
import { ActionSchema } from './contentItem.js'

// Detailed content schema for single item view
export const ContentDetailSchema = z.object({
  id: z.string().describe('Unique result ID'),
  type: z.enum(['movie', 'series']).describe('Content type'),
  contentId: z.string().describe('Content ID for linking'),
  name: z.string().describe('Title'),
  year: z.number().nullable().optional().describe('Release year'),
  yearRange: z.string().nullable().optional().describe('Year range for series'),
  tagline: z.string().nullable().optional().describe('Movie tagline'),
  overview: z.string().nullable().optional().describe('Plot summary'),
  genres: z.array(z.string()).optional().describe('Genres'),
  image: z.string().nullable().optional().describe('Poster URL'),
  runtime: z.string().nullable().optional().describe('Runtime formatted'),
  director: z.string().nullable().optional().describe('Director name'),
  cast: z.array(z.string()).optional().describe('Main cast'),
  network: z.string().nullable().optional().describe('TV network'),
  status: z.string().nullable().optional().describe('Series status'),
  seasonCount: z.number().optional().describe('Number of seasons'),
  episodeCount: z.number().optional().describe('Number of episodes'),
  communityRating: z.number().nullable().optional().describe('Community rating 0-10'),
  criticRating: z.number().nullable().optional().describe('Critic rating'),
  contentRating: z.string().nullable().optional().describe('Age rating'),
  userRating: z.number().nullable().optional().describe('User rating 1-10'),
  isWatched: z.boolean().optional().describe('Has user watched'),
  playCount: z.number().optional().describe('Times played'),
  episodesWatched: z.number().optional().describe('Episodes watched'),
  lastWatched: z.string().nullable().optional().describe('Last watched date'),
  actions: z.array(ActionSchema).describe('Action buttons'),
})

export type ContentDetail = z.infer<typeof ContentDetailSchema>

