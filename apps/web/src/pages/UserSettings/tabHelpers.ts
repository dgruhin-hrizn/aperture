export const USER_SETTINGS_TAB_KEYS = ['profile', 'watcher', 'algorithm', 'preferences'] as const

export function userSettingsTabIndexFromParam(tab: string | null): number {
  if (!tab) return 0
  const idx = USER_SETTINGS_TAB_KEYS.indexOf(tab as (typeof USER_SETTINGS_TAB_KEYS)[number])
  return idx >= 0 ? idx : 0
}

export function userSettingsTabParamFromIndex(index: number): string {
  return USER_SETTINGS_TAB_KEYS[index] ?? 'profile'
}
