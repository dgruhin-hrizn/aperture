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
  // AI Provider Abstraction
  getAIConfig,
  setAIConfig,
  getFunctionConfig,
  setFunctionConfig,
  getEmbeddingModelInstance,
  getChatModelInstance,
  getTextGenerationModelInstance,
  getAICapabilitiesStatus,
  isAIFunctionConfigured,
  isAnyAIConfigured,
  isFullyConfigured,
  getCurrentEmbeddingDimensions,
  getActiveEmbeddingModelId,
  // Multi-Dimension Embedding Tables
  VALID_EMBEDDING_DIMENSIONS,
  getEmbeddingTableSuffix,
  getActiveEmbeddingTableName,
  // Legacy Embedding Cleanup
  checkLegacyEmbeddingsExist,
  dropLegacyEmbeddingTables,
  testProviderConnection,
  getOpenAIApiKeyLegacy,
  getProvider,
  getModel,
  getDefaultModel,
  validateCapabilityForFeature,
  getEmbeddingDimensions,
  getProvidersForFunction,
  getModelsForFunction,
  getModelsForFunctionWithCustom,
  getPricingForModel,
  getPricingForModelAsync,
  PROVIDERS,
  // Custom models (Ollama & OpenAI-compatible)
  getCustomModels,
  addCustomModel,
  deleteCustomModel,
  // Pricing cache
  getPricingData,
  findModelPricing,
  refreshPricingCache,
  getPricingCacheStatus,
  type ProviderType,
  type ProviderConfig,
  type AIConfig,
  type FunctionStatus,
  type AICapabilitiesStatus,
  type AIFunction,
  type ModelMetadata,
  type ProviderMetadata,
  type ModelCapabilities,
  type FunctionPricing,
  type ValidEmbeddingDimension,
  type LegacyEmbeddingsInfo,
  type CustomModel,
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
  clearAndRebuildAllSeriesRecommendations,
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
  // Types for library creation transparency
  type UserLibraryResult,
  type ProcessStrmResult,
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
  streamTasteSynopsis,
  getTasteSynopsis,
  type TasteSynopsis,
} from './lib/tasteSynopsis.js'

// Series Taste Synopsis
export {
  streamSeriesTasteSynopsis,
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
  getUserUiPreferences,
  updateUserUiPreferences,
  addBrowseFilterPreset,
  updateBrowseFilterPreset,
  deleteBrowseFilterPreset,
  type UserSettings,
  type UserAiExplanationSettings,
  type UserUiPreferences,
  type ViewMode,
  type PageViewModes,
  type SortField,
  type SortOrder,
  type BrowseSortPreference,
  type BrowseFilterPreset,
} from './lib/userSettings.js'

// Library Exclusions
export {
  getUserExcludedLibraries,
  setUserExcludedLibraries,
  getUserAccessibleLibraries,
  isLibraryExcluded,
  getApertureLibraryIds,
  toggleLibraryExclusion,
  type AccessibleLibrary,
} from './lib/libraryExclusions.js'

// System Settings
export {
  getSystemSetting,
  setSystemSetting,
  getAllSystemSettings,
  // Setup wizard progress
  getSetupProgress,
  setSetupCurrentStep,
  markSetupStepCompleted,
  resetSetupProgress,
  isSetupComplete,
  markSetupComplete,
  type SetupStepId,
  type SetupProgress,
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
  getOutputPathConfig,
  setOutputPathConfig,
  detectPathMappings,
  getAiExplanationConfig,
  setAiExplanationConfig,
  getWatchingLibraryConfig,
  setWatchingLibraryConfig,
  getContinueWatchingConfig,
  setContinueWatchingConfig,
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
  isOMDbPaidTier,
  // Studio logos settings
  getStudioLogosConfig,
  setStudioLogosConfig,
  type SystemSetting,
  type EmbeddingModel,
  type TextGenerationModel,
  type TextGenerationModelInfo,
  type MediaServerConfig,
  type AiRecsOutputConfig,
  type OutputPathConfig,
  type AiExplanationConfig,
  type WatchingLibraryConfig,
  type ContinueWatchingConfig,
  type LibraryTitleConfig,
  type ChatAssistantModel,
  type ChatAssistantModelInfo,
  type TMDbConfig,
  type OMDbConfig,
  type StudioLogosConfig,
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
  getTopPicksPreviewCounts,
  writeTopPicksMovies,
  writeTopPicksSeries,
  writeAllTopPicks,
  grantTopPicksAccessToAllUsers,
  getTopPicksLibraries,
  refreshTopPicks,
  getTopMoviesPreview,
  getTopSeriesPreview,
  runAutoRequestJob,
  type TopPicksConfig,
  type PopularMovie,
  type PopularSeries,
  type RefreshTopPicksResult,
  type TopPicksPreviewParams,
  type TopPicksPreviewResult,
  type PopularitySource,
  type HybridExternalSource,
  type PreviewItem,
  type PreviewResult,
} from './topPicks/index.js'

