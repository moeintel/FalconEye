import { type ReactNode, useMemo, useState } from 'react';
import { ArrowDownUp, ArrowRight, Check, CircleAlert, Filter, MoreHorizontal, Plus, Search, Trash2, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanceEditor } from '@/components/finance-editor';
import { FinanceShell } from '@/components/finance-shell';
import { CATEGORIES, formatMoney, summarizeFinance, type Category, type FinanceRecord } from '@/lib/finance-model';
import { financeStore, useFinance } from '@/lib/finance-store';
import { cn } from '@/lib/utils';
import { FinanceAssetIcon } from '@/components/finance-asset-icon';

export default function FinanceAssets({ debtOnly = false, accountStatus }: { debtOnly?: boolean; accountStatus?: ReactNode }) {
  const doc = useFinance();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>(debtOnly ? 'debt' : 'all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceRecord | undefined>();
  const [error, setError] = useState('');
  const records = useMemo(() => doc.records
    .filter((item) => debtOnly ? item.category === 'debt' : item.category !== 'debt')
    .filter((item) => category === 'all' || item.category === category)
    .filter((item) => `${item.name} ${item.location} ${item.category}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.name).localeCompare(b.name)), [doc.records, debtOnly, category, search]);
  const typeList = debtOnly ? CATEGORIES.filter((item) => item.id === 'debt') : CATEGORIES.filter((item) => item.id !== 'debt');
  const title = debtOnly ? 'Debts' : 'Assets';
  function edit(item: FinanceRecord) { setEditing(item); setEditorOpen(true); }
  function add() { setEditing(undefined); setEditorOpen(true); }
  function remove(item: FinanceRecord) {
    if (!window.confirm(`Remove “${item.name}” and its activity history? This cannot be undone.`)) return;
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
    <div className="fe-breadcrumb">MY FINANCES <span>/</span> {title.toUpperCase()}</div>
    <div className="fe-assets-title-row">
      <div><div className="fe-eyebrow">A PLACE FOR THE DETAILS</div><h1>{title}<span className="fe-title-count">{records.length}</span></h1><p>{debtOnly ? 'Keep track of what you currently owe. Use the outstanding balance, not the original amount.' : 'One list for your cash, investments, property, and other things of value.'}</p></div>
      <Button onClick={add}><Plus />Add {debtOnly ? 'a debt' : 'an asset'}</Button>
    </div>
    {doc.isSample && <div className="fe-sample-inline"><span className="fe-sample-dot" />Sample records are illustrative—not live or personal data.</div>}
    {error && <div className="fe-data-alert" role="alert"><CircleAlert /><div><b>Something needs attention</b><span>{error}</span></div></div>}
    <section className="fe-assets-summary">
      <div className="fe-assets-summary-icon"><WalletCards /></div>
      <div><span>{debtOnly ? 'KNOWN OUTSTANDING BALANCES' : 'KNOWN TRACKED VALUE'}</span><b>{formatMoney(total, doc.baseCurrency)}</b><small>Known values with available rates only · gifts excluded · estimates may be incomplete</small></div>
      <div className="fe-summary-ribbon"><span>{records.filter((item) => item.value === null).length}</span><small>without a value</small></div>
    </section>
    <section className="fe-list-panel">
      <div className="fe-list-controls">
        <label className="fe-search"><Search /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} aria-label={`Search ${title.toLowerCase()}`} />{search && <button aria-label="Clear search" onClick={() => setSearch('')}>×</button>}</label>
        <label className="fe-filter-select"><Filter /><select aria-label="Filter by type" value={category} onChange={(e) => setCategory(e.target.value as Category | 'all')}><option value="all">All types</option>{typeList.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <span className="fe-list-count">{records.length} shown</span>
      </div>
      {records.length ? <div className="fe-record-list">
        <div className="fe-record-list-head"><span>ITEM</span><span>RECORDED VALUE</span><span>VALUE AS OF</span><span className="sr-only">Actions</span></div>
        {records.map((item, index) => {
          const categoryInfo = CATEGORIES.find((entry) => entry.id === item.category);
          return <article className="fe-record-row" key={item.id}>
            <span className={cn('fe-record-symbol', `tone-${index % 5}`)}><FinanceAssetIcon record={item} /></span>
            <div className="fe-record-main"><button className="fe-record-name" onClick={() => edit(item)}>{item.name}</button><span>{categoryInfo?.label}{item.location ? ` · ${item.location}` : ''}{item.access === 'restricted' && <i className="fe-locked-chip">Restricted</i>}{item.category === 'private' && item.details.agreementType === 'gift' && <i className="fe-locked-chip">Gift · excluded</i>}{item.category === 'ipo' && item.details.status === 'applied' && <i className="fe-locked-chip">Application · refund deducted in totals</i>}</span></div>
            <div className="fe-record-value">{item.value === null ? <span className="fe-value-unknown">Not entered</span> : formatMoney(item.value, item.currency)}<small>{item.currency}{item.value !== null && item.currency !== doc.baseCurrency ? ' · local value' : ''}</small></div>
            <div className="fe-record-date">{item.valuationDate === '1970-01-01' ? 'Unknown · imported' : new Date(`${item.valuationDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}<small>{item.valuationSource === 'statement' ? 'Statement' : item.valuationSource === 'estimate' ? 'Estimate' : 'Your entry'}</small></div>
            <details className="fe-record-menu"><summary aria-label={`Actions for ${item.name}`}><MoreHorizontal /></summary><div><button onClick={() => edit(item)}><Check /> Edit details</button><button className="danger" onClick={() => remove(item)}><Trash2 /> Remove</button></div></details>
          </article>;
        })}
      </div> : <div className="fe-list-empty"><span className="fe-empty-icon"><WalletCards /></span><h2>{search || category !== 'all' ? 'No matching items' : `No ${title.toLowerCase()} added yet`}</h2><p>{search || category !== 'all' ? 'Try a different search or type.' : debtOnly ? 'Adding a balance here helps you see your net worth clearly.' : 'Start with one account or item. You can fill in more detail later.'}</p>{search || category !== 'all' ? <Button variant="outline" onClick={() => { setSearch(''); setCategory(debtOnly ? 'debt' : 'all'); }}>Clear filters <ArrowRight /></Button> : <Button onClick={add}><Plus />Add {debtOnly ? 'a debt' : 'your first asset'}</Button>}</div>}
      {records.length > 0 && <div className="fe-list-footnote"><span><CircleAlert />Personal estimates—not connected to banks, brokers, or live market prices.</span><button onClick={add}><Plus />Add another</button></div>}
    </section>
    <div className="fe-page-disclaimer">Not sure if something counts? Ask Falc <button onClick={() => window.dispatchEvent(new CustomEvent('falconeye:open-assistant'))}>for a plain-language explanation <ArrowRight /></button></div>
    <FinanceEditor open={editorOpen} onOpenChange={setEditorOpen} record={editing} initialCategory={debtOnly ? 'debt' : undefined} />
  </FinanceShell>;
}
