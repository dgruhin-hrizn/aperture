import type { TFunction } from 'i18next'
import type { BrowsePerson } from '../types'

export function personSubtitle(person: BrowsePerson, t: TFunction): string {
  const parts: string[] = []

  if (person.movieCredits > 0) {
    parts.push(t('browse.personSubtitle.movieCredits', { count: person.movieCredits }))
  }
  if (person.seriesCredits > 0) {
    parts.push(t('browse.personSubtitle.seriesCredits', { count: person.seriesCredits }))
  }

  return parts.length > 0
    ? parts.join(' · ')
    : t('browse.personSubtitle.creditsOnly', { count: person.credits })
}
