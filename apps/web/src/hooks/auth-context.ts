import { createContext } from 'react'

export interface User {
  id: string
  username: string
  displayName: string | null
  provider: 'emby' | 'jellyfin'
  providerUserId: string
  isAdmin: boolean
  isEnabled: boolean
  canManageWatchHistory: boolean
  avatarUrl: string | null
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  sessionError: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearSessionError: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
