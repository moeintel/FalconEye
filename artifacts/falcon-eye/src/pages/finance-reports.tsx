import { type ReactNode, useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanceShell } from '@/components/finance-shell';
import { summarizeFinance } from '@/lib/finance-model';
import { formatMoney, formatNumber } from '@/lib/locale';
import i18n from '@/lib/i18n';
import { Trans, useTranslation } from 'react-i18next';
import { financeStore, useFinance } from '@/lib/finance-store';
import { FinanceReview } from '@/components/finance-review';

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(href);
}
function csvCell(value: unknown) {
  const raw = String(value ?? '');
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}
function exportCsv() {
  const doc = financeStore.getSnapshot();
  const columns = ['name', 'category', 'currency', 'cost', 'value', 'date', 'source', 'access', 'location', 'notes'].map((key) => i18n.t(`reports:csv.${key}`));
  const rows = doc.records.map((item) => [item.name, i18n.t(`common:categories.${item.category}`), item.currency, item.cost, item.value, item.valuationDate === '1970-01-01' ? i18n.t('reports:unknownDate') : item.valuationDate, i18n.t(`reports:sources.${item.valuationSource}`), i18n.t(`reports:access.${item.access}`), item.location, item.notes]);
  download('falcon-eye-financial-records.csv', '\uFEFF' + [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
function exportJson() {
  download('falcon-eye-financial-picture.json', JSON.stringify(financeStore.getSnapshot(), null, 2), 'application/json');
}

export default function FinanceReports({ accountStatus }: { accountStatus?: ReactNode }) {
  const { t } = useTranslation('reports');
  const { t: common } = useTranslation('common');
  const { t: ux } = useTranslation('ux');
  const doc = useFinance();
  const summary = useMemo(() => summarizeFinance(doc), [doc]);
  const assets = summary.byCategory.filter((item) => item.category !== 'debt' && item.value > 0).sort((a, b) => b.value - a.value);
  const hasMissing = summary.missingValues + summary.missingRates > 0;
  return <FinanceShell accountStatus={accountStatus}>
    <div className="fe-breadcrumb">{t('breadcrumb')} <span>/</span> {common('navigation.reports')}</div>
    <div className="fe-assets-title-row fe-report-heading">
      <div><div className="fe-eyebrow">{t('eyebrow')}</div><h1>{t('title')}</h1><p>{t('description', { currency: doc.baseCurrency })}</p></div>
      <details className="fe-download-menu no-print" id="downloads"><summary>{ux('download')}</summary><div>
        <Button variant="ghost" onClick={() => window.print()}>{ux('pdf')}</Button>
        <Button variant="ghost" onClick={exportCsv}>{ux('csv')}</Button>
        <Button variant="ghost" onClick={exportJson}>{ux('json')}</Button>
        <p>{ux('downloadHelp')}</p>
      </div></details>
    </div>
    {doc.isSample && <div className="fe-sample-inline"><span className="fe-sample-dot" />{t('sample')}</div>}
    <section className="fe-picture-explanation"><h2>{ux('pictureMeaning')}</h2><p>{ux('pictureSummary', { amount: formatMoney(summary.netWorth, doc.baseCurrency) })}</p><p>{ux(hasMissing ? 'pictureIncomplete' : 'pictureKnown')}</p></section>
    <section className="fe-report-kpis">
      <div><span>{common('navigation.assets')}</span><b>{formatMoney(summary.assets, doc.baseCurrency)}</b><small>{t('converted', { currency: doc.baseCurrency })}</small></div>
      <div><span>{common('navigation.debts')}</span><b>{formatMoney(summary.debts, doc.baseCurrency)}</b><small>{t('outstanding')}</small></div>
      <div className="fe-kpi-emphasis"><span>{t('netWorth')}</span><b>{formatMoney(summary.netWorth, doc.baseCurrency)}</b><small>{t('assetsLessDebts')}</small></div>
    </section>
    <FinanceReview />
    <div className="fe-report-grid">
      <section className="fe-panel fe-report-allocation">
        <div className="fe-section-heading"><div><div className="fe-eyebrow">{t('assetsOnly')}</div><h2>{t('byType')}</h2></div><span className="fe-report-unit"><bdi>{doc.baseCurrency}</bdi></span></div>
        {assets.length ? <div className="fe-report-bars">{assets.map((entry, index) => <div className="fe-report-bar-row" key={entry.category}>
          <div className="fe-report-bar-label"><span><i className={`fe-category-mark tone-${index % 5}`} />{common(`categories.${entry.category}`)}</span><b>{formatMoney(entry.value, doc.baseCurrency)}</b></div>
          <div className="fe-report-bar"><i style={{ width: `${summary.assets ? entry.value / summary.assets * 100 : 0}%` }} /></div><small>{summary.assets ? t('knownShare', { percent: formatNumber(entry.value / summary.assets * 100, { maximumFractionDigits: 1 }) }) : t('noKnownValue')}</small>
        </div>)}</div> : <div className="fe-report-empty">{t('empty')}</div>}
      </section>
      <section className="fe-panel fe-report-notes">
        <div className="fe-section-heading"><div><div className="fe-eyebrow">{t('totalsNote')}</div><h2>{t('included')}</h2></div><ShieldCheck /></div>
        <ul className="fe-report-rules">
          {['known', 'rates', 'dates', 'ownership'].map((rule, index) => <li key={rule}><span>0{index + 1}</span><p><Trans t={t} i18nKey={`rules.${rule}`} components={{ bold: <b /> }} /></p></li>)}
        </ul>
        <Link className="fe-inline-link fe-settings-report-link" href="/settings">{t('currencySettings')} <ArrowUpRight /></Link>
      </section>
    </div>
    <section className="fe-local-reminder"><b>{ux('localOnly')}</b><p>{ux('localRisk')}</p><Link href="/settings#backup" className="fe-inline-link">{ux('storageSettings')} <ArrowUpRight size={16} /></Link></section>
    <p className="fe-report-disclaimer">{t('disclaimer')}</p>
  </FinanceShell>;
}
