import type { TFunction } from 'i18next'

/** Relative labels for last-played style dates (watch history UI). */
export function formatWatchHistoryRelativeDate(dateStr: string | null, t: TFunction): string {
  if (!dateStr) return t('watchHistoryPage.dateNever')
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return t('watchHistoryPage.dateToday')
  if (diffDays === 1) return t('watchHistoryPage.dateYesterday')
  if (diffDays < 7) return t('watchHistoryPage.daysAgo', { count: diffDays })
  if (diffDays < 30) return t('watchHistoryPage.weeksAgo', { count: Math.floor(diffDays / 7) })
  if (diffDays < 365) return t('watchHistoryPage.monthsAgo', { count: Math.floor(diffDays / 30) })
  return date.toLocaleDateString()
}
