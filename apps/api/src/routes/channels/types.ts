export interface ChannelRow {
  id: string
  owner_id: string
  name: string
  description: string | null
  genre_filters: string[]
  text_preferences: string | null
  example_movie_ids: string[]
  is_pinned_row: boolean
  playlist_id: string | null
  is_active: boolean
  last_generated_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface ChannelCreateBody {
  name: string
  description?: string
  genreFilters?: string[]
  textPreferences?: string
  exampleMovieIds?: string[]
  isPinnedRow?: boolean
}

export interface ChannelUpdateBody {
  name?: string
  description?: string
  genreFilters?: string[]
  textPreferences?: string
  exampleMovieIds?: string[]
  isPinnedRow?: boolean
  isActive?: boolean
}


