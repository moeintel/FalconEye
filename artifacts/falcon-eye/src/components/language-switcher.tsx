import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/lib/i18n';
import type { Language } from '@/lib/locale';

export function LanguageSwitcher({ expanded = false }: { expanded?: boolean }) {
  const { t, i18n } = useTranslation('common');
  if (expanded) return <div className="fe-home-language no-print">
    <span><Languages aria-hidden="true" size={20} />{t('language')}</span>
    <div className="fe-language-options" role="group" aria-label={t('language')}>
      <button type="button" lang="en" dir="ltr" aria-pressed={i18n.resolvedLanguage === 'en'}
        onClick={() => void changeLanguage('en')}>English</button>
      <button type="button" lang="ar" dir="rtl" aria-pressed={i18n.resolvedLanguage === 'ar'}
        onClick={() => void changeLanguage('ar')}>العربية الفصحى</button>
      <button type="button" lang="ar" dir="rtl" aria-pressed={i18n.resolvedLanguage === 'ar-simple'}
        onClick={() => void changeLanguage('ar-simple')}>عربي مبسّط</button>
    </div>
  </div>;
  return <label className="fe-language-switch">
    <Languages aria-hidden="true" size={16} />
    <span className="sr-only">{t('language')}</span>
    <select aria-label={t('language')} value={i18n.resolvedLanguage ?? 'en'}
      onChange={(event) => void changeLanguage(event.target.value as Language)}>
      <option value="en" lang="en">English</option>
      <option value="ar" lang="ar">العربية الفصحى</option>
      <option value="ar-simple" lang="ar">عربي مبسّط</option>
    </select>
  </label>;
}
