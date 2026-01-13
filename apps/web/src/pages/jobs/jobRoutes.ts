/**
 * Job-to-Route mapping for navigation between Jobs page and configuration sections.
 * Used to make job names clickable in the Jobs page, linking to their respective config areas.
 */

export interface JobRoute {
  path: string
  label: string
  section?: string // For hash anchor navigation within the page
}

export const JOB_ROUTES: Record<string, JobRoute> = {
  // Movie jobs → Media Sync
  'sync-movies': { path: '/admin/media-sync', label: 'Media Sync', section: 'movies' },
  'sync-movie-watch-history': { path: '/admin/media-sync', label: 'Media Sync', section: 'movies' },
  'full-sync-movie-watch-history': { path: '/admin/media-sync', label: 'Media Sync', section: 'movies' },
  'generate-movie-embeddings': { path: '/admin/media-sync', label: 'Media Sync', section: 'movies' },
  
  // Movie jobs → AI Recommendations
  'generate-movie-recommendations': { path: '/admin/ai-recommendations', label: 'AI Recommendations' },
  'rebuild-movie-recommendations': { path: '/admin/ai-recommendations', label: 'AI Recommendations' },
  'sync-movie-libraries': { path: '/admin/ai-recommendations', label: 'AI Recommendations' },
  
  // Series jobs → Media Sync
  'sync-series': { path: '/admin/media-sync', label: 'Media Sync', section: 'series' },
  'sync-series-watch-history': { path: '/admin/media-sync', label: 'Media Sync', section: 'series' },
  'full-sync-series-watch-history': { path: '/admin/media-sync', label: 'Media Sync', section: 'series' },
  'generate-series-embeddings': { path: '/admin/media-sync', label: 'Media Sync', section: 'series' },
  
  // Series jobs → AI Recommendations
  'generate-series-recommendations': { path: '/admin/ai-recommendations', label: 'AI Recommendations' },
  'sync-series-libraries': { path: '/admin/ai-recommendations', label: 'AI Recommendations' },
  
  // Global jobs → Integrations
  'enrich-metadata': { path: '/admin/integrations', label: 'Integrations', section: 'enrichment' },
  'enrich-studio-logos': { path: '/admin/integrations', label: 'Integrations', section: 'enrichment' },
  'enrich-mdblist': { path: '/admin/integrations', label: 'Integrations', section: 'enrichment' },
  'sync-trakt-ratings': { path: '/admin/integrations', label: 'Integrations', section: 'trakt' },
  
  // Global jobs → Feature pages
  'refresh-top-picks': { path: '/admin/top-picks', label: 'Top Picks' },
  'sync-watching-libraries': { path: '/admin/watching', label: 'Shows You Watch' },
}

/**
 * Get the full path with hash anchor for a job
 */
export function getJobRoutePath(jobName: string): string {
  const route = JOB_ROUTES[jobName]
  if (!route) return '/admin/jobs'
  return route.section ? `${route.path}#${route.section}` : route.path
}

/**
 * Get the display label for a job's configuration location
 */
export function getJobRouteLabel(jobName: string): string | null {
  const route = JOB_ROUTES[jobName]
  if (!route) return null
  return route.section ? `${route.label} → ${route.section.charAt(0).toUpperCase() + route.section.slice(1)}` : route.label
}

