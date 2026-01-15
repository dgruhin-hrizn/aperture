/**
 * Type definitions for the AI Assistant module
 */

import type { EmbeddingModel } from 'ai'

// Database query result types
export interface MovieResult {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  community_rating: number | null
  poster_url: string | null
  provider_item_id?: string | null
  runtime?: number | null
  director?: string | null
  cast?: string[] | null
}

export interface SeriesResult {
  id: string
  title: string
  year: number | null
  genres: string[]
  network: string | null
  overview: string | null
  community_rating: number | null
  poster_url: string | null
  provider_item_id?: string | null
  status?: string | null
  end_year?: number | null
}

export interface TasteProfile {
  taste_synopsis: string | null
  series_taste_synopsis: string | null
}

export interface RecentWatch {
  title: string
  year: number | null
  media_type: string
}

export interface RecommendationResult {
  id: string
  title: string
  year: number | null
  rank: number
  genres: string[]
  overview: string | null
}

// Media server types
export interface MediaServerInfo {
  baseUrl: string
  type: 'emby' | 'jellyfin'
  serverId: string
}

// Conversation types
export interface ConversationRow {
  id: string
  title: string
  created_at: Date
  updated_at: Date
}

export interface MessageRow {
  id: string
  role: string
  content: string
  tool_invocations: unknown[] | null
  created_at: Date
}

// Tool context - passed to all tools
export interface ToolContext {
  userId: string
  isAdmin: boolean
  embeddingModel: EmbeddingModel<string>
  embeddingModelId: string  // Model ID string for database queries
  mediaServer: MediaServerInfo | null
}
