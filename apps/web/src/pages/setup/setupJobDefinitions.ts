/**
 * i18n key references for setup initial jobs (resolved with t() in useSetupWizard).
 */
export const SETUP_JOB_DEFINITIONS = [
  {
    id: 'sync-movies',
    nameKey: 'setup.initialJobs.syncMovies.name',
    descriptionKey: 'setup.initialJobs.syncMovies.description',
  },
  {
    id: 'sync-series',
    nameKey: 'setup.initialJobs.syncSeries.name',
    descriptionKey: 'setup.initialJobs.syncSeries.description',
  },
  {
    id: 'sync-movie-watch-history',
    nameKey: 'setup.initialJobs.syncMovieWatchHistory.name',
    descriptionKey: 'setup.initialJobs.syncMovieWatchHistory.description',
  },
  {
    id: 'sync-series-watch-history',
    nameKey: 'setup.initialJobs.syncSeriesWatchHistory.name',
    descriptionKey: 'setup.initialJobs.syncSeriesWatchHistory.description',
  },
  {
    id: 'generate-movie-embeddings',
    nameKey: 'setup.initialJobs.generateMovieEmbeddings.name',
    descriptionKey: 'setup.initialJobs.generateMovieEmbeddings.description',
  },
  {
    id: 'generate-series-embeddings',
    nameKey: 'setup.initialJobs.generateSeriesEmbeddings.name',
    descriptionKey: 'setup.initialJobs.generateSeriesEmbeddings.description',
  },
  {
    id: 'generate-movie-recommendations',
    nameKey: 'setup.initialJobs.generateMovieRecommendations.name',
    descriptionKey: 'setup.initialJobs.generateMovieRecommendations.description',
  },
  {
    id: 'generate-series-recommendations',
    nameKey: 'setup.initialJobs.generateSeriesRecommendations.name',
    descriptionKey: 'setup.initialJobs.generateSeriesRecommendations.description',
  },
  {
    id: 'sync-movie-libraries',
    nameKey: 'setup.initialJobs.syncMovieLibraries.name',
    descriptionKey: 'setup.initialJobs.syncMovieLibraries.description',
  },
  {
    id: 'sync-series-libraries',
    nameKey: 'setup.initialJobs.syncSeriesLibraries.name',
    descriptionKey: 'setup.initialJobs.syncSeriesLibraries.description',
  },
  {
    id: 'refresh-top-picks',
    nameKey: 'setup.initialJobs.refreshTopPicks.name',
    descriptionKey: 'setup.initialJobs.refreshTopPicks.description',
    optional: true as const,
  },
] as const
