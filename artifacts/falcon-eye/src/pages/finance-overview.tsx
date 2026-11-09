import { type ReactNode, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, ArrowUpRight, CircleAlert, Plus, Sparkles, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanceEditor } from '@/components/finance-editor';
import { FinanceShell } from '@/components/finance-shell';
import { CATEGORIES, formatMoney, summarizeFinance } from '@/lib/finance-model';
import { financeStore, useFinance } from '@/lib/finance-store';
import { cn } from '@/lib/utils';

const compactMoney = (value: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: Math.abs(value) >= 100_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);

export default function FinanceOverview({ accountStatus }: { accountStatus?: ReactNode }) {
  const doc = useFinance();
  const summary = useMemo(() => summarizeFinance(doc), [doc]);
  const [editorOpen, setEditorOpen] = useState(false);
  const latest = [...doc.activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const maxCategory = Math.max(1, ...summary.byCategory.filter((item) => item.value > 0).map((item) => item.value));
  const categoryCount = CATEGORIES.filter(({ id }) => summary.byCategory.some((item) => item.category === id)).length;

  const unresolved = summary.missingValues + summary.missingRates;
  const warning = summary.staleValues > 0 || unresolved > 0;
  const content = doc.records.length === 0 ? (
    <section className="fe-welcome-card">
      <div className="fe-welcome-copy">
        <div className="fe-eyebrow"><span className="fe-eyebrow-line" />YOUR EVERYDAY FINANCES</div>
        <h1>A clearer picture<br /><span>starts with one thing.</span></h1>
        <p>Bring your savings, investments, property, and debts together. No accounts to connect, no price guessing — just the information you choose to keep here.</p>
        <div className="fe-welcome-actions"><Button onClick={() => setEditorOpen(true)}><Plus />Add your first item</Button><button className="fe-text-action" onClick={() => window.dispatchEvent(new CustomEvent('falconeye:open-assistant'))}>Not sure where to start? Ask Falc <ArrowRight /></button></div>
        <div className="fe-privacy-note"><span className="fe-lock-dot" />Your list is private to this browser.</div>
      </div>
      <div className="fe-orbit-illustration" aria-hidden="true"><div className="fe-orbit fe-orbit-one" /><div className="fe-orbit fe-orbit-two" /><div className="fe-orbit-center"><WalletCards /><span>your money</span></div><span className="fe-orbit-tag tag-cash">Cash</span><span className="fe-orbit-tag tag-home">Home</span><span className="fe-orbit-tag tag-invest">Investments</span><span className="fe-orbit-tag tag-debt">Debts</span></div>
    </section>
  ) : (
    <>
      <section className="fe-welcome-card fe-dashboard-hero">
        <div className="fe-welcome-copy">
          <div className="fe-eyebrow"><span className="fe-eyebrow-line" />{doc.isSample ? 'SAMPLE PICTURE · ILLUSTRATIVE VALUES' : 'YOUR MONEY, AT A GLANCE'}</div>
          <h1>See where<br /><span>you stand.</span></h1>
          <p>{doc.isSample ? 'This clearly marked sample helps you explore the view. Sample amounts are illustrative, not live.' : 'A straightforward snapshot of what you own, what you owe, and what is easy to access.'}</p>
          <div className="fe-welcome-actions"><Button onClick={() => setEditorOpen(true)}><Plus />Add an item</Button><button className="fe-text-action" onClick={() => window.dispatchEvent(new CustomEvent('falconeye:open-assistant'))}><Sparkles />Ask Falc <ArrowRight /></button></div>
        </div>
        <div className="fe-worth-card">
          <span className="fe-worth-label">ESTIMATED NET WORTH</span>
          <strong>{compactMoney(summary.netWorth, doc.baseCurrency)}</strong>
          <span className="fe-worth-caption">Assets minus debts · {doc.baseCurrency}</span>
          <div className="fe-worth-breakdown">
            <div><span><i className="fe-asset-dot" />Assets</span><b>{compactMoney(summary.assets, doc.baseCurrency)}</b></div>
            <div><span><i className="fe-debt-dot" />Debts</span><b>{compactMoney(summary.debts, doc.baseCurrency)}</b></div>
          </div>
          <Link href="/reports" className="fe-worth-link">How this is calculated <ArrowUpRight /></Link>
        </div>
      </section>

      {warning && <div className="fe-data-alert"><CircleAlert /><div><b>A couple of things to review</b><span>{[
        summary.missingValues ? `${summary.missingValues} item${summary.missingValues === 1 ? '' : 's'} need a value` : '',
        summary.missingRates ? `${summary.missingRates} foreign-currency value${summary.missingRates === 1 ? '' : 's'} need a rate` : '',
        summary.staleValues ? `${summary.staleValues} value${summary.staleValues === 1 ? '' : 's'} are more than 90 days old` : '',
      ].filter(Boolean).join(' · ')}. Your total may be incomplete.</span></div><Link href="/settings">Review <ArrowRight /></Link></div>}

      <section className="fe-summary-strip">
        <div className="fe-summary-item"><span>Easy to access</span><b>{compactMoney(summary.available, doc.baseCurrency)}</b><small>Self-reported available assets</small></div>
        <div className="fe-summary-item"><span>Items tracked</span><b>{doc.records.length}</b><small>Across {categoryCount} {categoryCount === 1 ? 'type' : 'types'}</small></div>
        <div className="fe-summary-item"><span>Saved in</span><b>This browser</b><small>Updates as you make changes</small></div>
      </section>

      <div className="fe-dashboard-grid">
        <section className="fe-panel fe-category-panel">
          <div className="fe-section-heading"><div><div className="fe-eyebrow">YOUR BREAKDOWN</div><h2>Where it’s held</h2></div><Link href="/assets" className="fe-inline-link">All assets <ArrowRight /></Link></div>
          {summary.byCategory.filter((entry) => entry.category !== 'debt').length > 0 ? <div className="fe-category-list">
            {summary.byCategory.filter((entry) => entry.category !== 'debt').slice(0, 8).map((entry, index) => {
              const displayValue = entry.value;
              const share = summary.assets > 0 ? Math.max(0, displayValue) / summary.assets * 100 : 0;
              return <Link href="/assets" className="fe-category-row" key={entry.category}>
                <span className={cn('fe-category-mark', `tone-${index % 5}`)} />
                <span className="fe-category-label">{entry.label}<small>{entry.count} {entry.count === 1 ? 'item' : 'items'}</small></span>
                <span className="fe-category-meter"><i style={{ width: `${Math.min(100, share)}%` }} /></span>
                <span className="fe-category-value">{compactMoney(displayValue, doc.baseCurrency)}</span>
              </Link>;
            })}
          </div> : <p className="fe-muted-copy">No asset values to chart yet.</p>}
          <div className="fe-panel-footnote">Estimated from the values you entered · {doc.baseCurrency}</div>
        </section>

        <section className="fe-panel fe-recent-panel">
          <div className="fe-section-heading"><div><div className="fe-eyebrow">A SIMPLE PAPER TRAIL</div><h2>Recent activity</h2></div><Link href="/activity" className="fe-inline-link">See all <ArrowRight /></Link></div>
          {latest.length ? <div className="fe-recent-list">{latest.map((activity) => {
            const record = doc.records.find((item) => item.id === activity.recordId);
            return <div className="fe-recent-row" key={activity.id}>
              <span className="fe-recent-icon"><ArrowUpRight /></span><span className="fe-recent-title"><b>{activity.note || activity.type.replace(/^\w/, (letter) => letter.toUpperCase())}</b><small>{record?.name || 'Record'} · {new Date(`${activity.date}T00:00:00`).toLocaleDateString()}</small></span><span className="fe-recent-amount">{formatMoney(activity.amount, activity.currency)}</span>
            </div>;
          })}</div> : <div className="fe-recent-empty"><span>Nothing recorded yet</span><small>Add a deposit, payment, or other change when you want a trail.</small><Link href="/activity">Record an activity <ArrowRight /></Link></div>}
          <Link href="/activity" className="fe-add-activity"><Plus />Record an activity</Link>
        </section>
      </div>
    </>
  );

  return <FinanceShell accountStatus={accountStatus}>
    <div className="fe-page-intro"><div><div className="fe-breadcrumb">MY FINANCES <span>/</span> OVERVIEW</div></div>{doc.isSample && <span className="fe-sample-badge">SAMPLE DATA · NOT LIVE</span>}</div>
    {doc.isSample && <div className="fe-sample-start"><span>Exploring the sample? Keep your personal finances separate.</span><button onClick={() => { if (window.confirm('Start your own empty financial records in this browser? This replaces the current labelled sample picture.')) financeStore.startEmpty(); }}>Start my own records <ArrowRight size={15} /></button></div>}
    {content}
    <div className="fe-overview-bottom"><span>For planning, not advice.</span><Link href="/settings">Manage your picture <ArrowRight /></Link></div>
    <FinanceEditor open={editorOpen} onOpenChange={setEditorOpen} />
  </FinanceShell>;
}
