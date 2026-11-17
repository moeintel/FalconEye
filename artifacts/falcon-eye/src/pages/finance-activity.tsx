import { type ReactNode, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, CircleAlert, Plus, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActivityEditor } from '@/components/finance-editor';
import { FinanceShell } from '@/components/finance-shell';
import { formatMoney, formatDate } from '@/lib/locale';
import { useTranslation } from 'react-i18next';
import { useFinance } from '@/lib/finance-store';

const TYPES = ['contribution', 'withdrawal', 'income', 'repayment', 'fee', 'valuation'];

export default function FinanceActivity({ accountStatus }: { accountStatus?: ReactNode }) {
  const { t } = useTranslation('activity');
  const { t: common } = useTranslation('common');
  const doc = useFinance();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const activities = useMemo(() => [...doc.activities]
    .filter((event) => filter === 'all' || event.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date)), [doc.activities, filter]);
  const days = new Set(activities.map(({ date }) => date)).size;
  return <FinanceShell accountStatus={accountStatus}>
    <div className="fe-breadcrumb">{t('breadcrumb')} <span>/</span> {common('navigation.activity')}</div>
    <div className="fe-assets-title-row">
      <div><div className="fe-eyebrow">{t('eyebrow')}</div><h1>{common('navigation.activity')}<span className="fe-title-count">{doc.activities.length}</span></h1><p>{t('description')}</p></div>
      <Button onClick={() => setOpen(true)} disabled={!doc.records.length}><Plus />{t('record')}</Button>
    </div>
    {doc.isSample && <div className="fe-sample-inline"><span className="fe-sample-dot" />{t('sample')}</div>}
    <section className="fe-assets-summary fe-activity-summary">
      <div className="fe-assets-summary-icon"><CalendarClock /></div><div><span>{t('trail')}</span><b>{t('entries', { count: doc.activities.length })}</b><small>{t('days', { count: days })}</small></div>
      <label className="fe-filter-select"><ReceiptText /><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('filter')}><option value="all">{t('all')}</option>{TYPES.map((key) => <option value={key} key={key}>{common(`activityTypes.${key}`)}</option>)}</select></label>
    </section>
    <section className="fe-list-panel fe-activity-panel">
      {activities.length ? <div className="fe-activity-list">
        {activities.map((event) => {
          const record = doc.records.find((item) => item.id === event.recordId);
          const incoming = ['contribution', 'income'].includes(event.type) || (event.type === 'repayment' && record?.category === 'lent');
          return <article key={event.id} className="fe-activity-row">
            <span className={`fe-activity-sign ${incoming ? 'is-incoming' : 'is-outgoing'}`}>{incoming ? <ArrowDownLeft /> : <ArrowUpRight />}</span>
            <div className="fe-activity-copy"><b>{common(`activityTypes.${event.type}`)}</b><span><bdi>{record?.name || t('removed')}</bdi>{event.note && <> · <bdi>{event.note}</bdi></>}</span></div>
            <time dateTime={event.date}>{formatDate(event.date, { day: 'numeric', month: 'short', year: 'numeric' })}</time>
            <strong>{formatMoney(event.amount, event.currency)}</strong>
          </article>;
        })}
      </div> : <div className="fe-list-empty"><span className="fe-empty-icon"><CalendarClock /></span><h2>{t(filter !== 'all' ? 'noMatching' : 'freshStart')}</h2><p>{t(doc.records.length ? 'emptyWithRecords' : 'emptyWithoutRecords')}</p>{doc.records.length > 0 && <Button onClick={() => setOpen(true)}><Plus />{t('recordFirst')}</Button>}</div>}
      {activities.length > 0 && <div className="fe-list-footnote"><span><CircleAlert />{t('adjustValues')}</span><span>{t('local')}</span></div>}
    </section>
    <p className="fe-activity-guidance">{t('guidance')}</p>
    <ActivityEditor open={open} onOpenChange={setOpen} />
  </FinanceShell>;
}
