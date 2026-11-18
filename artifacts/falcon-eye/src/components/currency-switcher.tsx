import { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { financeStore, useFinance } from '@/lib/finance-store';
import { SUPPORTED_CURRENCIES } from '@/lib/finance-model';
import { localizedError } from '@/lib/i18n';

export function CurrencySwitcher() {
  const { t } = useTranslation('settings');
  const doc = useFinance();
  const [rateNeeded, setRateNeeded] = useState<string | null>(null);
  const [error, setError] = useState('');
  function changeCurrency(currency: string) {
    setRateNeeded(null);
    setError('');
    if (currency === doc.baseCurrency) return;
    if ((doc.records.length || doc.activities.length) && !doc.rates[currency]) {
      setRateNeeded(currency);
      return;
    }
    try { financeStore.setBaseCurrency(currency); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('saveFailed')); }
  }
  return <div className="fe-currency-switch">
    <label className="fe-currency-control">
      <ArrowLeftRight size={15} aria-hidden="true" />
      <span className="sr-only">{t('base')}</span>
      <select aria-label={t('base')} title={t('baseHelp')} value={doc.baseCurrency} dir="ltr"
        onChange={(event) => changeCurrency(event.target.value)}>
        {Array.from(new Set([...SUPPORTED_CURRENCIES, doc.baseCurrency])).sort().map((code) => <option key={code}>{code}</option>)}
      </select>
    </label>
    {(rateNeeded || error) && <div className="fe-preference-feedback" role="alert">
      <button type="button" className="fe-preference-dismiss" aria-label={t('dismiss')} onClick={() => { setRateNeeded(null); setError(''); }}><X size={16} /></button>
      <p>{rateNeeded ? t('headerRateNeeded', { currency: rateNeeded }) : localizedError(error)}</p>
      <Link href="/settings#currency" onClick={() => { setRateNeeded(null); setError(''); }}>{t('rates')}</Link>
    </div>}
  </div>;
}
