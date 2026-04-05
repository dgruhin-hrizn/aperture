import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en/translation.json'
import es from './locales/es/translation.json'
import de from './locales/de/translation.json'
import fr from './locales/fr/translation.json'
import it from './locales/it/translation.json'
import pt from './locales/pt/translation.json'
import nl from './locales/nl/translation.json'
import ru from './locales/ru/translation.json'
import ja from './locales/ja/translation.json'
import zh from './locales/zh/translation.json'
import ko from './locales/ko/translation.json'
import hi from './locales/hi/translation.json'
import ar from './locales/ar/translation.json'
import he from './locales/he/translation.json'
import { isRtlLocale } from './localeDirection'

const i18nInit = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    react: {
      useSuspense: false,
    },
    resources: {
      en: { translation: en },
      es: { translation: es },
      de: { translation: de },
      fr: { translation: fr },
      it: { translation: it },
      pt: { translation: pt },
      nl: { translation: nl },
      ru: { translation: ru },
      ja: { translation: ja },
      zh: { translation: zh },
      ko: { translation: ko },
      hi: { translation: hi },
      ar: { translation: ar },
      he: { translation: he },
    },
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
