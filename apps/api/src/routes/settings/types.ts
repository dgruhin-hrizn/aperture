/**
 * Settings Route Types
 * 
 * TypeScript interfaces for settings-related API endpoints.
 */
import type { 
  MediaServerType, 
  EmbeddingModel, 
  TextGenerationModel, 
  ChatAssistantModel,
  AIFunction,
  ProviderType,
  MediaTypeConfig,
} from '@aperture/core'

// Re-export core types for convenience
export type { 
  MediaServerType, 
  EmbeddingModel, 
  TextGenerationModel, 
  ChatAssistantModel,
  AIFunction,
  ProviderType,
  MediaTypeConfig,
}

// =============================================================================
// Media Server Types
// =============================================================================

export interface MediaServerInfo {
  baseUrl: string
  type: string
  serverId: string
  serverName: string
  webClientUrl: string
  isConfigured: boolean
}

export interface MediaServerConfig {
  type: MediaServerType | null
  baseUrl: string | null
  hasApiKey: boolean
  isConfigured: boolean
}

export interface MediaServerSecuritySettings {
  allowPasswordlessLogin: boolean
}

export interface MediaServerTestBody {
  type?: MediaServerType
  baseUrl?: string
  apiKey?: string
  useSavedCredentials?: boolean
}

export interface MediaServerConfigUpdateBody {
  type?: MediaServerType
  baseUrl?: string
  apiKey?: string
}

// =============================================================================
// Library Types
// =============================================================================

export interface LibraryConfig {
  id: string
  providerLibraryId: string
  name: string
  type: string
  isEnabled: boolean
  itemCount: number
  mediaType: 'movies' | 'series'
}

export interface LibraryConfigResponse {
  libraries: LibraryConfig[]
}

export interface LibraryUpdateBody {
  isEnabled: boolean
}

// =============================================================================
// Recommendation Config Types
// =============================================================================

export interface RecommendationWeights {
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
}

export interface RecommendationConfigResponse {
  config: {
    movies: MediaTypeConfig
    series: MediaTypeConfig
  }
}

// =============================================================================
// User Settings Types
// =============================================================================

export interface UserSettings {
  defaultTab?: string
  theme?: string
  enableAnimations?: boolean
  cardSize?: string
  showPlotSummaries?: boolean
  enableSpoilerProtection?: boolean
}

export interface UserSettingsUpdate {
  defaultTab?: string
  theme?: string
  enableAnimations?: boolean
  cardSize?: string
  showPlotSummaries?: boolean
  enableSpoilerProtection?: boolean
}

// =============================================================================
// AI Model Settings Types
// =============================================================================

export interface EmbeddingModelConfig {
  current: EmbeddingModel | null
  available: Array<{
    id: string
    name: string
    provider: string
    dimension: number
  }>
}

export interface TextGenerationModelConfig {
  current: TextGenerationModel | null
  available: Array<{
    id: string
    name: string
    provider: string
  }>
}

export interface ChatAssistantModelConfig {
  current: ChatAssistantModel | null
  available: Array<{
    id: string
    name: string
    provider: string
  }>
}

// =============================================================================
// Multi-Provider AI Settings Types
// =============================================================================

export interface AIProviderConfig {
  apiKey?: string
  baseUrl?: string
  isConfigured: boolean
}

export interface AIFunctionConfig {
  provider: ProviderType
  model: string
}

export interface AIConfig {
  providers: Record<string, AIProviderConfig>
  functions: Record<AIFunction, AIFunctionConfig>
}

export interface AICapabilitiesStatus {
  embedding: boolean
  textGeneration: boolean
  chatAssistant: boolean
  imageAnalysis?: boolean
}

export interface AIFeaturesStatus {
  embeddingEnabled: boolean
  textGenerationEnabled: boolean
  chatAssistantEnabled: boolean
  recommendationsEnabled: boolean
  explanationsEnabled: boolean
}

export interface ProviderCredentialsStatus {
  provider: string
  hasApiKey: boolean
  hasBaseUrl: boolean
  isConfigured: boolean
}

export interface AICredentialUpdateBody {
  apiKey?: string
  baseUrl?: string
}

export interface AIProviderTestBody {
  provider: ProviderType
  apiKey?: string
  baseUrl?: string
}

export interface CustomModelInput {
  provider: ProviderType
  modelId: string
  displayName?: string
  function: AIFunction
  contextWindow?: number
  inputPrice?: number
  outputPrice?: number
}

// =============================================================================
// Embedding Management Types
// =============================================================================

export interface EmbeddingSet {
  model: string
  dimension: number
  movieCount: number
  seriesCount: number
  totalCount: number
  createdAt: Date
  isActive: boolean
}

export interface EmbeddingSetsResponse {
  sets: EmbeddingSet[]
  activeModel: string | null
  validDimensions: number[]
}

// =============================================================================
// Integration Settings Types (TMDb, OMDb, etc.)
// =============================================================================

export interface TMDbConfig {
  hasApiKey: boolean
  isConfigured: boolean
}

export interface TMDbConfigUpdate {
  apiKey?: string
}

export interface OMDbConfig {
  hasApiKey: boolean
  isConfigured: boolean
}

export interface OMDbConfigUpdate {
  apiKey?: string
}

export interface StudioLogosConfig {
  enabled: boolean
  tmdbEnabled: boolean
  fanarttv: {
    enabled: boolean
    hasApiKey: boolean
  }
}

