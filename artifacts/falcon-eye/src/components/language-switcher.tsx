import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/lib/i18n';
import type { Language } from '@/lib/locale';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation('common');
  return <label className="fe-language-switch">
    <Languages aria-hidden="true" size={16} />
    <span className="sr-only">{t('language')}</span>
    <select aria-label={t('language')} value={i18n.resolvedLanguage === 'ar' ? 'ar' : 'en'}
      onChange={(event) => void changeLanguage(event.target.value as Language)}>
      <option value="en" lang="en">English</option>
      <option value="ar" lang="ar">العربية</option>
    </select>
  </label>;
}
