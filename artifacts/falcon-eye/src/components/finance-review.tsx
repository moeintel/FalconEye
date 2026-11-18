import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFinance } from '@/lib/finance-store';
import { reviewFinance, type ReviewReason } from '@/lib/finance-review';
import { type FinanceRecord } from '@/lib/finance-model';
import { formatDate, formatMoney } from '@/lib/locale';
import { FinanceEditor } from './finance-editor';

const REASONS: ReviewReason[] = ['missingValue', 'missingRate', 'stale'];

export function FinanceReview({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('ux');
  const doc = useFinance();
  const issues = reviewFinance(doc);
  const [editing, setEditing] = useState<FinanceRecord>();
  if (compact && !issues.length) return null;
  return <section className="fe-review-panel" id={compact ? undefined : 'review'} aria-label={t('reviewTitle')}>
    <div className="fe-section-heading"><div><h2><CircleAlert size={20} />{t('reviewTitle')}</h2>{!compact && <p>{t('reviewIntro')}</p>}</div>
      {compact && <Link href="/reports#review" className="fe-inline-link">{t('reviewItems')} <ArrowRight size={16} /></Link>}
    </div>
    {!issues.length && <p>{t('clearReview')}</p>}
    {REASONS.map((reason) => {
      const items = issues.filter((item) => item.reason === reason);
      if (!items.length) return null;
      return <div key={reason} className={`fe-review-group is-${reason}`}>
        <h3>{t(reason, { count: items.length })}</h3>
        {!compact && <><p>{t(`${reason}Help`)}</p>
          {reason === 'missingRate' && <Link href="/settings#currency" className="fe-inline-link">{t('addRate')} <ArrowRight size={16} /></Link>}
          <ul>{items.map(({ record }) => <li key={record.id}>
            <div><b><bdi>{record.name}</bdi></b><span>{record.value === null ? t('noValue') : formatMoney(record.value, record.currency)} · {record.valuationDate === '1970-01-01' ? t('notEntered') : formatDate(record.valuationDate)}</span></div>
            <button className="fe-inline-link" onClick={() => setEditing(record)}>{t('update')}<span className="sr-only">: {record.name}</span><ArrowRight size={16} /></button>
          </li>)}</ul></>}
      </div>;
    })}
    <FinanceEditor open={!!editing} record={editing} onOpenChange={(open) => { if (!open) setEditing(undefined); }} />
  </section>;
}