export interface StudioLogosConfigUpdate {
  enabled?: boolean
  tmdbEnabled?: boolean
  fanarttv?: {
    enabled?: boolean
    apiKey?: string
  }
}

// =============================================================================
// Top Picks Configuration Types
// =============================================================================

export interface TopPicksMediaConfig {
  enabled: boolean
  scheduleType: string
  intervalHours: number | null
  schedule: string
  itemCount: number
}

export interface TopPicksConfig {
  movies: TopPicksMediaConfig
  series: TopPicksMediaConfig
}

export interface TopPicksConfigUpdate {
  movies?: Partial<TopPicksMediaConfig>
  series?: Partial<TopPicksMediaConfig>
}

// =============================================================================
// AI Output Format Types
// =============================================================================

export interface AiRecsOutputConfig {
  format: 'poster' | 'strm' | 'both' | 'none'
  strmPath: string | null
  posterFormat: 'png' | 'jpg' | 'webp'
  posterQuality: number
}

export interface AiRecsOutputConfigUpdate {
  format?: 'poster' | 'strm' | 'both' | 'none'
  strmPath?: string | null
  posterFormat?: 'png' | 'jpg' | 'webp'
  posterQuality?: number
}

export interface AiExplanationConfig {
  enabled: boolean
  allowUserOverride: boolean
  defaultEnabled: boolean
}

export interface AiExplanationConfigUpdate {
  enabled?: boolean
  allowUserOverride?: boolean
  defaultEnabled?: boolean
}

// =============================================================================
// User AI Explanation Preference Types
// =============================================================================

export interface UserAiExplanationSettings {
  systemEnabled: boolean
  allowUserOverride: boolean
  userPreference: boolean | null
  effectiveEnabled: boolean
}

export interface UserAiExplanationUpdate {
  enabled: boolean
}

// =============================================================================
// Watching Library Types
// =============================================================================

export interface WatchingLibraryConfig {
  enabled: boolean
  movieLibraryName: string
  seriesLibraryName: string
  libraryNamePrefix: string
}

export interface WatchingLibraryConfigUpdate {
  enabled?: boolean
  movieLibraryName?: string
  seriesLibraryName?: string
}

// =============================================================================
// User Preference Types
// =============================================================================

export interface IncludeWatchedPreference {
  movies: boolean
  series: boolean
}

export interface IncludeWatchedUpdate {
  movies?: boolean
  series?: boolean
}

export interface DislikeBehaviorPreference {
  behavior: 'exclude' | 'reduce' | 'ignore'
  reductionFactor: number
}

export interface DislikeBehaviorUpdate {
  behavior?: 'exclude' | 'reduce' | 'ignore'
  reductionFactor?: number
}

export interface SimilarityPreferences {
  minSimilarity: number
  maxResults: number
  includeWatched: boolean
}

export interface SimilarityPreferencesUpdate {
  minSimilarity?: number
  maxResults?: number
  includeWatched?: boolean
}

// =============================================================================
// Library Title Templates Types
// =============================================================================

export interface LibraryTitleConfig {
  movieTemplate: string
  seriesTemplate: string
  availableVariables: string[]
}

export interface LibraryTitleConfigUpdate {
  movieTemplate?: string
  seriesTemplate?: string
}

// =============================================================================
// STRM Library Types
// =============================================================================

export interface StrmLibrary {
  id: string
  name: string
  type: 'movie_recommendations' | 'series_recommendations' | 'ai_movie_picks' | 'ai_series_picks'
  userId: string | null
  path: string
  fileCount: number
  lastUpdated: Date | null
  createdAt: Date
}

export interface StrmLibraryCreateBody {
  name: string
  type: 'movie_recommendations' | 'series_recommendations' | 'ai_movie_picks' | 'ai_series_picks'
  userId?: string
}

export interface StrmLibraryUpdateBody {
  name?: string
}

// =============================================================================
// OpenAI Legacy Settings Types
// =============================================================================

export interface OpenAIConfig {
  hasApiKey: boolean
  isConfigured: boolean
}

export interface OpenAIConfigUpdate {
  apiKey: string
}

// =============================================================================
// Cost Inputs Types
// =============================================================================

export interface CostInputs {
  totalMovies: number
  totalSeries: number
  totalEpisodes: number
  enabledUsers: number
  embeddingModel: string | null
  embeddingDimension: number
  textGenerationModel: string | null
  recsPerUserPerWeek: number
  explanationCharsPerRec: number
  jobSchedules: {
    movieRecommendations: { runsPerWeek: number; schedule: string }
    seriesRecommendations: { runsPerWeek: number; schedule: string }
  }
}

// =============================================================================
// Taste Profile Types
// =============================================================================

export interface TasteProfileItem {
  id: string
  type: 'movie' | 'series'
  mediaId: string
  title: string
  year: number | null
  posterUrl: string | null
  rating: number | null
  isLike: boolean
  createdAt: Date
}

export interface TasteProfileResponse {
  likes: TasteProfileItem[]
  dislikes: TasteProfileItem[]
  totalLikes: number
  totalDislikes: number
}

export interface TasteProfileAddBody {
  movieId?: string
  seriesId?: string
  isLike: boolean
}

// =============================================================================
// Custom Interest Types
// =============================================================================

export interface CustomInterest {
  id: string
  userId: string
  description: string
  weight: number
  createdAt: Date
}

export interface CustomInterestAddBody {
  description: string
  weight?: number
}

export interface CustomInterestUpdateBody {
  description?: string
  weight?: number
}
