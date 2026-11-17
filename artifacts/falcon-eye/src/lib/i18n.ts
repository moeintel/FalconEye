import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  direction, LANGUAGE_STORAGE_KEY, resolveLanguage, setActiveLanguage, supportedLanguage, type Language,
} from './locale';

const files = import.meta.glob('../locales/*/*.json', { eager: true, import: 'default' });
const resources: Record<string, Record<string, object>> = { en: {}, ar: {} };
for (const [path, messages] of Object.entries(files)) {
  const [, language, namespace] = path.match(/\/locales\/(en|ar)\/([^/]+)\.json$/) ?? [];
  if (language && namespace) resources[language][namespace] = messages as object;
}

let stored: string | null = null;
try { stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* Language still works for this session. */ }
const language = resolveLanguage(new URLSearchParams(location.search).get('lang'), stored, navigator.language);

function applyLanguage(language: Language) {
  setActiveLanguage(language);
  document.documentElement.lang = language;
  document.documentElement.dir = direction(language);
}
applyLanguage(language);
i18n.on('languageChanged', (next) => {
  const language = supportedLanguage(next) ?? 'en';
  applyLanguage(language);
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Do not block switching when storage is unavailable. */ }
});
i18n.use(initReactI18next).init({
  resources,
  lng: language,
  fallbackLng: 'en',
  supportedLngs: ['en', 'ar'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

export async function changeLanguage(language: Language) {
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.set('lang', language);
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  await i18n.changeLanguage(language);
}

export function localizedError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const current = i18n.resolvedLanguage ?? 'en';
  const english = i18n.getDataByLanguage('en') ?? {};
  function find(value: object, prefix: string): string | null {
    for (const [key, item] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (item === message) return path;
      if (item && typeof item === 'object') {
        const found = find(item, path);
        if (found) return found;
      }
    }
    return null;
  }
  for (const [namespace, messages] of Object.entries(english)) {
    const key = find(messages as object, '');
    if (key) return String(i18n.t(`${namespace}:${key}`));
  }
  return current === 'en' && message ? message : String(i18n.t('common:errors.checkDetails'));
}

export default i18n;