// Watching Libraries
export {
  getWatchingLibraryName,
  ensureUserWatchingLibrary,
  refreshUserWatchingLibrary,
  updateUserWatchingLibraryPermissions,
  getUserWatchingLibraryInfo,
  writeWatchingSeriesForUser,
  processWatchingForUser,
  processWatchingLibrariesForAllUsers,
  getUpcomingEpisodes,
  getUpcomingEpisodeForSeries,
  type UpcomingEpisode,
} from './watching/index.js'

// Continue Watching
export {
  syncContinueWatchingForUser,
  syncContinueWatchingForAllUsers,
  filterAndDeduplicate,
  writeContinueWatchingForUser,
  processContinueWatchingForUser,
  processContinueWatchingForAllUsers,
  getContinueWatchingLibraryName,
  ensureUserContinueWatchingLibrary,
  refreshUserContinueWatchingLibrary,
  updateUserContinueWatchingLibraryPermissions,
  type ContinueWatchingItem,
} from './continueWatching/index.js'

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
  getEnrichmentVersionStatus,
  // Run tracking (for crash recovery)
  detectInterruptedEnrichmentRuns,
  getLastEnrichmentRun,
  getIncompleteEnrichmentRun,
  clearInterruptedEnrichmentRun,
} from './enrichment/index.js'

// Studio Logo Enrichment
export {
  enrichStudioLogos,
  getStudioLogoStats,
  populateStudiosFromMedia,
  getStudioByName,
  getStudioLogoUrl,
} from './enrichment/studioLogos.js'

// Backup
export {
  getBackupConfig,
  setBackupConfig,
  updateLastBackupInfo,
  createBackup,
  restoreBackup,
  listBackups,
  deleteBackup,
  pruneOldBackups,
  validateBackup,
  getBackupPath,
  formatBytes,
  cancelBackupProcess,
  type BackupConfig,
  type BackupInfo,
  type BackupResult,
  type RestoreResult,
} from './backup/index.js'

// Maintenance
export {
  scanMissingPosters,
  repairPosters,
  repairPostersAsync,
  type MissingPosterItem,
  type RepairResult,
  type ScanResult,
  type RepairProgress,
} from './maintenance/index.js'

// API Error Handling
export {
  // Types
  type ErrorType,
  type ErrorSeverity,
  type ApiErrorDefinition,
  type ParsedApiError,
  type ApiErrorRecord,
  // Handler functions
  parseApiError,
  toApiErrorRecord,
  shouldAutoRetry,
  getRetryDelay,
  // Database functions
  logApiError,
  getActiveApiErrors,
  getActiveErrorsByProvider,
  getLatestErrorByProvider,
  dismissApiError,
  dismissErrorsByProvider,
  dismissOutageErrors,
  cleanupOldErrors,
  hasRecentSimilarError,
  getErrorSummary,
  // Error constants
  OPENAI_ERRORS,
  OPENAI_ERROR_PATTERNS,
  TMDB_ERRORS,
  TMDB_HTTP_TO_STATUS,
  TRAKT_ERRORS,
  MDBLIST_ERRORS,
  OMDB_ERRORS,
  OMDB_ERROR_MESSAGES,
} from './errors/index.js'

