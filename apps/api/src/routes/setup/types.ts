/**
 * Setup Route Types
 * 
 * TypeScript interfaces for setup-related API endpoints.
 */
import type { MediaServerType, SetupStepId, LibraryType } from '@aperture/core'

// Re-export core types for convenience
export type { MediaServerType, SetupStepId, LibraryType }

export interface DiscoveredServer {
  id: string
  name: string
  address: string
  type: 'emby' | 'jellyfin'
}

export interface SetupStatusResponse {
  needsSetup: boolean
  isAdmin: boolean
  canAccessSetup: boolean
  configured: {
    mediaServer: boolean
    openai: boolean
  }
}

export interface MediaServerBody {
  type: MediaServerType
  baseUrl: string
  apiKey: string
}

export interface OpenAIBody {
  apiKey: string
}

export interface TestMediaServerBody {
  type: MediaServerType
  baseUrl: string
  apiKey: string
}

export interface SetupProgressBody {
  currentStep?: SetupStepId | null
  completedStep?: SetupStepId
  reset?: boolean
}

export interface SetLibrariesBody {
  libraries: Array<{ id: string; isEnabled: boolean }>
}

export interface SetupUserRow {
  id: string
  provider_user_id: string
  username: string
  display_name: string | null
  is_admin: boolean
  is_enabled: boolean
  has_password: boolean
  movies_enabled: boolean
  series_enabled: boolean
  created_at: Date
}

export interface SetupUserImportBody {
  users: Array<{
    providerUserId: string
    username: string
    isAdmin?: boolean
  }>
}

export interface SetupUserEnableBody {
  userId: string
  isEnabled: boolean
  moviesEnabled?: boolean
  seriesEnabled?: boolean
}

export interface LibraryImageBody {
  imageData: string
  filename?: string
}

export interface ValidateBody {
  step: SetupStepId
  config: Record<string, unknown>
}
