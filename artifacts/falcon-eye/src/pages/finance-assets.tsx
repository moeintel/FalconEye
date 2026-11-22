import { type ReactNode, useMemo, useState } from 'react';
import { ArrowDownUp, ArrowRight, Check, CircleAlert, Filter, MoreHorizontal, Plus, Search, Trash2, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanceEditor } from '@/components/finance-editor';
import { FinanceShell } from '@/components/finance-shell';
import { CATEGORIES, summarizeFinance, type Category, type FinanceRecord } from '@/lib/finance-model';
import { formatMoney, formatDate, getLocale } from '@/lib/locale';
import { useTranslation } from 'react-i18next';
import { localizedError } from '@/lib/i18n';
import { financeStore, useFinance } from '@/lib/finance-store';
import { cn } from '@/lib/utils';
import { FinanceAssetIcon } from '@/components/finance-asset-icon';
import { valuationAge } from '@/lib/finance-review';

export default function FinanceAssets({ debtOnly = false, accountStatus }: { debtOnly?: boolean; accountStatus?: ReactNode }) {
  const { t } = useTranslation('assets');
  const { t: common } = useTranslation('common');
  const doc = useFinance();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>(debtOnly ? 'debt' : 'all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceRecord | undefined>();
  const [error, setError] = useState('');
  const records = useMemo(() => doc.records
    .filter((item) => debtOnly ? item.category === 'debt' : item.category !== 'debt')
    .filter((item) => category === 'all' || item.category === category)
    .filter((item) => `${item.name} ${item.location} ${item.category} ${common(`categories.${item.category}`)}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.name).localeCompare(b.name, getLocale())), [doc.records, debtOnly, category, search, common]);
  const typeList = debtOnly ? CATEGORIES.filter((item) => item.id === 'debt') : CATEGORIES.filter((item) => item.id !== 'debt');
  const title = common(debtOnly ? 'navigation.debts' : 'navigation.assets');
  function edit(item: FinanceRecord) { setEditing(item); setEditorOpen(true); }
  function add() { setEditing(undefined); setEditorOpen(true); }
  function remove(item: FinanceRecord) {
    if (!window.confirm(t('removeConfirmation', { name: item.name }))) return;
    try {
      const wasSample = financeStore.getSnapshot().isSample;
      financeStore.remove(item.id);
      if (wasSample) financeStore.replace({ ...financeStore.getSnapshot(), isSample: true });
      setError('');
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove this item.'); }
  }
  const filteredSummary = summarizeFinance({ ...doc, records });
  const total = debtOnly ? filteredSummary.debts : filteredSummary.assets;
  const byCurrency = new Set(records.map((item) => item.currency)).size;
  return <FinanceShell accountStatus={accountStatus}>
    <div className="fe-breadcrumb">{t('breadcrumb')} <span>/</span> {title}</div>
    <div className="fe-assets-title-row">
      <div><div className="fe-eyebrow">{t('eyebrow')}</div><h1>{title}<span className="fe-title-count">{records.length}</span></h1><p>{t(debtOnly ? 'debtDescription' : 'assetDescription')}</p></div>
      <Button onClick={add}><Plus />{t(debtOnly ? 'addDebt' : 'addAsset')}</Button>
    </div>
    {doc.isSample && <div className="fe-sample-inline"><span className="fe-sample-dot" />{t('sample')}</div>}
    {error && <div className="fe-data-alert" role="alert"><CircleAlert /><div><b>{t('attention')}</b><span>{localizedError(error)}</span></div></div>}
    <section className="fe-assets-summary">
      <div className="fe-assets-summary-icon"><WalletCards /></div>
      <div><span>{t(debtOnly ? 'knownDebt' : 'knownAssets')}</span><b>{formatMoney(total, doc.baseCurrency)}</b><small>{t('knownExplanation')}</small></div>
      <div className="fe-summary-ribbon"><span>{records.filter((item) => item.value === null).length}</span><small>{t('withoutValue')}</small></div>
    </section>
    <section className="fe-list-panel">
      <div className="fe-list-controls">
        <label className="fe-search"><Search /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t(debtOnly ? 'searchDebt' : 'searchAssets')} aria-label={t(debtOnly ? 'searchDebt' : 'searchAssets')} />{search && <button aria-label={t('clearSearch')} onClick={() => setSearch('')}>×</button>}</label>
        <label className="fe-filter-select"><Filter /><select aria-label={t('filter')} value={category} onChange={(e) => setCategory(e.target.value as Category | 'all')}><option value="all">{t('allTypes')}</option>{typeList.map((item) => <option key={item.id} value={item.id}>{common(`categories.${item.id}`)}</option>)}</select></label>
        <span className="fe-list-count">{t('shown', { count: records.length })}</span>
      </div>
      {records.length ? <div className="fe-record-list">
        <div className="fe-record-list-head"><span>{t('item')}</span><span>{t('recordedValue')}</span><span>{t('valueDate')}</span><span className="sr-only">{t('actions')}</span></div>
        {records.map((item, index) => {
          const age = valuationAge(item);
          const when = age ? new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' }).format(-age.days, 'day') : '';
          return <article className="fe-record-row" key={item.id}>
            <span className={cn('fe-record-symbol', `tone-${index % 5}`)}><FinanceAssetIcon record={item} /></span>
            <div className="fe-record-main"><button className="fe-record-name" onClick={() => edit(item)}><bdi>{item.name}</bdi></button><span>{common(`categories.${item.category}`)}{item.location && <> · <bdi>{item.location}</bdi></>}{item.access === 'restricted' && <i className="fe-locked-chip">{t('restricted')}</i>}{item.category === 'private' && item.details.agreementType === 'gift' && <i className="fe-locked-chip">{t('gift')}</i>}{item.category === 'ipo' && item.details.status === 'applied' && <i className="fe-locked-chip">{t('application')}</i>}</span></div>
            <div className="fe-record-value">{item.value === null ? <span className="fe-value-unknown">{t('notEntered')}</span> : formatMoney(item.value, item.currency)}<small><bdi>{item.currency}</bdi>{item.value !== null && item.currency !== doc.baseCurrency ? t('localValue') : ''}</small></div>
            <div className="fe-record-date">{item.valuationDate === '1970-01-01' ? t('unknownImported') : formatDate(item.valuationDate, { day: 'numeric', month: 'short', year: 'numeric' })}<small>{t(`valuation.${item.valuationSource}`)}</small>
              <span className={cn('fe-value-age', (age?.stale || age && age.days < 0) && 'needs-review')}>{item.value === null ? t('noDatedValue') : !age ? t('unknownValueAge') : age.days < 0 ? t('futureValueDate') : t('valueAge', { when })}</span>
              {age?.stale && <small>{t('oldValueHelp')}</small>}
              <button className="fe-review-value" onClick={() => edit(item)} aria-label={t('reviewValueFor', { name: item.name })}>{t('reviewValue')} <ArrowRight size={13} /></button>
            </div>
            <details className="fe-record-menu"><summary aria-label={t('actionsFor', { name: item.name })}><MoreHorizontal /></summary><div><button onClick={() => edit(item)}><Check /> {t('edit')}</button><button className="danger" onClick={() => remove(item)}><Trash2 /> {t('remove')}</button></div></details>
          </article>;
        })}
      </div> : <div className="fe-list-empty"><span className="fe-empty-icon"><WalletCards /></span><h2>{t(search || category !== 'all' ? 'noMatching' : debtOnly ? 'noDebt' : 'noAssets')}</h2><p>{t(search || category !== 'all' ? 'trySearch' : debtOnly ? 'emptyDebtHelp' : 'emptyAssetHelp')}</p>{search || category !== 'all' ? <Button variant="outline" onClick={() => { setSearch(''); setCategory(debtOnly ? 'debt' : 'all'); }}>{t('clearFilters')} <ArrowRight /></Button> : <Button onClick={add}><Plus />{t(debtOnly ? 'addDebt' : 'addFirstAsset')}</Button>}</div>}
      {records.length > 0 && <div className="fe-list-footnote"><span><CircleAlert />{t('estimates')}</span><button onClick={add}><Plus />{t('addAnother')}</button></div>}
    </section>
    <div className="fe-page-disclaimer">{t('unsure')} <button onClick={() => window.dispatchEvent(new CustomEvent('falconeye:open-assistant'))}>{t('askExplanation')} <ArrowRight /></button></div>
    <FinanceEditor open={editorOpen} onOpenChange={setEditorOpen} record={editing} initialCategory={debtOnly ? 'debt' : undefined} />
  </FinanceShell>;
}
