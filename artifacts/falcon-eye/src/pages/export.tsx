import { useMemo } from 'react';
import { FileSpreadsheet, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, Logo } from '@/components/shell';
import { buildInsights, download, healthScore, summarize, toCsv, usePortfolio } from '@/lib/portfolio';
import { presentInsight, scoreLabel, type Translate } from '@/pages/insights';
import { useToast } from '@/hooks/use-toast';
import { AssetIcon } from '@/components/asset-icon';
import { useTranslation } from 'react-i18next';
import { formatNumber, getLocale, money, pct, qty } from '@/lib/locale';

export default function ExportPage() {
  const { t } = useTranslation('legacy');
  const { holdings, isDemo } = usePortfolio();
  const s = useMemo(() => summarize(holdings), [holdings]);
  const insights = useMemo(() => buildInsights(s), [s]);
  const { toast } = useToast();
  const stamp = new Date().toISOString().slice(0, 10);
  const empty = !holdings.length;
  const translate: Translate = (key, options) => String(t(key, options ?? {}));

  return (
    <>
      <div className="no-print">
        <PageHeader kicker={t('shell.navigation.export')} title={t('export.title')}>
          {t('export.description')}
        </PageHeader>
        <div className="rise mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <h2 className="mt-3 font-bold">{t('export.csv.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('export.csv.description')}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />{t('export.csv.safety')}</p>
            <Button className="mt-4" disabled={empty} data-testid="button-export-csv" onClick={() => { download(`falcon-eye-holdings-${stamp}.csv`, toCsv(holdings, true)); toast({ title: t('export.csv.downloaded'), description: t('export.csv.exported', { count: holdings.length }) }); }}>{t('export.csv.download')}</Button>
          </div>
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <Printer className="h-6 w-6 text-primary" />
            <h2 className="mt-3 font-bold">{t('export.print.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('export.print.description')}</p>
            <Button className="mt-4" variant="outline" disabled={empty} onClick={() => window.print()} data-testid="button-print">{t('export.print.button')}</Button>
          </div>
        </div>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t('export.preview')}</div>
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-input bg-card p-10 text-center text-muted-foreground">{t('export.empty')}</div>
      ) : (
        <article className="rounded-2xl border border-card-border bg-card p-8 text-[13px] print:border-0 print:p-0 md:p-12" data-testid="report">
          <header className="flex items-start justify-between border-b-2 border-foreground pb-5">
            <div className="flex items-center gap-3">
              <Logo className="h-10 w-10 text-foreground" />
              <div>
                <div className="text-2xl font-extrabold tracking-tight">{t('export.report.title')}</div>
                <div className="text-muted-foreground">{t('export.report.generated', { date: new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long', timeStyle: 'short', calendar: 'gregory' }).format(new Date()) })}</div>
              </div>
            </div>
            <div className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t('shell.prototype')}<br />{isDemo ? t('export.report.sample') : t('export.report.personal')}</div>
          </header>

          <section className="grid grid-cols-2 gap-4 border-b border-border py-6 md:grid-cols-4">
            {[[t('overview.totalValue'), money(s.total)], [t('overview.costBasis'), money(s.cost)], [t('export.report.gain'), `${s.gain >= 0 ? '+' : '-'}${money(Math.abs(s.gain))} (${formatNumber(s.gainPct, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)`], [t('export.report.diversification'), `${formatNumber(healthScore(s))}/100 · ${t(scoreLabel(healthScore(s)))}`]].map(([k, v]) => (
              <div key={k}><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div><div className="num mt-1 text-base font-semibold">{v}</div></div>
            ))}
          </section>

          <section className="border-b border-border py-6">
            <h3 className="mb-3 font-bold uppercase tracking-wider">{t('export.report.allocation')}</h3>
            <table className="w-full">
              <tbody>
                {s.byType.map((item) => (
                  <tr key={item.type} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5">{t(`assetTypes.${item.type.toLowerCase()}`)}</td>
                    <td className="py-1.5 text-muted-foreground">{String(translate('export.report.allocationCount', { count: item.count }))}</td>
                    <td className="num py-1.5 text-right">{money(item.value)}</td>
                    <td className="num w-20 py-1.5 text-right">{pct(item.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="border-b border-border py-6">
            <h3 className="mb-3 font-bold uppercase tracking-wider">{t('shell.navigation.holdings')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground"><th className="py-1.5">{t('export.report.columns.symbol')}</th><th>{t('export.report.columns.name')}</th><th>{t('export.report.columns.type')}</th><th className="text-right">{t('export.report.columns.quantity')}</th><th className="text-right">{t('export.report.columns.price')}</th><th className="text-right">{t('export.report.columns.value')}</th><th className="text-right">{t('export.report.columns.gain')}</th><th className="text-right">{t('export.report.columns.weight')}</th></tr></thead>
                <tbody>
                  {s.sorted.map((h) => (
                    <tr key={h.id} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 font-mono font-semibold"><span className="inline-flex items-center gap-2"><AssetIcon symbol={h.symbol} assetType={h.assetType} className="h-7 w-7 rounded-lg" />{h.symbol}</span></td><td>{h.name}</td><td>{t(`assetTypes.${h.assetType.toLowerCase()}`)}</td>
                      <td className="num text-right">{qty(h.quantity)}</td><td className="num text-right">{money(h.currentPrice)}</td><td className="num text-right">{money(h.value)}</td>
                      <td className="num text-right">{h.gain >= 0 ? '+' : '-'}{money(Math.abs(h.gain))}</td><td className="num text-right">{pct(h.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="py-6">
            <h3 className="mb-3 font-bold">{t('insights.kicker')}</h3>
            <ul className="space-y-2">
              {insights.map((i) => { const presented = presentInsight(i, s, translate); return <li key={i.id}><b>{presented.title}.</b> {presented.detail}</li>; })}
            </ul>
          </section>
          <footer className="border-t border-border pt-4 text-[11px] text-muted-foreground">
            {t('export.report.disclaimer', { priceSource: isDemo ? t('export.report.samplePrices') : t('export.report.userPrices') })}
          </footer>
        </article>
      )}
    </>
  );
}
