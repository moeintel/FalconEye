import { formatMoney as modelFormatMoney } from './finance-model.ts';

export type Language = 'en' | 'ar';
export const LANGUAGE_STORAGE_KEY = 'falcon-eye:language:v1';
let activeLanguage: Language = 'en';

export function supportedLanguage(value: string | null | undefined): Language | null {
  const base = value?.toLowerCase().split('-')[0];
  return base === 'en' || base === 'ar' ? base : null;
}

export function resolveLanguage(query: string | null, stored: string | null, browser: string): Language {
  return supportedLanguage(query) ?? supportedLanguage(stored) ?? supportedLanguage(browser) ?? 'en';
}

export function setActiveLanguage(language: Language) { activeLanguage = language; }
export function getLanguage(): Language { return activeLanguage; }
export function getLocale(): string { return activeLanguage === 'ar' ? 'ar-AE-u-nu-latn' : 'en-US'; }
export function direction(language: Language): 'rtl' | 'ltr' { return language === 'ar' ? 'rtl' : 'ltr'; }

export function formatMoney(value: number, currency: string): string {
  return modelFormatMoney(value, currency, getLocale());
}

export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(getLocale(), options).format(value);
}

export function formatDate(value: string | number | Date, options: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(getLocale(), { calendar: 'gregory', ...options }).format(date);
}

export const money = (value: number) => formatMoney(value, 'USD');
export const money0 = (value: number) => formatNumber(value, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const signedMoney = (value: number) => `${value >= 0 ? '+' : '-'}${money(Math.abs(value))}`;
export const pct = (value: number) => `${formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
export const signedPct = (value: number) => `${value >= 0 ? '+' : ''}${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const qty = (value: number) => formatNumber(value, { maximumFractionDigits: 8 });

export function normalizeArabicNumbers(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  }).replace(/٫/g, '.').replace(/٬/g, ',');
}
