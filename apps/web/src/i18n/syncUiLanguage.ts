import { loadUserPreferences } from '../hooks/userPreferences'
import { isRtlLocale } from './localeDirection'
import i18n from './config'

function applyDocumentLangAndDir(lng: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lng
  document.documentElement.dir = isRtlLocale(lng) ? 'rtl' : 'ltr'
}

/** Applies a resolved locale to i18next and the document `<html lang>` / `dir`. */
export async function applyEffectiveUiLanguage(lng: string): Promise<void> {
  await i18n.changeLanguage(lng)
  applyDocumentLangAndDir(lng)
}

/**
 * Loads the signed-in user's effective UI language from the API and applies it.
 * Call after login and whenever server-side language preferences may have changed.
 */
export async function syncUiLanguageFromServer(userId?: string): Promise<string | null> {
  try {
    const prefs = userId ? await loadUserPreferences(userId, new AbortController().signal) : await fetch('/api/auth/me/preferences', { credentials: 'include', signal: AbortSignal.timeout(15000) }).then(async response => response.ok ? response.json() : {})
    const lng = prefs.effectiveUiLanguage
    if (lng && typeof lng === 'string') {
      await applyEffectiveUiLanguage(lng)
      return lng
    }
  } catch {
    // ignore
  }
  return null
}
