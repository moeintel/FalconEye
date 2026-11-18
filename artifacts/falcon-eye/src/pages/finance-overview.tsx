import { type ReactNode, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, ArrowUpRight, Plus, Sparkles, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanceEditor } from '@/components/finance-editor';
import { FinanceShell } from '@/components/finance-shell';
import { FinanceReview } from '@/components/finance-review';
import { CATEGORIES, summarizeFinance } from '@/lib/finance-model';
import { formatMoney, formatNumber, formatDate } from '@/lib/locale';
import { useTranslation } from 'react-i18next';
import { useFinance } from '@/lib/finance-store';
import { cn } from '@/lib/utils';

const compactMoney = (value: number, currency: string) => formatNumber(value, { style: 'currency', currency, notation: Math.abs(value) >= 100_000 ? 'compact' : 'standard', maximumFractionDigits: 1 });

export default function FinanceOverview({ accountStatus }: { accountStatus?: ReactNode }) {
  const { t } = useTranslation('overview');
  const { t: common } = useTranslation('common');
  const { t: ux } = useTranslation('ux');
  const doc = useFinance();
  const summary = useMemo(() => summarizeFinance(doc), [doc]);
  const [editorOpen, setEditorOpen] = useState(false);
  const latest = [...doc.activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const categoryCount = CATEGORIES.filter(({ id }) => summary.byCategory.some((item) => item.category === id)).length;

  const content = doc.records.length === 0 ? (
    <section className="fe-welcome-card">
      <div className="fe-welcome-copy">
        <div className="fe-eyebrow"><span className="fe-eyebrow-line" />{t('eyebrow')}</div>
        <h1>{t('emptyTitle')}<br /><span>{t('emptyTitleEnd')}</span></h1>
        <p>{t('emptyDescription')}</p>
        <div className="fe-welcome-actions"><Button onClick={() => setEditorOpen(true)}><Plus />{t('addFirst')}</Button><button className="fe-text-action" onClick={() => window.dispatchEvent(new CustomEvent('falconeye:open-assistant'))}>{t('askWhereToStart')} <ArrowRight /></button></div>
        <div className="fe-privacy-note"><span className="fe-lock-dot" />{ux('localOnly')}</div>
      </div>
      <div className="fe-orbit-illustration" aria-hidden="true"><div className="fe-orbit fe-orbit-one" /><div className="fe-orbit fe-orbit-two" /><div className="fe-orbit-center"><WalletCards /><span>{t('yourMoney')}</span></div><span className="fe-orbit-tag tag-cash">{common('categories.cash')}</span><span className="fe-orbit-tag tag-home">{t('home')}</span><span className="fe-orbit-tag tag-invest">{t('investments')}</span><span className="fe-orbit-tag tag-debt">{common('navigation.debts')}</span></div>
    </section>
  ) : (
    <>
      <section className="fe-welcome-card fe-dashboard-hero">
        <div className="fe-welcome-copy">
          <div className="fe-eyebrow"><span className="fe-eyebrow-line" />{t(doc.isSample ? 'sampleEyebrow' : 'personalEyebrow')}</div>
          <h1>{t('title')}<br /><span>{t('titleEnd')}</span></h1>
          <p>{t(doc.isSample ? 'sampleDescription' : 'personalDescription')}</p>
          <div className="fe-welcome-actions"><Button onClick={() => setEditorOpen(true)}><Plus />{t('add')}</Button><button className="fe-text-action" onClick={() => window.dispatchEvent(new CustomEvent('falconeye:open-assistant'))}><Sparkles />{common('askFalc')} <ArrowRight /></button></div>
        </div>
        <div className="fe-worth-card">
          <span className="fe-worth-label">{t('netWorth')}</span>
          <strong>{compactMoney(summary.netWorth, doc.baseCurrency)}</strong>
          <span className="fe-worth-caption">{t('netWorthExplanation', { currency: doc.baseCurrency })}</span>
          {(summary.missingValues > 0 || summary.missingRates > 0) && <span className="fe-worth-warning">{ux('partialTotal')}</span>}
          <Button className="fe-worth-add" onClick={() => setEditorOpen(true)}><Plus />{t('add')}</Button>
          <div className="fe-worth-breakdown">
            <div><span><i className="fe-asset-dot" />{common('navigation.assets')}</span><b>{compactMoney(summary.assets, doc.baseCurrency)}</b></div>
            <div><span><i className="fe-debt-dot" />{common('navigation.debts')}</span><b>{compactMoney(summary.debts, doc.baseCurrency)}</b></div>
          </div>
          <Link href="/reports" className="fe-worth-link">{t('calculation')} <ArrowUpRight /></Link>
        </div>
      </section>

      <div className="fe-dashboard-grid">
        <section className="fe-panel fe-category-panel">
          <div className="fe-section-heading"><div><div className="fe-eyebrow">{t('breakdown')}</div><h2>{t('whereHeld')}</h2></div><Link href="/assets" className="fe-inline-link">{t('allAssets')} <ArrowRight /></Link></div>
          {summary.byCategory.filter((entry) => entry.category !== 'debt').length > 0 ? <div className="fe-category-list">
            {summary.byCategory.filter((entry) => entry.category !== 'debt').slice(0, 8).map((entry, index) => {
              const displayValue = entry.value;
              const share = summary.assets > 0 ? Math.max(0, displayValue) / summary.assets * 100 : 0;
              return <Link href="/assets" className="fe-category-row" key={entry.category}>
                <span className={cn('fe-category-mark', `tone-${index % 5}`)} />
                <span className="fe-category-label">{common(`categories.${entry.category}`)}<small>{common('records', { count: entry.count })}</small></span>
                <span className="fe-category-meter"><i style={{ width: `${Math.min(100, share)}%` }} /></span>
                <span className="fe-category-value">{compactMoney(displayValue, doc.baseCurrency)}</span>
              </Link>;
            })}
          </div> : <p className="fe-muted-copy">{t('noValues')}</p>}
          <div className="fe-panel-footnote">{t('estimatedFromEntries', { currency: doc.baseCurrency })}</div>
        </section>

        <section className="fe-panel fe-recent-panel">
          <div className="fe-section-heading"><div><div className="fe-eyebrow">{t('paperTrail')}</div><h2>{t('recentActivity')}</h2></div><Link href="/activity" className="fe-inline-link">{t('seeAll')} <ArrowRight /></Link></div>
          {latest.length ? <div className="fe-recent-list">{latest.map((activity) => {
            const record = doc.records.find((item) => item.id === activity.recordId);
            return <div className="fe-recent-row" key={activity.id}>
              <span className="fe-recent-icon"><ArrowUpRight /></span><span className="fe-recent-title"><b>{activity.note || common(`activityTypes.${activity.type}`)}</b><small><bdi>{record?.name || t('record')}</bdi> · {formatDate(activity.date)}</small></span><span className="fe-recent-amount">{formatMoney(activity.amount, activity.currency)}</span>
            </div>;
          })}</div> : <div className="fe-recent-empty"><span>{t('noActivity')}</span><small>{t('activityDescription')}</small><Link href="/activity">{t('recordActivity')} <ArrowRight /></Link></div>}
          <Link href="/activity" className="fe-add-activity"><Plus />{t('recordActivity')}</Link>
        </section>
      </div>

      <FinanceReview compact />

      <section className="fe-summary-strip">
        <div className="fe-summary-item"><span>{t('accessible')}</span><b>{compactMoney(summary.available, doc.baseCurrency)}</b><small>{ux('accessibleHelp')}</small></div>
        <div className="fe-summary-item"><span>{t('tracked')}</span><b>{formatNumber(doc.records.length)}</b><small>{t('categoryCount', { count: categoryCount })}</small></div>
        <div className="fe-summary-item"><span>{t('savedIn')}</span><b>{t('thisBrowser')}</b><small><Link href="/settings#backup">{ux('backup')} <ArrowRight size={14} /></Link></small></div>
      </section>
    </>
  );

  return <FinanceShell accountStatus={accountStatus}>
    {doc.isSample && <div className="fe-sample-start"><span>{ux('sampleShort')}</span><button onClick={() => setEditorOpen(true)}>{ux('startOwn')} <ArrowRight size={15} /></button></div>}
    {content}
    <div className="fe-overview-bottom"><span>{t('disclaimer')}</span><Link href="/settings">{t('manage')} <ArrowRight /></Link></div>
    <FinanceEditor open={editorOpen} onOpenChange={setEditorOpen} />
  </FinanceShell>;
}
