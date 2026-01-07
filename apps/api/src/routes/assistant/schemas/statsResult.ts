/**
 * Schema for library statistics results
 */
import { z } from 'zod'

// Stats result schema
export const StatsResultSchema = z.object({
  id: z.string().describe('Unique result ID'),
  movieCount: z.number().describe('Total movies in library'),
  seriesCount: z.number().describe('Total series in library'),
  episodeCount: z.number().optional().describe('Total episodes'),
  totalRuntimeMinutes: z.number().optional().describe('Total runtime in minutes'),
  averageRating: z.number().nullable().optional().describe('Average community rating'),
  topGenres: z.array(z.object({
    genre: z.string(),
    count: z.number(),
  })).optional().describe('Most common genres'),
  watchStats: z.object({
    moviesWatched: z.number(),
    seriesStarted: z.number(),
    totalPlayCount: z.number(),
  }).optional().describe('User watch statistics'),
  ratingStats: z.object({
    totalRated: z.number(),
    averageUserRating: z.number().nullable(),
  }).optional().describe('User rating statistics'),
})

export type StatsResult = z.infer<typeof StatsResultSchema>

// Studios result schema
export const StudiosResultSchema = z.object({
  id: z.string().describe('Unique result ID'),
  studios: z.array(z.object({
    name: z.string(),
    movieCount: z.number(),
    topTitles: z.array(z.object({
      id: z.string(),
      type: z.literal('movie'),
      title: z.string(),
    })),
  })).optional(),
  networks: z.array(z.object({
    name: z.string(),
    seriesCount: z.number(),
    topTitles: z.array(z.object({
      id: z.string(),
      type: z.literal('series'),
      title: z.string(),
    })),
  })).optional(),
})

export type StudiosResult = z.infer<typeof StudiosResultSchema>

