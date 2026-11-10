import { type ReactNode, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, CircleAlert, Plus, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActivityEditor } from '@/components/finance-editor';
import { FinanceShell } from '@/components/finance-shell';
import { formatMoney } from '@/lib/finance-model';
import { useFinance } from '@/lib/finance-store';

const LABELS: Record<string, string> = {
  contribution: 'Money added', withdrawal: 'Money taken out', income: 'Distribution received',
  repayment: 'Repayment', fee: 'Fee paid', valuation: 'Value updated',
};

export default function FinanceActivity({ accountStatus }: { accountStatus?: ReactNode }) {
  const doc = useFinance();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const activities = useMemo(() => [...doc.activities]
    .filter((event) => filter === 'all' || event.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date)), [doc.activities, filter]);
  const days = new Set(activities.map(({ date }) => date)).size;
  return <FinanceShell accountStatus={accountStatus}>
    <div className="fe-breadcrumb">MY FINANCES <span>/</span> ACTIVITY</div>
    <div className="fe-assets-title-row">
      <div><div className="fe-eyebrow">A HELPFUL RECORD, NOT ANOTHER TASK</div><h1>Activity<span className="fe-title-count">{doc.activities.length}</span></h1><p>Keep a lightweight history of deposits, payments, income, and updates.</p></div>
      <Button onClick={() => setOpen(true)} disabled={!doc.records.length}><Plus />Record an activity</Button>
    </div>
    {doc.isSample && <div className="fe-sample-inline"><span className="fe-sample-dot" />Sample activity is illustrative—not your personal financial history.</div>}
    <section className="fe-assets-summary fe-activity-summary">
      <div className="fe-assets-summary-icon"><CalendarClock /></div><div><span>YOUR PAPER TRAIL</span><b>{doc.activities.length} {doc.activities.length === 1 ? 'entry' : 'entries'}</b><small>{days} {days === 1 ? 'day' : 'days'} with updates · stored locally</small></div>
      <label className="fe-filter-select"><ReceiptText /><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter activity type"><option value="all">All activity</option>{Object.entries(LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
    </section>
    <section className="fe-list-panel fe-activity-panel">
      {activities.length ? <div className="fe-activity-list">
        {activities.map((event) => {
          const record = doc.records.find((item) => item.id === event.recordId);
          const incoming = ['contribution', 'income'].includes(event.type) || (event.type === 'repayment' && record?.category === 'lent');
          return <article key={event.id} className="fe-activity-row">
            <span className={`fe-activity-sign ${incoming ? 'is-incoming' : 'is-outgoing'}`}>{incoming ? <ArrowDownLeft /> : <ArrowUpRight />}</span>
            <div className="fe-activity-copy"><b>{LABELS[event.type] || event.type}</b><span>{record?.name || 'Removed record'}{event.note ? ` · ${event.note}` : ''}</span></div>
            <time dateTime={event.date}>{new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</time>
            <strong>{formatMoney(event.amount, event.currency)}</strong>
          </article>;
        })}
      </div> : <div className="fe-list-empty"><span className="fe-empty-icon"><CalendarClock /></span><h2>{filter !== 'all' ? 'No activity of this type' : 'A fresh start'}</h2><p>{doc.records.length ? 'Whenever something changes, add a note here. It helps you remember why your numbers changed.' : 'Add an asset or debt first. You can then record a deposit, payment, or other update.'}</p>{doc.records.length > 0 && <Button onClick={() => setOpen(true)}><Plus />Record your first activity</Button>}</div>}
      {activities.length > 0 && <div className="fe-list-footnote"><span><CircleAlert />Some activity types also adjust a saved value when one is already known.</span><span>Stored in this browser</span></div>}
    </section>
    <p className="fe-activity-guidance">An entry is a record of what happened, not a bank transaction. Nothing is connected, transferred, or invested.</p>
    <ActivityEditor open={open} onOpenChange={setOpen} />
  </FinanceShell>;
}
