import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from '../locales/de.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import zhCN from '../locales/zh-CN.json';
import zhTW from '../locales/zh-TW.json';

export const DEFAULT_LANGUAGE = 'zh-CN';
export const VALID_LANGUAGES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko', 'de', 'fr'] as const;
export type ValidLanguage = (typeof VALID_LANGUAGES)[number];
export const LOCALE_LABEL_KEYS: Record<ValidLanguage, string> = {
  'zh-CN': 'settings.langZhCN',
  en: 'settings.langEn',
  'zh-TW': 'settings.langZhTW',
  ja: 'settings.langJa',
  ko: 'settings.langKo',
  de: 'settings.langDe',
  fr: 'settings.langFr',
};
export const LANGUAGE_STORAGE_KEY = 'spirit-agent-desktop-language' as const;

export function isValidLanguage(v: string): v is ValidLanguage {
  return VALID_LANGUAGES.includes(v as ValidLanguage);
}

export function detectSystemLanguage(): string {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE;
  }
  const lang = navigator.language;
  if (isValidLanguage(lang)) {
    return lang;
  }
  if (lang.startsWith('zh-TW-')) {
    return 'zh-TW';
  }
  if (lang.startsWith('zh')) {
    return 'zh-CN';
  }
  if (lang.startsWith('ja-')) {
    return 'ja';
  }
  if (lang.startsWith('ko-')) {
    return 'ko';
  }
  if (lang.startsWith('de-')) {
    return 'de';
  }
  if (lang.startsWith('fr-')) {
    return 'fr';
  }
  return DEFAULT_LANGUAGE;
}

export function getStoredLanguage(): string {
  if (typeof localStorage === 'undefined') {
    return detectSystemLanguage();
  }
  const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (raw && isValidLanguage(raw)) {
    return raw;
  }
  return detectSystemLanguage();
}

export function setStoredLanguage(lang: string): void {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export async function changeLanguage(lang: string): Promise<void> {
  if (!isValidLanguage(lang)) {
    return;
  }
  setStoredLanguage(lang);
  await i18n.changeLanguage(lang);
  if (typeof window !== 'undefined' && window.spiritDesktop) {
    window.spiritDesktop.syncLanguage?.(lang).catch(() => {
      // ignore IPC errors
    });
  }
}

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    en: { translation: en },
    'zh-TW': { translation: zhTW },
    ja: { translation: ja },
    ko: { translation: ko },
    de: { translation: de },
    fr: { translation: fr },
  },
  lng: getStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
