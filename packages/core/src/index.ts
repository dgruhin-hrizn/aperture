// Config
export { getEnv, validateEnv, isProduction, isDevelopment, getDatabaseUrl, type Env } from './config/index.js'

// Lib
export {
  createLogger,
  getLogger,
  createChildLogger,
  type Logger,
  getPool,
  query,
  queryOne,
  transaction,
  closePool,
  healthCheck,
  type QueryResult,
  type Pool,
  type PoolClient,
} from './lib/index.js'

// Migrations
export { runMigrations, getMigrationStatus, type MigrationResult } from './migrations.js'

// Media Server Providers
export {
  EmbyProvider,
  JellyfinProvider,
  createMediaServerProvider,
  getMediaServerProvider,
  type MediaServerProvider,
  type MediaServerType,
  type AuthResult,
  type MediaServerUser,
  type Library,
  type PaginationOptions,
  type PaginatedResult,
  type Movie,
  type Series,
  type Episode,
  type WatchedItem,
  type WatchedEpisode,
  type PlaylistCreateResult,
  type CollectionCreateResult,
  type LibraryCreateResult,
  type MediaSource,
  type UserData,
} from './media/index.js'

// Recommender
export {
  // Movie embeddings
  buildCanonicalText,
  embedMovies,
  storeEmbeddings,
  getMoviesWithoutEmbeddings,
  generateMissingEmbeddings,
  getMovieEmbedding,
  averageEmbeddings,
  // Series embeddings
  buildSeriesCanonicalText,
  buildEpisodeCanonicalText,
  embedSeries,
  embedEpisodes,
  storeSeriesEmbeddings,
  storeEpisodeEmbeddings,
  getSeriesWithoutEmbeddings,
  getEpisodesWithoutEmbeddings,
  generateMissingSeriesEmbeddings,
  getSeriesEmbedding,
  getEpisodeEmbedding,
  getSeriesEpisodeEmbeddings,
  // Recommendations
  generateRecommendationsForUser,
  generateRecommendationsForAllUsers,
  clearUserRecommendations,
  clearAllRecommendations,
  clearAndRebuildAllRecommendations,
  regenerateUserRecommendations,
  // Movie sync
  syncMovies,
  syncWatchHistoryForUser,
  syncWatchHistoryForAllUsers,
  // Series sync
  syncSeries,
  syncSeriesWatchHistoryForUser,
  syncSeriesWatchHistoryForAllUsers,
  // Series recommendations
  generateSeriesRecommendationsForUser,
  generateSeriesRecommendationsForAllUsers,
  regenerateUserSeriesRecommendations,
  clearUserSeriesRecommendations,
  clearAllSeriesRecommendations,
  type SeriesUser,
  type SeriesCandidate,
  type SeriesPipelineConfig,
} from './recommender/index.js'

// STRM Writer
export {
  writeStrmFilesForUser,
  ensureUserLibrary,
  refreshUserLibrary,
  updateUserLibraryPermissions,
  processStrmForAllUsers,
  // Series STRM
  writeSeriesStrmFilesForUser,
  ensureUserSeriesLibrary,
  refreshUserSeriesLibrary,
  updateUserSeriesLibraryPermissions,
  processSeriesStrmForAllUsers,
} from './strm/index.js'

// Channels
export {
  generateChannelRecommendations,
  updateChannelPlaylist,
  createSharedPlaylist,
  processAllChannels,
  writeChannelStrm,
  generateAIPreferences,
  generateAIPlaylistName,
  generateAIPlaylistDescription,
} from './channels/index.js'

// Job Progress
export {
  createJobProgress,
  setJobStep,
  updateJobProgress,
  addLog,
  completeJob,
  failJob,
  cancelJob,
  isJobCancelled,
  getJobProgress,
  getAllJobProgress,
  subscribeToJob,
  subscribeToAllJobs,
  withProgress,
  getJobRunHistory,
  getLastJobRuns,
  type JobProgress,
  type LogEntry,
  type JobRunRecord,
} from './jobs/index.js'

// Job Config
export {
  getJobConfig,
  getAllJobConfigs,
  setJobConfig,
  scheduleToCron,
  formatSchedule,
  getValidJobNames,
  type JobConfig,
  type ScheduleType,
} from './jobs/index.js'

// Library Config
export {
  getLibraryConfigs,
  getEnabledLibraryConfigs,
  getEnabledLibraryIds,
  getEnabledTvLibraryIds,
  upsertLibraryConfig,
  setLibraryEnabled,
  syncLibraryConfigsFromProvider,
  type LibraryConfig,
} from './lib/libraryConfig.js'

// Recommendation Config
export {
  getRecommendationConfig,
  getMovieRecommendationConfig,
  getSeriesRecommendationConfig,
  updateRecommendationConfig,
  updateMovieRecommendationConfig,
  updateSeriesRecommendationConfig,
  resetRecommendationConfig,
  resetMovieRecommendationConfig,
  resetSeriesRecommendationConfig,
  type RecommendationConfig,
  type MediaTypeConfig,
  type LegacyRecommendationConfig,
} from './lib/recommendationConfig.js'

// Database Purge
export {
  purgeMovieDatabase,
  getMovieDatabaseStats,
  type PurgeResult,
  type DatabaseStats,
} from './lib/purge.js'

// Taste Synopsis
export {
  generateTasteSynopsis,
  getTasteSynopsis,
  type TasteSynopsis,
} from './lib/tasteSynopsis.js'

// Series Taste Synopsis
export {
  generateSeriesTasteSynopsis,
  getSeriesTasteSynopsis,
  type SeriesTasteSynopsis,
} from './lib/tasteSeriesSynopsis.js'

