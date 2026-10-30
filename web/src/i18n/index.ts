import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fi from './locales/fi.json';

export const languages = ['en', 'fi'] as const;
export type Language = (typeof languages)[number];

export const resources = { en: { translation: en }, fi: { translation: fi } } as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: languages,
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'], lookupLocalStorage: 'kuitit.lang' },
  });

i18n.on('languageChanged', lng => {
  document.documentElement.setAttribute('lang', lng);
  document.title = i18n.t('app.title');
});

export default i18n;
