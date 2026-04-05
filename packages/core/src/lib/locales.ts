/**
 * Supported application locales (UI + AI output).
 * BCP-47 language tags; keep in sync with apps/web i18n resources.
 */

export const DEFAULT_LOCALE = 'en' as const

export type AppLocaleCode = (typeof APP_LOCALE_OPTIONS)[number]['code']

/** Curated list for settings dropdowns and validation (keep in sync with `apps/web` i18n `supportedLngs`). */
export const APP_LOCALE_OPTIONS = [
  { code: 'en' as const, label: 'English' },
  { code: 'es' as const, label: 'Español' },
  { code: 'de' as const, label: 'Deutsch' },
  { code: 'fr' as const, label: 'Français' },
  { code: 'it' as const, label: 'Italiano' },
  { code: 'pt' as const, label: 'Português' },
  { code: 'nl' as const, label: 'Nederlands' },
  { code: 'ru' as const, label: 'Русский' },
  { code: 'ja' as const, label: '日本語' },
  { code: 'zh' as const, label: '中文' },
  { code: 'ko' as const, label: '한국어' },
  { code: 'hi' as const, label: 'हिन्दी' },
  { code: 'ar' as const, label: 'العربية' },
  { code: 'he' as const, label: 'עברית' },
] as const

/** Locales that use right-to-left UI (document `dir` and MUI `direction`). */
export const RTL_LOCALE_CODES = ['ar', 'he'] as const

const VALID_CODES = new Set(APP_LOCALE_OPTIONS.map((o) => o.code))

/** True if the base language tag is RTL (handles `ar`, `he`, and BCP-47 prefixes like `ar-SA`). */
export function isRtlLocale(code: string | null | undefined): boolean {
  if (!code) return false
  const base = code.split(/[-_]/)[0] ?? code
  return (RTL_LOCALE_CODES as readonly string[]).includes(base)
}

export function isValidAppLocale(code: string | null | undefined): code is AppLocaleCode {
  return !!code && VALID_CODES.has(code as AppLocaleCode)
}

/**
 * Normalize user/admin input to a supported locale or default.
 */
export function normalizeAppLocale(code: string | null | undefined): AppLocaleCode {
  if (isValidAppLocale(code)) return code
  return DEFAULT_LOCALE
}

/**
 * Map UI locale (e.g. `de`, `en`, or `de-DE`) to TMDb's `language` query parameter.
 */
export function appLocaleToTmdbLanguage(code: string | null | undefined): string {
  const raw = (code ?? '').trim()
  const base = raw.split(/[-_]/)[0] ?? ''
  const normalized = normalizeAppLocale(base || raw)
  const map: Record<AppLocaleCode, string> = {
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
    fr: 'fr-FR',
    it: 'it-IT',
    pt: 'pt-BR',
    nl: 'nl-NL',
    ru: 'ru-RU',
    ja: 'ja-JP',
    zh: 'zh-CN',
    ko: 'ko-KR',
    hi: 'hi-IN',
    ar: 'ar-SA',
    he: 'he-IL',
  }
  return map[normalized] ?? 'en-US'
}

/**
 * Human-readable language name for LLM system prompts (English instruction text).
 */
export function getLocaleInstructionName(locale: AppLocaleCode): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) || locale
  } catch {
    return locale
  }
}

/**
 * Instruction fragment to append to AI system prompts for non-English output.
 */
export function buildAiLanguageInstruction(locale: AppLocaleCode): string {
  if (locale === DEFAULT_LOCALE) {
    return 'Write all output in English.'
  }
  const name = getLocaleInstructionName(locale)
  return `Write all output in ${name} (${locale}). Do not use English for the main user-facing text.`
}
