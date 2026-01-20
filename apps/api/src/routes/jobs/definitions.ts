/**
 * Job Definitions
 * Central registry of all background jobs
 */

import type { JobDefinition } from './types.js'

export const jobDefinitions: JobDefinition[] = [
  // === User Sync Job ===
  {
    name: 'sync-users',
    description: 'Sync users from media server (imports new users, updates email/admin status)',
    cron: '*/30 * * * *', // Every 30 minutes
  },
  // === Movie Jobs ===
  {
    name: 'sync-movies',
    description: 'Sync movies from media server',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'generate-movie-embeddings',
    description: 'Generate AI embeddings for movies',
    cron: null,
  },
  {
    name: 'sync-movie-watch-history',
    description: 'Sync watched movies from media server for all users',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'generate-movie-recommendations',
    description: 'Generate AI movie recommendations for users',
    cron: process.env.RECS_CRON || '0 4 * * *',
  },
  {
    name: 'full-reset-movie-recommendations',
    description: 'Deletes ALL movie recommendations, then rebuilds from scratch. Use after major algorithm or embedding model changes.',
    cron: null,
    manualOnly: true,
  },
  {
    name: 'sync-movie-libraries',
    description: 'Build Aperture movie libraries with AI recommendations (STRM or symlinks)',
    cron: process.env.PERMS_CRON || '0 5 * * *',
  },
  // === Series Jobs ===
  {
    name: 'sync-series',
    description: 'Sync TV series and episodes from media server',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'generate-series-embeddings',
    description: 'Generate AI embeddings for TV series and episodes',
    cron: null,
  },
  {
    name: 'sync-series-watch-history',
    description: 'Sync watched episodes from media server for all users',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'generate-series-recommendations',
    description: 'Generate AI TV series recommendations for users',
    cron: process.env.RECS_CRON || '0 4 * * *',
  },
  {
    name: 'full-reset-series-recommendations',
    description: 'Deletes ALL series recommendations, then rebuilds from scratch. Use after major algorithm or embedding model changes.',
    cron: null,
    manualOnly: true,
  },
  {
    name: 'sync-series-libraries',
    description: 'Build Aperture series libraries with AI recommendations (STRM or symlinks)',
    cron: process.env.PERMS_CRON || '0 5 * * *',
  },
  // === Top Picks Jobs ===
  {
    name: 'refresh-top-picks',
    description: 'Refresh global Top Picks libraries based on popularity',
    cron: '0 6 * * *',
  },
  {
    name: 'auto-request-top-picks',
    description: 'Automatically request missing Top Picks content via Jellyseerr',
    cron: '0 0 * * 0', // Weekly on Sunday at midnight (configurable via settings)
  },
  // === Trakt Sync Job ===
  {
    name: 'sync-trakt-ratings',
    description: 'Sync ratings from Trakt for all connected users',
    cron: '0 */6 * * *', // Every 6 hours
  },
  // === Watching Libraries Job ===
  {
    name: 'sync-watching-libraries',
    description: 'Sync "Shows You Watch" libraries for all users',
    cron: '0 */4 * * *', // Every 4 hours
  },
  // === Assistant Suggestions Job ===
  {
    name: 'refresh-assistant-suggestions',
    description: 'Refresh personalized assistant suggestions for all users',
    cron: '0 * * * *', // Every hour
  },
  // === Metadata Enrichment Job ===
  {
    name: 'enrich-metadata',
    description:
      'Enrich with TMDb (keywords, collections, crew) and OMDb (RT/Metacritic scores, awards, languages, countries)',
    cron: null, // Manual by default
  },
  // === Studio Logo Enrichment Job ===
  {
    name: 'enrich-studio-logos',
    description: 'Fetch studio and network logos from TMDB',
    cron: '0 5 * * *', // Daily at 5 AM
  },
  // === MDBList Enrichment Job ===
  {
    name: 'enrich-mdblist',
    description:
      'Enrich with MDBList (Letterboxd scores, MDBList scores, streaming providers, keywords)',
    cron: '0 7 * * *', // Daily at 7 AM
  },
  // === Database Backup Job ===
  {
    name: 'backup-database',
    description: 'Create a full database backup',
    cron: '0 2 * * *', // Daily at 2 AM
  },
  // === AI Pricing Cache Job ===
  {
    name: 'refresh-ai-pricing',
    description: 'Refresh LLM pricing data from Helicone API',
    cron: '0 0 * * 0', // Weekly on Sunday at midnight
  },
  // === Discovery Suggestions Job ===
  {
    name: 'generate-discovery-suggestions',
    description: 'Generate AI-powered suggestions for content not in your library',
    cron: '0 6 * * *', // Daily at 6 AM
  },
]