// Similarity
export {
  getSimilarMovies,
  getSimilarSeries,
  getSimilarWithDepth,
  getGraphForSource,
  semanticSearch,
  buildGraphFromSemanticSearch,
  computeConnectionReasons,
  getPrimaryConnectionType,
  validateConnection,
  getValidationCacheStats,
  CONNECTION_COLORS,
  type SimilarityItem,
  type SimilarityConnection,
  type SimilarityResult,
  type GraphNode,
  type GraphEdge,
  type GraphData,
  type GraphSource,
  type SimilarityOptions,
  type SimilarityPreferences,
  type SemanticSearchOptions,
  type SemanticSearchResult,
  type ConnectionType,
  type ConnectionReason,
  type ConnectionValidation,
} from './similarity/index.js'

// MDBList Integration
export {
  // Configuration
  getMDBListConfig,
  getMDBListApiKey,
  setMDBListConfig,
  isMDBListSupporterTier,
  isMDBListConfigured,
  testMDBListConnection,
  // Lists API
  getTopLists,
  searchLists,
  getListInfo,
  getListItems,
  getListItemCounts,
  getMyLists,
  // Media Info API
  getMediaInfoByImdb,
  getMediaInfoByTmdb,
  getMediaInfoByTvdb,
  getMediaInfoBatch,
  // Helpers
  extractEnrichmentData,
  // Enrichment Job
  enrichMDBListMetadata,
  getMDBListEnrichmentStats,
  clearMDBListEnrichmentData,
  enrichSingleItem,
  // Types
  type MDBListConfig,
  type MDBListUserInfo,
  type MDBListMediaInfo,
  type MDBListItem,
  type MDBListListInfo,
  type MDBListSearchResult,
  type ListItemCounts,
  type MDBListEnrichmentData,
  type MDBListRating,
  type MDBListStream,
  type MDBListWatchProvider,
  type MDBListKeyword,
  // Constants
  MDBLIST_API_BASE_URL,
  MDBLIST_BATCH_SIZE,
  MDBLIST_SORT_OPTIONS,
  // Types
  type MDBListSortOption,
} from './mdblist/index.js'

// Graph Playlists
export {
  // AI generation
  generateGraphPlaylistName,
  generateGraphPlaylistDescription,
  // Playlist operations
  createGraphPlaylist,
  getGraphPlaylists,
  getGraphPlaylist,
  deleteGraphPlaylist,
  getGraphPlaylistItems,
  // Types
  type GraphPlaylist,
  type CreateGraphPlaylistInput,
} from './graphPlaylists/index.js'

// Jellyseerr Integration
export {
  // Configuration
  getJellyseerrConfig,
  setJellyseerrConfig,
  isJellyseerrConfigured,
  testJellyseerrConnection,
  // Search & Media Info
  searchContent as jellyseerrSearchContent,
  getMovieDetails as getJellyseerrMovieDetails,
  getTVDetails as getJellyseerrTVDetails,
  getMediaStatus as getJellyseerrMediaStatus,
  // Request Management
  createRequest as createJellyseerrRequest,
  getRequest as getJellyseerrRequest,
  getRequestStatus as getJellyseerrRequestStatus,
  deleteRequest as deleteJellyseerrRequest,
  // Batch Operations
  batchGetMediaStatus as batchGetJellyseerrMediaStatus,
  // Types
  type JellyseerrConfig,
  type JellyseerrUser,
  type JellyseerrMediaInfo,
  type JellyseerrSearchResult,
  type JellyseerrSearchItem,
  type JellyseerrMovieDetails,
  type JellyseerrTVDetails,
  type JellyseerrSeason,
  type JellyseerrMediaStatus,
  type JellyseerrRequestStatus,
  type JellyseerrRequestBody,
  type JellyseerrRequestResponse,
  type JellyseerrMediaRequest,
  getMediaStatusLabel,
  getRequestStatusLabel,
  JELLYSEERR_MEDIA_STATUS,
  JELLYSEERR_REQUEST_STATUS,
} from './jellyseerr/index.js'

