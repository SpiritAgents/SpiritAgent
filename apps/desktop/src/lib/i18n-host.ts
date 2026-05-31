import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import i18n from 'i18next';

function loadLocaleFile(name: string): Record<string, unknown> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(__dirname, '../locales', `${name}.json`),
    join(__dirname, '../../../src/locales', `${name}.json`),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch {
      // try next path
    }
  }
  return {};
}

const resources = {
  'zh-CN': { translation: loadLocaleFile('zh-CN') },
  en: { translation: loadLocaleFile('en') },
};

const instance = i18n.createInstance();

instance.init({
  resources,
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false,
  },
});

export default instance;
