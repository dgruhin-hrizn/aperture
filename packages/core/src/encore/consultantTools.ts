import { getExternalTitleDetails } from './externalDetails.js'
import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { discoverEncoreTitles, getEncoreFilmography } from './discovery.js'
import { getEncoreTaste } from './profile.js'
import { getEncoreReleases } from './releases.js'
import type { ToolContext } from './types.js'

export function createConsultantTools(ctx: ToolContext): ToolSet {
  return {
    getExternalTitleDetails: tool({
      description:
        'Get sourced movie/TV details, credits, runtime and regional streaming/rental/purchase availability from TMDb and JustWatch. Use for titles outside the local library. Provider listings do not prove subscription entitlement or episode-level availability.',
      inputSchema: z.object({
        type: z.enum(['movie', 'tv']),
        tmdbId: z.number().int().positive(),
        region: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .default('US'),
      }),
      execute: ({ type, tmdbId, region }) => getExternalTitleDetails(type, tmdbId, region),
    }),
    discoverTitles: tool({
      description:
        'Discover real movies or TV shows beyond the library using current TMDb data. Results explicitly distinguish verified local availability, external discovery and upcoming titles. Use genre IDs from TMDb (movie: 878 science fiction, 35 comedy, 27 horror, 18 drama; TV: 10765 sci-fi/fantasy, 35 comedy, 18 drama).',
      inputSchema: z.object({
        query: z.string().max(200).optional(),
        type: z.enum(['movie', 'tv']).default('movie'),
        region: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .default('US'),
        genreId: z.number().int().positive().optional(),
        year: z.number().int().min(1888).max(2200).optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: (input) => discoverEncoreTitles(ctx.userId, input),
    }),
    getFilmography: tool({
      description:
        'Look up a person’s full movie and TV credits from TMDb, including titles outside the library. Use for movie/TV knowledge and filmography gaps; source links are provided.',
      inputSchema: z.object({ name: z.string().min(1).max(150) }),
      execute: ({ name }) => getEncoreFilmography(name),
    }),
    getTasteProfile: tool({
      description:
        'Read the current user’s explicit genre/franchise/custom-interest preferences and movie/TV taste synopses. These are Aperture preferences, not guesses from a model.',
      inputSchema: z.object({}),
      execute: () => getEncoreTaste(ctx.userId),
    }),
    getReleaseSchedule: tool({
      description:
        'Look up sourced release dates for followed series, the regional TV calendar, or theatrical/digital movies. Default start is today in the user’s timezone and default end is two weeks ahead (seven dates for the regional TV calendar). Use daysAhead for relative requests. The regional TV calendar covers up to seven dates. Movies and followed series cover up to 31 days ahead. Dates are forecasts at day precision.',
      inputSchema: z.object({
        mode: z.enum(['following', 'tvCalendar', 'movies']).default('following'),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        daysAhead: z
          .number()
          .int()
          .min(0)
          .max(31)
          .optional()
          .describe('Days after the start date. Use 14 for “next few weeks” and omit endDate.'),
        region: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .default('US'),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: (input) => getEncoreReleases(ctx.userId, input, ctx.timezone),
    }),
  }
}
