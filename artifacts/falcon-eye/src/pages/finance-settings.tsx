import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRightLeft, Check, CircleAlert, Cloud, Database, FileUp, HardDrive, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanceShell } from '@/components/finance-shell';
import { financeStore, useFinance } from '@/lib/finance-store';
import { SUPPORTED_CURRENCIES } from '@/lib/finance-model';

const CURRENCIES = SUPPORTED_CURRENCIES;
function saveJson() {
  const data = JSON.stringify(financeStore.getSnapshot(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = href; anchor.download = 'falcon-eye-backup.json'; anchor.click();
  URL.revokeObjectURL(href);
}

export default function FinanceSettings({ accountPanel }: { accountPanel?: ReactNode }) {
  const doc = useFinance();
  const fileRef = useRef<HTMLInputElement>(null);
  const [base, setBase] = useState(doc.baseCurrency);
  const [rateCurrency, setRateCurrency] = useState(CURRENCIES.find((code) => code !== doc.baseCurrency) || 'USD');
  const [rate, setRate] = useState('');
  const [rateDate, setRateDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setBase(doc.baseCurrency); }, [doc.baseCurrency]);
  function clearFeedback() { setMessage(''); setError(''); }
  function fail(reason: unknown) { setError(reason instanceof Error ? reason.message : 'That change could not be saved.'); setMessage(''); }
  function changeBase() {
    clearFeedback();
    try {
      const wasSample = financeStore.getSnapshot().isSample;
      financeStore.setBaseCurrency(base);
      if (wasSample) financeStore.replace({ ...financeStore.getSnapshot(), isSample: true });
      setMessage(`Base currency set to ${base}.`);
    }
    catch (reason) { fail(reason); }
  }
  function saveRate(event: FormEvent) {
    event.preventDefault(); clearFeedback();
    try {
      const wasSample = financeStore.getSnapshot().isSample;
      financeStore.setRate(rateCurrency, Number(rate), rateDate);
      if (wasSample) financeStore.replace({ ...financeStore.getSnapshot(), isSample: true });
      setRate(''); setMessage(`Your ${rateCurrency} rate was saved.`);
    } catch (reason) { fail(reason); }
  }
  function startEmpty() {
    if (!window.confirm('Clear the current financial picture from this browser? Download a backup first if you want one. This cannot be undone.')) return;
    clearFeedback();
    try { financeStore.startEmpty(); setMessage('Your picture is now empty. Your older portfolio data, if any, is preserved.'); }
    catch (reason) { fail(reason); }
  }
  function loadSample() {
    if (doc.records.length && !window.confirm('Replace your current financial picture with the clearly marked sample? Export a backup first if you want to keep these records.')) return;
    clearFeedback();
    try { financeStore.loadSample(); setMessage('Illustrative sample data loaded.'); }
    catch (reason) { fail(reason); }
  }
  function importLegacy() {
    clearFeedback();
    try {
      const count = financeStore.importLegacy();
      setMessage(count ? `${count} older record${count === 1 ? '' : 's'} imported. Your original data remains untouched.` : 'No older portfolio was available to import. Your current records were not changed.');
    } catch (reason) { fail(reason); }
  }
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm('Replace the current picture with the data in this file? Export a backup first if you need these records.')) return;
    clearFeedback();
    try {
      const data: unknown = JSON.parse(await file.text());
      financeStore.replace(data as Parameters<typeof financeStore.replace>[0]);
      setBase(financeStore.getSnapshot().baseCurrency);
      setMessage('Backup restored successfully.');
    } catch (reason) { fail(reason); }
  }
  const storageError = financeStore.getStorageError();
  return <FinanceShell>
    <div className="fe-breadcrumb">MY FINANCES <span>/</span> SETTINGS</div>
    <div className="fe-assets-title-row"><div><div className="fe-eyebrow">MAKE IT WORK FOR YOU</div><h1>Settings</h1><p>Choose a currency, manage your data, and decide what stays in this browser.</p></div></div>
    {(message || error || storageError) && <div className={`fe-data-alert ${error || storageError ? 'is-error' : 'is-success'}`} role={error || storageError ? 'alert' : 'status'}>{error || storageError ? <CircleAlert /> : <Check />}<div><b>{error || storageError ? 'A note about your data' : 'All set'}</b><span>{error || storageError || message}</span></div>{!error && message && !storageError && <button onClick={clearFeedback}>Dismiss</button>}</div>}
    <section className="fe-settings-section">
      <div className="fe-settings-section-head"><span className="fe-settings-icon"><ArrowRightLeft /></span><div><h2>Currency</h2><p>Values in other currencies need a rate you enter. We never refresh or guess them.</p></div></div>
      <div className="fe-settings-card">
        <div className="fe-settings-card-title"><div><b>Base currency</b><span>Your totals and reports are shown in this currency.</span></div></div>
        <div className="fe-settings-inline-form">
          <select className="fe-select fe-settings-select" aria-label="Base currency" value={base} onChange={(e) => setBase(e.target.value)}>{Array.from(new Set([...CURRENCIES, doc.baseCurrency])).sort().map((code) => <option key={code}>{code}</option>)}</select>
          <Button onClick={changeBase} disabled={base === doc.baseCurrency}>Save base currency</Button>
        </div>
        {base !== doc.baseCurrency && !doc.rates[base] && doc.records.length > 0 && <p className="fe-field-note">To switch to {base}, first add a rate below. It must be stated as {doc.baseCurrency} per 1 {base}.</p>}
      </div>
      <div className="fe-settings-card">
        <div className="fe-settings-card-title"><div><b>Manual exchange rates</b><span>Use a statement or your own rate. Rates are shown as base currency per 1 unit of foreign currency.</span></div><span className="fe-settings-tag">YOUR ENTRIES</span></div>
        <form onSubmit={saveRate} className="fe-rate-form">
          <label className="fe-field"><span>Currency</span><select className="fe-select" value={rateCurrency} onChange={(e) => setRateCurrency(e.target.value)}>{Array.from(new Set([...CURRENCIES, ...Object.keys(doc.rates)])).filter((code) => code !== doc.baseCurrency).sort().map((code) => <option key={code}>{code}</option>)}</select></label>
          <label className="fe-field"><span>1 {rateCurrency} equals ({doc.baseCurrency})</span><input className="fe-input" inputMode="decimal" type="number" min="0.00000001" step="any" required value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 0.85" /></label>
          <label className="fe-field"><span>Rate date</span><input className="fe-input" type="date" required value={rateDate} onChange={(e) => setRateDate(e.target.value)} /></label>
          <Button type="submit"><Check />Save rate</Button>
        </form>
        {Object.entries(doc.rates).length ? <div className="fe-rate-table"><div><span>FOREIGN CURRENCY</span><span>YOUR RATE</span><span>AS OF</span></div>{Object.entries(doc.rates).sort(([a], [b]) => a.localeCompare(b)).map(([currency, item]) => <div key={currency}><b>{currency}</b><span>{item.rate} {doc.baseCurrency} / 1 {currency}</span><span>{new Date(`${item.date}T00:00:00`).toLocaleDateString()}</span></div>)}</div> : <p className="fe-field-note">No exchange rates entered. Foreign currency values will be left out of your totals until you add a rate.</p>}
      </div>
    </section>

    <section className="fe-settings-section">
      <div className="fe-settings-section-head"><span className="fe-settings-icon"><ShieldCheck /></span><div><h2>Your data stays yours</h2><p>Your financial records are stored in this browser only. No accounts or connections are required.</p></div></div>
      <div className="fe-settings-card fe-storage-status"><span className="fe-storage-status-icon"><HardDrive /></span><div><b>Saved in this browser</b><span>{doc.records.length} records · {doc.activities.length} activity entries</span></div><span className="fe-settings-tag"><i />LOCAL STORAGE</span></div>
      {accountPanel}
      <div className="fe-settings-card fe-data-actions">
        <div className="fe-settings-card-title"><div><b>Back up or restore</b><span>Keep your own copy, or restore from a Falcon Eye JSON backup.</span></div></div>
        <div className="fe-data-action-buttons"><Button variant="outline" onClick={saveJson}><ArrowDownToLine />Download a backup</Button><Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp />Restore a JSON backup</Button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={readFile} /></div>
      </div>
      <div className="fe-settings-card fe-data-actions">
        <div className="fe-settings-card-title"><div><b>Older portfolio data</b><span>Import records from the earlier Falcon Eye portfolio, if available.</span></div></div>
        <div className="fe-data-action-buttons"><Button variant="outline" onClick={importLegacy} disabled={doc.legacyImported || doc.records.length > 0}><Database />{doc.legacyImported ? 'Already imported' : doc.records.length ? 'Only available on an empty picture' : 'Import older records'}</Button><span className="fe-settings-help">The original data is never removed or overwritten.</span></div>
      </div>
    </section>

    <section className="fe-settings-section fe-settings-prototype">
      <div className="fe-settings-section-head"><span className="fe-settings-icon"><RotateCcw /></span><div><h2>Try a sample or start fresh</h2><p>Samples are clearly marked and illustrative. Choose carefully—replacing records cannot be undone.</p></div></div>
      <div className="fe-settings-card fe-data-actions">
        <div className="fe-settings-card-title"><div><b>Illustrative sample data</b><span>Explore a populated view with example records and clearly labeled non-live values.</span></div></div>
        <div className="fe-data-action-buttons"><Button variant="outline" onClick={loadSample}><Cloud />Load sample picture</Button></div>
      </div>
      <div className="fe-settings-card fe-data-actions fe-danger-zone">
        <div className="fe-settings-card-title"><div><b>Clear this picture</b><span>Remove your records and activities from this browser. Download a backup first if needed.</span></div></div>
        <div className="fe-data-action-buttons"><Button variant="outline" onClick={startEmpty}><Trash2 />Start with an empty picture</Button></div>
      </div>
    </section>
    <p className="fe-settings-footnote"><HardDrive /> Changes stay in this browser, not in a cloud account. Clearing your browser storage may remove your data; use the backup option to keep a copy.</p>
  </FinanceShell>;
}