// User Settings
export {
  getUserSettings,
  updateUserSettings,
  getDefaultLibraryNamePrefix,
  getUserAiExplanationSettings,
  setUserAiExplanationOverride,
  setUserAiExplanationPreference,
  getEffectiveAiExplanationSetting,
  type UserSettings,
  type UserAiExplanationSettings,
} from './lib/userSettings.js'

// System Settings
export {
  getSystemSetting,
  setSystemSetting,
  getAllSystemSettings,
  getEmbeddingModel,
  setEmbeddingModel,
  EMBEDDING_MODELS,
  getTextGenerationModel,
  setTextGenerationModel,
  TEXT_GENERATION_MODELS,
  getChatAssistantModel,
  setChatAssistantModel,
  CHAT_ASSISTANT_MODELS,
  getMediaServerConfig,
  getMediaServerApiKey,
  setMediaServerConfig,
  testMediaServerConnection,
  isMediaServerConfigured,
  getMediaServerTypes,
  getAiRecsOutputConfig,
  setAiRecsOutputConfig,
  getAiExplanationConfig,
  setAiExplanationConfig,
  getLibraryTitleConfig,
  setLibraryTitleConfig,
  getOpenAIApiKey,
  setOpenAIApiKey,
  hasOpenAIApiKey,
  testOpenAIConnection,
  // TMDb settings
  getTMDbConfig,
  getTMDbApiKey,
  setTMDbConfig,
  testTMDbConnection,
  // OMDb settings
  getOMDbConfig,
  getOMDbApiKey,
  setOMDbConfig,
  testOMDbConnection,
  type SystemSetting,
  type EmbeddingModel,
  type TextGenerationModel,
  type TextGenerationModelInfo,
  type MediaServerConfig,
  type AiRecsOutputConfig,
  type AiExplanationConfig,
  type LibraryTitleConfig,
  type ChatAssistantModel,
  type ChatAssistantModelInfo,
  type TMDbConfig,
  type OMDbConfig,
} from './settings/systemSettings.js'

// Top Picks
export {
  getTopPicksConfig,
  updateTopPicksConfig,
  updateTopPicksLastRefreshed,
  resetTopPicksConfig,
  getTopMovies,
  getTopSeries,
  getTopPicks,
  writeTopPicksMovies,
  writeTopPicksSeries,
  writeAllTopPicks,
  grantTopPicksAccessToAllUsers,
  getTopPicksLibraries,
  refreshTopPicks,
  type TopPicksConfig,
  type PopularMovie,
  type PopularSeries,
  type RefreshTopPicksResult,
} from './topPicks/index.js'

// Trakt Integration
export {
  getTraktConfig,
  setTraktConfig,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshTokens,
  getTraktUser,
  getTraktRatings,
  storeUserTraktTokens,
  getUserTraktTokens,
  disconnectTrakt,
  syncTraktRatings,
  isTraktConfigured,
  getUserTraktStatus,
  pushRatingToTrakt,
  removeRatingFromTrakt,
  type TraktConfig,
  type TraktTokens,
  type TraktUser,
  type TraktRating,
  type TraktSyncResult,
} from './trakt/index.js'

// Uploads
export {
  initUploads,
  uploadImage,
  getEffectiveImage,
  getEntityImages,
  deleteUserImage,
  deleteDefaultImage,
  getImageBuffer,
  getAbsolutePath,
  getUploadsDir,
  RECOMMENDED_DIMENSIONS,
  pushImageToMediaServer,
  deleteImageFromMediaServer,
  syncEntityImageToMediaServer,
  syncAllEntityImagesToMediaServer,
  syncLibraryTypeImage,
  type EntityType,
  type MediaImage,
  type UploadImageOptions,
  type ImageDimensions,
  type ImageSyncResult,
  type LibraryType,
} from './uploads/index.js'

// TMDb Integration
export {
  // Client utilities
  tmdbRequest,
  getImageUrl,
  findMovieByImdbId,
  findTVByImdbId,
  findTVByTvdbId,
  // Movie functions
  getMovieDetails,
  getMovieKeywords,
  getMovieCredits,
  getMovieEnrichmentData,
  getMovieEnrichmentByImdbId,
  getMovieEnrichmentByTmdbId,
  // Series functions
  getTVDetails,
  getTVKeywords,
  getSeriesEnrichmentData,
  getSeriesEnrichmentByImdbId,
  getSeriesEnrichmentByTmdbId,
  getSeriesEnrichmentByTvdbId,
  // Collection functions
  getCollectionDetails,
  getCollectionData,
  getCollectionsData,
  // Constants
  TMDB_IMAGE_BASE_URL,
  TMDB_API_BASE_URL,
  // Types
  type TMDbKeyword,
  type TMDbGenre,
  type TMDbCrewMember,
  type TMDbCastMember,
  type TMDbCollection,
  type TMDbCollectionDetails,
  type TMDbCollectionPart,
  type TMDbMovieDetails,
  type TMDbMovieKeywordsResponse,
  type TMDbMovieCreditsResponse,
  type TMDbTVDetails,
  type TMDbTVKeywordsResponse,
  type TMDbTVCreditsResponse,
  type MovieEnrichmentData,
  type SeriesEnrichmentData,
  type CollectionData,
  type TMDbImageSize,
} from './tmdb/index.js'

// OMDb Integration
export {
  // Client
  omdbRequest,
  // Ratings functions
  extractRatingsData,
  getRatingsData,
  getRatingsDataBatch,
  getOMDbData,
  // Constants
  OMDB_API_BASE_URL,
  // Types
  type OMDbRating,
  type OMDbMovieResponse,
  type RatingsData,
} from './omdb/index.js'

// Enrichment
export {
  enrichMetadata,
  getEnrichmentStats,
  clearEnrichmentData,
} from './enrichment/index.js'

