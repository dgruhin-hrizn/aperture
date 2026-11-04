import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en/translation.json'
import type { BackendModule } from 'i18next'

const localeLoaders = {
  es: () => import('./locales/es/translation.json'),
  de: () => import('./locales/de/translation.json'),
  fr: () => import('./locales/fr/translation.json'),
  it: () => import('./locales/it/translation.json'),
  pt: () => import('./locales/pt/translation.json'),
  nl: () => import('./locales/nl/translation.json'),
  ru: () => import('./locales/ru/translation.json'),
  ja: () => import('./locales/ja/translation.json'),
  zh: () => import('./locales/zh/translation.json'),
  ko: () => import('./locales/ko/translation.json'),
  hi: () => import('./locales/hi/translation.json'),
  ar: () => import('./locales/ar/translation.json'),
  he: () => import('./locales/he/translation.json'),
}
const localeBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, _namespace, callback) {
    const code = language.split('-')[0] as keyof typeof localeLoaders
    const loader = localeLoaders[code]
    if (!loader) {
      callback(null, {})
      return
    }
    void loader()
      .then((module) => callback(null, module.default))
      .catch((error) => callback(error, null))
  },
}

import { isRtlLocale } from './localeDirection'

const i18nInit = i18n
  .use(LanguageDetector)
  .use(localeBackend)
  .use(initReactI18next)
  .init({
    react: {
      useSuspense: false,
    },
    partialBundledLanguages: true,
    resources: { en: { translation: en } },
    fallbackLng: 'en',
    supportedLngs: [
      'en',
      'es',
      'de',
      'fr',
      'it',
      'pt',
      'nl',
      'ru',
      'ja',
      'zh',
      'ko',
      'hi',
      'ar',
      'he',
    ],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

void i18nInit.then(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = i18n.language
    document.documentElement.dir = isRtlLocale(i18n.language) ? 'rtl' : 'ltr'
  }
})

export default i18n
