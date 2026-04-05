/**
 * Supported application locales (UI + AI output).
 * BCP-47 language tags; keep in sync with apps/web i18n resources.
 */

export const DEFAULT_LOCALE = 'en' as const

export type AppLocaleCode = (typeof APP_LOCALE_OPTIONS)[number]['code']

/** Curated list for settings dropdowns and validation (includes Hindi, Arabic, and Hebrew in addition to the original nine). */
export const APP_LOCALE_OPTIONS = [
  { code: 'en' as const, label: 'English' },
  { code: 'es' as const, label: 'Español' },
  { code: 'de' as const, label: 'Deutsch' },
  { code: 'fr' as const, label: 'Français' },
  { code: 'it' as const, label: 'Italiano' },
  { code: 'pt' as const, label: 'Português' },
  { code: 'ja' as const, label: '日本語' },
  { code: 'zh' as const, label: '中文' },
  { code: 'ko' as const, label: '한국어' },
  { code: 'hi' as const, label: 'हिन्दी' },
  { code: 'ar' as const, label: 'العربية' },
  { code: 'he' as const, label: 'עברית' },
] as const

const VALID_CODES = new Set(APP_LOCALE_OPTIONS.map((o) => o.code))

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
