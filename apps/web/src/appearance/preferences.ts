export type UiTheme = 'classic' | 'studio'
export type ColorMode = 'light' | 'dark' | 'system'

export interface AppearancePreferences {
  theme: UiTheme
  mode: ColorMode
}

// No migration or automatic opt-in: an absent preference preserves the original UI.
export const DEFAULT_APPEARANCE: AppearancePreferences = { theme: 'classic', mode: 'system' }

export function normalizeAppearance(value: unknown): AppearancePreferences {
  const prefs = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    theme: prefs.theme === 'studio' ? 'studio' : 'classic',
    mode: prefs.mode === 'light' || prefs.mode === 'dark' ? prefs.mode : 'system',
  }
}

export function resolveColorMode(
  prefs: AppearancePreferences,
  systemDark: boolean
): 'light' | 'dark' {
  if (prefs.theme === 'classic') return 'dark'
  return prefs.mode === 'system' ? (systemDark ? 'dark' : 'light') : prefs.mode
}
