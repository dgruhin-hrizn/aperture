import type { AppLocaleCode } from '../lib/locales.js'

const headings: Record<AppLocaleCode, readonly [string, string, string]> = {
  en: ['Why Aperture picked this for you:', 'About this movie:', 'About this series:'],
  fr: ['Pourquoi Aperture vous recommande ce titre :', 'À propos de ce film :', 'À propos de cette série :'],
  es: ['Por qué Aperture te recomienda este título:', 'Sobre esta película:', 'Sobre esta serie:'],
  de: ['Warum Aperture dir diesen Titel empfiehlt:', 'Über diesen Film:', 'Über diese Serie:'],
  it: ['Perché Aperture ti consiglia questo titolo:', 'Informazioni sul film:', 'Informazioni sulla serie:'],
  pt: ['Por que o Aperture recomenda este título:', 'Sobre este filme:', 'Sobre esta série:'],
  nl: ['Waarom Aperture je deze titel aanbeveelt:', 'Over deze film:', 'Over deze serie:'],
  ru: ['Почему Aperture рекомендует вам этот тайтл:', 'Об этом фильме:', 'Об этом сериале:'],
  ja: ['Aperture がこの作品をおすすめする理由：', 'この映画について：', 'このシリーズについて：'],
  zh: ['Aperture 为你推荐这部作品的原因：', '关于这部电影：', '关于这部剧集：'],
  ko: ['Aperture가 이 작품을 추천한 이유:', '이 영화에 대해:', '이 시리즈에 대해:'],
  hi: ['Aperture ने आपको यह शीर्षक क्यों सुझाया:', 'इस फ़िल्म के बारे में:', 'इस सीरीज़ के बारे में:'],
  ar: ['لماذا يوصي Aperture بهذا العنوان لك:', 'نبذة عن هذا الفيلم:', 'نبذة عن هذا المسلسل:'],
  he: ['למה Aperture המליץ לך על הכותר הזה:', 'על הסרט הזה:', 'על הסדרה הזאת:'],
}

export function getPlotHeadings(locale: AppLocaleCode = 'en') {
  const [why, movie, series] = headings[locale]
  return { why, movie, series }
}
