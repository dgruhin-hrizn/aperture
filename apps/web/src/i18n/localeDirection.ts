/**
 * RTL UI locales — keep in sync with `RTL_LOCALE_CODES` / `isRtlLocale` in
 * `packages/core/src/lib/locales.ts`. Web does not import `@aperture/core` here
 * so the client bundle does not pull server-only modules (e.g. logger).
 */
export const RTL_LOCALE_CODES = ['ar', 'he'] as const

export function isRtlLocale(code: string | null | undefined): boolean {
  if (!code) return false
  const base = code.split(/[-_]/)[0] ?? code
  return (RTL_LOCALE_CODES as readonly string[]).includes(base)
}
