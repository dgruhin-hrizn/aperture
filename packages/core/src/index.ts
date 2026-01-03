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
  type JobProgress,
  type LogEntry,
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
  updateRecommendationConfig,
  resetRecommendationConfig,
  type RecommendationConfig,
} from './lib/recommendationConfig.js'

// Database Purge
export {
  purgeMovieDatabase,
  getMovieDatabaseStats,
  type PurgeResult,
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
  type UserSettings,
} from './lib/userSettings.js'

// System Settings
export {
  getSystemSetting,
  setSystemSetting,
  getAllSystemSettings,
  getEmbeddingModel,
  setEmbeddingModel,
  EMBEDDING_MODELS,
  getMediaServerConfig,
  setMediaServerConfig,
  testMediaServerConnection,
  isMediaServerConfigured,
  getMediaServerTypes,
  type SystemSetting,
  type EmbeddingModel,
  type MediaServerConfig,
} from './settings/systemSettings.js'