// Discovery (Missing Content Suggestions)
export {
  // Pipeline
  generateDiscoveryForUser,
  generateDiscoveryForAllUsers,
  regenerateUserDiscovery,
  getDiscoveryEnabledUsers,
  // Sources
  fetchAllCandidates,
  fetchFilteredCandidates,
  hasDiscoverySources,
  // Filter
  filterCandidates,
  isInLibrary,
  hasWatched,
  // Scorer
  scoreCandidates,
  // Storage
  createDiscoveryRun,
  updateDiscoveryRunStats,
  finalizeDiscoveryRun,
  getLatestDiscoveryRun,
  storeDiscoveryCandidates,
  getDiscoveryCandidates,
  getDiscoveryCandidateCount,
  clearDiscoveryCandidates,
  createDiscoveryRequest,
  updateDiscoveryRequestStatus,
  getDiscoveryRequests,
  hasExistingRequest,
  // Types
  type MediaType,
  type DiscoverySource,
  type DiscoveryRunStatus,
  type DiscoveryRequestStatus,
  type DiscoveryCandidate,
  type DiscoveryRun,
  type DiscoveryRequest,
  type DiscoveryUser,
  type DiscoveryConfig,
  type DiscoveryFilterOptions,
  type RawCandidate,
  type ScoredCandidate,
  type DiscoveryPipelineResult,
  type DynamicFetchFilters,
  DEFAULT_DISCOVERY_CONFIG,
} from './discover/index.js'

// Taste Profile System
export {
  // Profile retrieval and storage
  getUserTasteProfile,
  getStoredProfile,
  getUserTasteData,
  storeTasteProfile,
  updateProfileSettings,
  invalidateProfile,
  isProfileStale,
  // Franchise preferences
  getUserFranchisePreferences,
  setFranchisePreference,
  bulkUpdateFranchisePreferences,
  getFranchiseBoost,
  // Genre weights
  getUserGenreWeights,
  setGenreWeight,
  bulkUpdateGenreWeights,
  getGenreBoost,
  // Custom interests
  getUserCustomInterests,
  addCustomInterest,
  removeCustomInterest,
  updateCustomInterestEmbedding,
  // Delete functions
  deleteFranchisePreference,
  deleteGenreWeight,
  // Custom interest boost
  getCustomInterestBoost,
  // Types
  type TasteProfile,
  type FranchisePreference,
  type GenreWeight,
  type CustomInterest,
  type UserTasteData,
  type ProfileBuildOptions,
  type ProfileUpdateResult,
  type WatchedItem as TasteProfileWatchedItem,
  REFRESH_INTERVAL_OPTIONS,
  DEFAULT_REFRESH_INTERVAL_DAYS,
  MIN_FRANCHISE_ITEMS_OPTIONS,
  DEFAULT_MIN_FRANCHISE_ITEMS,
  MIN_FRANCHISE_SIZE_OPTIONS,
  DEFAULT_MIN_FRANCHISE_SIZE,
} from './taste-profile/index.js'

export {
  // Franchise detection
  detectFranchiseFromTitle,
  detectAndUpdateFranchises,
  getItemFranchise,
  // Genre detection
  detectAndUpdateGenres,
} from './taste-profile/franchise.js'

export {
  // Profile building
  buildTasteProfile,
  calculateEngagementWeight,
} from './taste-profile/builder.js'

// User Algorithm Settings
export {
  getUserAlgorithmSettings,
  setUserAlgorithmSettings,
  resetUserAlgorithmSettings,
  getEffectiveAlgorithmConfig,
  normalizeWeights,
  getAdminDefaultConfig,
  type UserAlgorithmSettings,
  type UserAlgorithmWeights,
} from './lib/userAlgorithmSettings.js'

// User Sync
export {
  syncUsersFromMediaServer,
  type SyncUsersResult,
} from './users/sync.js'

// API Keys
export {
  createApiKey,
  validateApiKey,
  listApiKeys,
  listAllApiKeys,
  getApiKey,
  revokeApiKey,
  deleteApiKey,
  updateApiKey,
  deleteAllUserApiKeys,
  isApiKeyExpired,
  isApiKeyRevoked,
  getApiKeyStatus,
  EXPIRATION_OPTIONS,
  type ApiKey,
  type ApiKeyWithUser,
  type CreateApiKeyResult,
} from './apiKeys.js'
