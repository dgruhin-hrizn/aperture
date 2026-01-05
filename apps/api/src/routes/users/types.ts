export interface UserRow {
  id: string
  username: string
  display_name: string | null
  provider: 'emby' | 'jellyfin'
  provider_user_id: string
  is_admin: boolean
  is_enabled: boolean
  movies_enabled: boolean
  series_enabled: boolean
  max_parental_rating: number | null
  can_manage_watch_history: boolean
  created_at: Date
  updated_at: Date
}

export interface UserListResponse {
  users: UserRow[]
  total: number
}

export interface UserUpdateBody {
  displayName?: string
  isEnabled?: boolean
  moviesEnabled?: boolean
  seriesEnabled?: boolean
  canManageWatchHistory?: boolean
}

