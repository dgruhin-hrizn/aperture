import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useUserPreferences, saveUserPreferences } from '@/hooks/userPreferences'
import { applyEffectiveUiLanguage } from '@/i18n/syncUiLanguage'
import { RELEASE_HIGHLIGHTS_VERSION } from '../ReleaseHighlightsModal'
export function useShellState() {
  const { user } = useAuth(),
    { i18n } = useTranslation(),
    shared = useUserPreferences()
  const userId = user?.id,
    isAdmin = user?.isAdmin ?? false,
    releasePreference = isAdmin ? 'dismissedAdminRelease' : 'dismissedUserRelease',
    releaseKey = userId ? `${userId}:${releasePreference}` : null
  const [releaseNotice, setReleaseNotice] = useState<{ key: string; open: boolean } | null>(null),
    [collapsed, setCollapsed] = useState(false),
    [watchingEnabled, setWatchingEnabled] = useState(true),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false)
  const releaseOpen = releaseNotice?.key === releaseKey && releaseNotice?.open === true
  useEffect(() => {
    if (!releaseKey || shared.loading) return
    const prefs = shared.data
    setReleaseNotice({
      key: releaseKey,
      open: Boolean(prefs && prefs[releasePreference] !== RELEASE_HIGHLIGHTS_VERSION),
    })
    if (prefs?.sidebarCollapsed !== undefined) setCollapsed(prefs.sidebarCollapsed)
    if (prefs?.effectiveUiLanguage && prefs.effectiveUiLanguage !== i18n.language)
      void applyEffectiveUiLanguage(prefs.effectiveUiLanguage)
  }, [releaseKey, releasePreference, shared.loading, shared.data, i18n.language])
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/settings/watching', { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (response.ok) {
          const config = await response.json()
          if (!controller.signal.aborted) setWatchingEnabled(config.enabled ?? true)
        }
      })
      .catch(() => {
        /* Optional feature probe defaults to available; page permissions still apply. */
      })
    return () => controller.abort()
  }, [])
  async function dismissRelease() {
    if (!userId) return
    await saveUserPreferences(userId, { [releasePreference]: RELEASE_HIGHLIGHTS_VERSION })
    setReleaseNotice((notice) => (notice?.key === releaseKey ? { ...notice, open: false } : notice))
  }
  async function toggleCollapsed() {
    if (saving || !userId) return
    setSaving(true)
    setError('')
    try {
      await saveUserPreferences(userId, { sidebarCollapsed: !collapsed })
      setCollapsed(!collapsed)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }
  return {
    releaseOpen,
    releaseKey,
    canShowOtherPrompts: releaseNotice?.key === releaseKey && !releaseOpen,
    collapsed,
    watchingEnabled,
    error,
    dismissRelease,
    toggleCollapsed,
  }
}
