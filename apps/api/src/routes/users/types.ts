export interface UserRow {
  id: string
  username: string
  display_name: string | null
  provider: 'emby' | 'jellyfin'
  provider_user_id: string
  is_admin: boolean
  is_enabled: boolean
  max_parental_rating: number | null
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
}

