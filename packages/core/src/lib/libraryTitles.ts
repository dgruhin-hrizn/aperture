import { normalizeAppLocale, type AppLocaleCode } from './locales.js'

const mediaLabels: Record<AppLocaleCode, readonly [movies: string, series: string]> = {
  ar: ['أفلام', 'مسلسل تلفزيوني'],
  de: ['Filme', 'TV-Serien'],
  en: ['Movies', 'TV Series'],
  es: ['Cine', 'Series de TV'],
  fr: ['Films', 'Séries TV'],
  he: ['סרטים', 'סדרת טלוויזיה'],
  hi: ['चलचित्र', 'टीवी श्रृंखला'],
  it: ['Film', 'Serie televisiva'],
  ja: ['映画', '連続テレビ番組'],
  ko: ['영화', 'TV 시리즈'],
  nl: ['Films', 'TV-serie'],
  pt: ['Filmes', 'Série de TV'],
  ru: ['Фильмы', 'Сериал'],
  zh: ['电影', '电视剧'],
}

export function getLibraryTypeLabel(mediaType: 'movies' | 'series', locale?: string): string {
  return mediaLabels[normalizeAppLocale(locale)][mediaType === 'movies' ? 0 : 1]
}

export interface TitleTemplateContext {
  username: string
  type: string
  count?: number
  date?: string
  group?: string
}

export function processLibraryTitle(template: string, context: TitleTemplateContext): string {
  const hasGroupTag = /\{\{group\}\}/i.test(template)
  const values = {
    username: context.username,
    type: context.type,
    count: context.count?.toString() ?? '',
    date: context.date ?? '',
    group: context.group ?? '',
  }
  const prepared = context.group ? template : template
    .replace(/\(\s*\{\{group\}\}\s*\)/gi, '')
    .replace(/\{\{group\}\}\s*[-–—·]\s*|\s*[-–—·]\s*\{\{group\}\}/gi, '')
  const title = prepared
    .replace(/\{\{(username|type|count|date|group)\}\}/gi,
      (_, tag: string) => values[tag.toLowerCase() as keyof typeof values])
    .replace(/\s+\(\s*\)/g, '')
    .replace(/\s+[-–—]\s*$/g, '')
    .trim()
  if (context.group && !hasGroupTag) return `${title} – ${context.group}`
  return title
}
