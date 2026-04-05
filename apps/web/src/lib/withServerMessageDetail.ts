import type { TFunction } from 'i18next'

/** Wraps a raw API or network error string for display. English is typically unchanged; other locales may add a prefix/suffix. */
export function withServerMessageDetail(t: TFunction, message: string): string {
  return t('common.errors.serverMessage', { message })
}
