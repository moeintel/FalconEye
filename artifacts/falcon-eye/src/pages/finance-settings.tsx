import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRightLeft, Check, CircleAlert, Cloud, Database, FileUp, HardDrive, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanceShell } from '@/components/finance-shell';
import { financeStore, useFinance } from '@/lib/finance-store';
import { SUPPORTED_CURRENCIES } from '@/lib/finance-model';
import { useTranslation } from 'react-i18next';
import { localizedError } from '@/lib/i18n';
import { formatDate, formatNumber } from '@/lib/locale';
import { LanguageSwitcher } from '@/components/language-switcher';

const CURRENCIES = SUPPORTED_CURRENCIES;
function saveJson() {
  const data = JSON.stringify(financeStore.getSnapshot(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = href; anchor.download = 'falcon-eye-backup.json'; anchor.click();
  URL.revokeObjectURL(href);
}

export default function FinanceSettings({ accountPanel }: { accountPanel?: ReactNode }) {
  const { t } = useTranslation('settings');
  const { t: common } = useTranslation('common');
  const doc = useFinance();
  const fileRef = useRef<HTMLInputElement>(null);
  const [base, setBase] = useState(doc.baseCurrency);
  const [rateCurrency, setRateCurrency] = useState(CURRENCIES.find((code) => code !== doc.baseCurrency) || 'USD');
  const [rate, setRate] = useState('');
  const [rateDate, setRateDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState<{ key: string; values?: Record<string, string | number> } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setBase(doc.baseCurrency); }, [doc.baseCurrency]);
  function clearFeedback() { setMessage(null); setError(''); }
  function fail(reason: unknown) { setError(reason instanceof Error ? reason.message : 'That change could not be saved.'); setMessage(null); }
  function changeBase() {
    clearFeedback();
    try {
      const wasSample = financeStore.getSnapshot().isSample;
      financeStore.setBaseCurrency(base);
      if (wasSample) financeStore.replace({ ...financeStore.getSnapshot(), isSample: true });
      setMessage({ key: 'baseSaved', values: { currency: base } });
    }
    catch (reason) { fail(reason); }
  }
  function saveRate(event: FormEvent) {
    event.preventDefault(); clearFeedback();
    try {
      const wasSample = financeStore.getSnapshot().isSample;
      financeStore.setRate(rateCurrency, Number(rate), rateDate);
      if (wasSample) financeStore.replace({ ...financeStore.getSnapshot(), isSample: true });
      setRate(''); setMessage({ key: 'rateSaved', values: { currency: rateCurrency } });
    } catch (reason) { fail(reason); }
  }
  function startEmpty() {
    if (!window.confirm(t('clearConfirmation'))) return;
    clearFeedback();
    try { financeStore.startEmpty(); setMessage({ key: 'cleared' }); }
    catch (reason) { fail(reason); }
  }
  function loadSample() {
    if (doc.records.length && !window.confirm(t('sampleConfirmation'))) return;
    clearFeedback();
    try { financeStore.loadSample(); setMessage({ key: 'sampleLoaded' }); }
    catch (reason) { fail(reason); }
  }
  function importLegacy() {
    clearFeedback();
    try {
      const count = financeStore.importLegacy();
      setMessage({ key: count ? 'legacyImported' : 'noLegacy', values: { count } });
    } catch (reason) { fail(reason); }
  }
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm(t('restoreConfirmation'))) return;
    clearFeedback();
    try {
      const data: unknown = JSON.parse(await file.text());
      financeStore.replace(data as Parameters<typeof financeStore.replace>[0]);
      setBase(financeStore.getSnapshot().baseCurrency);
      setMessage({ key: 'restored' });
    } catch (reason) { fail(reason); }
  }
  const storageError = financeStore.getStorageError();
  return <FinanceShell>
    <div className="fe-breadcrumb">{t('breadcrumb')} <span>/</span> {common('navigation.settings')}</div>
    <div className="fe-assets-title-row"><div><div className="fe-eyebrow">{t('eyebrow')}</div><h1>{common('navigation.settings')}</h1><p>{t('description')}</p></div></div>
    {(message || error || storageError) && <div className={`fe-data-alert ${error || storageError ? 'is-error' : 'is-success'}`} role={error || storageError ? 'alert' : 'status'}>{error || storageError ? <CircleAlert /> : <Check />}<div><b>{t(error || storageError ? 'dataNote' : 'allSet')}</b><span>{error || storageError ? localizedError(error || storageError) : message ? t(message.key, message.values ?? {}) : ''}</span></div>{!error && message && !storageError && <button onClick={clearFeedback}>{t('dismiss')}</button>}</div>}
    <section className="fe-settings-section">
      <div className="fe-settings-card"><h2>{common('language')}</h2><p>{common('languageHelp')}</p><LanguageSwitcher /></div>
    </section>
    <section className="fe-settings-section">
      <div className="fe-settings-section-head"><span className="fe-settings-icon"><ArrowRightLeft /></span><div><h2>{t('currency')}</h2><p>{t('currencyHelp')}</p></div></div>
      <div className="fe-settings-card">
        <div className="fe-settings-card-title"><div><b>{t('base')}</b><span>{t('baseHelp')}</span></div></div>
        <div className="fe-settings-inline-form">
          <select className="fe-select fe-settings-select" aria-label={t('base')} value={base} onChange={(e) => setBase(e.target.value)}>{Array.from(new Set([...CURRENCIES, doc.baseCurrency])).sort().map((code) => <option key={code}>{code}</option>)}</select>
          <Button onClick={changeBase} disabled={base === doc.baseCurrency}>{t('saveBase')}</Button>
        </div>
        {base !== doc.baseCurrency && !doc.rates[base] && doc.records.length > 0 && <p className="fe-field-note">{t('switchHelp', { currency: base, base: doc.baseCurrency })}</p>}
      </div>
      <div className="fe-settings-card">
        <div className="fe-settings-card-title"><div><b>{t('rates')}</b><span>{t('ratesHelp')}</span></div><span className="fe-settings-tag">{t('yourEntries')}</span></div>
        <form onSubmit={saveRate} className="fe-rate-form">
          <label className="fe-field"><span>{t('currency')}</span><select className="fe-select" value={rateCurrency} onChange={(e) => setRateCurrency(e.target.value)}>{Array.from(new Set([...CURRENCIES, ...Object.keys(doc.rates)])).filter((code) => code !== doc.baseCurrency).sort().map((code) => <option key={code}>{code}</option>)}</select></label>
          <label className="fe-field"><span>{t('rateEquals', { currency: rateCurrency, base: doc.baseCurrency })}</span><input className="fe-input" inputMode="decimal" type="number" min="0.00000001" step="any" required value={rate} onChange={(e) => setRate(e.target.value)} placeholder={t('ratePlaceholder')} /></label>
          <label className="fe-field"><span>{t('rateDate')}</span><input className="fe-input" type="date" required value={rateDate} onChange={(e) => setRateDate(e.target.value)} /></label>
          <Button type="submit"><Check />{t('saveRate')}</Button>
        </form>
        {Object.entries(doc.rates).length ? <div className="fe-rate-table"><div><span>{t('foreignCurrency')}</span><span>{t('yourRate')}</span><span>{t('asOf')}</span></div>{Object.entries(doc.rates).sort(([a], [b]) => a.localeCompare(b)).map(([currency, item]) => <div key={currency}><b><bdi>{currency}</bdi></b><span><bdi>{formatNumber(item.rate, { maximumFractionDigits: 8 })} {doc.baseCurrency} / 1 {currency}</bdi></span><span>{formatDate(item.date)}</span></div>)}</div> : <p className="fe-field-note">{t('noRates')}</p>}
      </div>
    </section>

    <section className="fe-settings-section">
      <div className="fe-settings-section-head"><span className="fe-settings-icon"><ShieldCheck /></span><div><h2>{t('dataYours')}</h2><p>{t('localHelp')}</p></div></div>
      <div className="fe-settings-card fe-storage-status"><span className="fe-storage-status-icon"><HardDrive /></span><div><b>{t('savedLocally')}</b><span>{t('recordCounts', { records: doc.records.length, activities: doc.activities.length })}</span></div><span className="fe-settings-tag"><i />{t('localStorage')}</span></div>
      {accountPanel}
      <div className="fe-settings-card fe-data-actions">
        <div className="fe-settings-card-title"><div><b>{t('backup')}</b><span>{t('backupHelp')}</span></div></div>
        <div className="fe-data-action-buttons"><Button variant="outline" onClick={saveJson}><ArrowDownToLine />{t('downloadBackup')}</Button><Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp />{t('restoreBackup')}</Button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={readFile} /></div>
      </div>
      <div className="fe-settings-card fe-data-actions">
        <div className="fe-settings-card-title"><div><b>{t('olderData')}</b><span>{t('olderHelp')}</span></div></div>
        <div className="fe-data-action-buttons"><Button variant="outline" onClick={importLegacy} disabled={doc.legacyImported || doc.records.length > 0}><Database />{t(doc.legacyImported ? 'alreadyImported' : doc.records.length ? 'emptyOnly' : 'importOlder')}</Button><span className="fe-settings-help">{t('originalPreserved')}</span></div>
      </div>
    </section>

    <section className="fe-settings-section fe-settings-prototype">
      <div className="fe-settings-section-head"><span className="fe-settings-icon"><RotateCcw /></span><div><h2>{t('trySample')}</h2><p>{t('sampleWarning')}</p></div></div>
      <div className="fe-settings-card fe-data-actions">
        <div className="fe-settings-card-title"><div><b>{t('sampleTitle')}</b><span>{t('sampleHelp')}</span></div></div>
        <div className="fe-data-action-buttons"><Button variant="outline" onClick={loadSample}><Cloud />{t('loadSample')}</Button></div>
      </div>
      <div className="fe-settings-card fe-data-actions fe-danger-zone">
        <div className="fe-settings-card-title"><div><b>{t('clearTitle')}</b><span>{t('clearHelp')}</span></div></div>
        <div className="fe-data-action-buttons"><Button variant="outline" onClick={startEmpty}><Trash2 />{t('startEmpty')}</Button></div>
      </div>
    </section>
    <p className="fe-settings-footnote"><HardDrive /> {t('footnote')}</p>
  </FinanceShell>;
}
