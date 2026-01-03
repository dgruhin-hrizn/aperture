export interface LibraryConfig {
  id: string
  providerLibraryId: string
  name: string
  collectionType: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface MediaTypeConfig {
  maxCandidates: number
  selectedCount: number
  recentWatchLimit: number
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
}

export interface RecommendationConfig {
  movie: MediaTypeConfig
  series: MediaTypeConfig
  updatedAt: string
}

export interface PurgeStats {
  movies: number
  series: number
  episodes: number
  embeddings: number
  watchHistory: number
  recommendations: number
  userPreferences: number
}

export interface UserSettings {
  userId: string
  libraryName: string | null
  createdAt: string
  updatedAt: string
}

export interface EmbeddingModelInfo {
  id: string
  name: string
  description: string
  dimensions: number
  costPer1M: string
}

export interface EmbeddingModelConfig {
  currentModel: string
  availableModels: EmbeddingModelInfo[]
  movieCount: number
  embeddingsByModel: Record<string, number>
}

export const MAX_UNLIMITED = 999999999

