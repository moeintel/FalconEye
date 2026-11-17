import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, Plus, Upload, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell';
import { AllocationDonut, AllocationLegend, Gain, TypeChip } from '@/components/allocation';
import { HoldingDialog } from '@/components/holding-form';
import { AssetIcon } from '@/components/asset-icon';
import { ASSET_COLORS, buildInsights, healthScore, store, summarize, usePortfolio } from '@/lib/portfolio';
import { useToast } from '@/hooks/use-toast';
import { ToneDot } from '@/pages/insights';
import { presentInsight, type Translate } from '@/pages/insights';
import { useTranslation } from 'react-i18next';
import { formatNumber, money, pct } from '@/lib/locale';

export default function Overview() {
  const { t } = useTranslation('legacy');
  const { holdings, isDemo } = usePortfolio();
  const s = useMemo(() => summarize(holdings), [holdings]);
  const insights = useMemo(() => buildInsights(s), [s]);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();
  const sources = new Set(holdings.map((h) => h.source)).size;

  const translate: Translate = (key, options) => String(t(key, options ?? {}));
  const addDialog = <HoldingDialog open={adding} onOpenChange={setAdding} onSave={(h) => { store.add(h); toast({ title: t('overview.added', { symbol: h.symbol }), description: t('overview.updated') }); }} />;

  if (!holdings.length)
    return (
      <>
        <PageHeader kicker={t('shell.navigation.overview')} title={t('overview.emptyTitle')} />
        <div className="rise relative overflow-hidden rounded-2xl border border-dashed border-input bg-card p-10 md:p-16">
          <div className="contour absolute inset-0" />
          <div className="relative max-w-lg">
            <Layers className="mb-5 h-10 w-10 text-accent" />
            <h2 className="text-2xl font-bold">{t('overview.emptyHeading')}</h2>
            <p className="mt-2 text-muted-foreground">{t('overview.emptyDescription')}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => setAdding(true)} data-testid="button-empty-add"><Plus className="mr-1 h-4 w-4" />{t('overview.addHolding')}</Button>
              <Button variant="outline" asChild><Link href="/import" data-testid="link-empty-import"><Upload className="mr-1 h-4 w-4" />{t('overview.importCsv')}</Link></Button>
              <Button variant="ghost" onClick={() => { store.loadDemo(); toast({ title: t('dataControls.loadDemo') }); }} data-testid="button-empty-demo">{t('dataControls.loadDemo')}</Button>
            </div>
          </div>
        </div>
        {addDialog}
      </>
    );

  const score = healthScore(s);
  const maxV = s.sorted[0]?.value || 1;

  return (
    <>
      <PageHeader
        kicker={isDemo ? t('overview.sampleKicker') : t('shell.navigation.overview')}
        title={<>{t('overview.title')}<br className="hidden md:block" /> <span className="text-muted-foreground">{t('overview.titleAccent')}</span></>}
        actions={<>
          <Button variant="outline" asChild><Link href="/import" data-testid="link-import"><Upload className="mr-1 h-4 w-4" />{t('shell.navigation.import')}</Link></Button>
          <Button onClick={() => setAdding(true)} data-testid="button-add-holding"><Plus className="mr-1 h-4 w-4" />{t('overview.addHolding')}</Button>
        </>}
      />

      <section className="rise grid gap-4 lg:grid-cols-[1.4fr_1fr]" style={{ animationDelay: '60ms' }}>
        <div className="relative overflow-hidden rounded-2xl bg-sidebar p-7 text-sidebar-foreground md:p-9">
          <div className="contour absolute inset-0" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-sidebar-foreground/60">{t('overview.totalValue')}</span>
              {isDemo && <span className="rounded-full border border-sidebar-primary/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sidebar-primary" data-testid="badge-sample">{t('overview.sampleBadge')}</span>}
            </div>
            <div className="num mt-3 text-5xl font-semibold md:text-6xl" data-testid="text-total-value">{money(s.total)}</div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 text-sm">
              <span className={`num rounded-md px-2 py-0.5 ${s.gain >= 0 ? 'bg-[hsl(152_45%_40%/.25)] text-[hsl(152_60%_75%)]' : 'bg-destructive/25 text-[hsl(4_90%_80%)]'}`} data-testid="text-total-gain">
                 {s.gain >= 0 ? '+' : '-'}{money(Math.abs(s.gain))} ({s.gain >= 0 ? '+' : ''}{formatNumber(s.gainPct, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)
              </span>
              <span className="text-sidebar-foreground/60">{t('overview.gainDescription')}</span>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-sidebar-border pt-5">
              {[
                [t('overview.costBasis'), money(s.cost), 'text-cost'],
                [t('overview.holdings'), formatNumber(s.count), 'text-count'],
                [t('overview.sources'), formatNumber(sources), 'text-sources'],
              ].map(([k, v, id]) => (
                <div key={k}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/50">{k}</div>
                  <div className="num mt-1 text-lg" data-testid={id}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-sidebar-accent">
              <div className="flex h-full">
                {s.byType.map((t) => <div key={t.type} style={{ width: `${t.pct}%`, background: ASSET_COLORS[t.type] }} className="h-full" />)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">{t('overview.allocation')}</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t('overview.byMarketValue')}</span>
          </div>
          <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr] lg:grid-cols-1 xl:grid-cols-[auto_1fr]">
            <AllocationDonut s={s} size={200} />
            <AllocationLegend s={s} />
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rise rounded-2xl border border-card-border bg-card p-6" style={{ animationDelay: '120ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">{t('overview.largest')}</h2>
            <Link href="/holdings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-all-holdings">{t('overview.allHoldings', { count: s.count })} <ArrowUpRight className="legacy-direction-arrow h-3.5 w-3.5" /></Link>
          </div>
          <ul className="divide-y divide-border">
            {s.sorted.slice(0, 6).map((h) => (
              <li key={h.id} className="group grid grid-cols-[1fr_auto] items-center gap-3 py-3" data-testid={`row-top-${h.id}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <AssetIcon symbol={h.symbol} assetType={h.assetType} className="h-8 w-8 rounded-lg" />
                    <span className="font-mono text-sm font-semibold">{h.symbol}</span>
                    <TypeChip type={h.assetType} />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{h.name}</div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full origin-left rounded-full bg-primary/70 transition-transform duration-700 group-hover:bg-accent" style={{ transform: `scaleX(${h.value / maxV})` }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-sm font-semibold">{money(h.value)}</div>
                  <div className="text-xs"><Gain v={h.gain} p={h.gainPct} /></div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rise rounded-2xl border border-card-border bg-card p-6" style={{ animationDelay: '180ms' }}>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-accent" />{t('overview.healthCheck')}</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t('insights.kicker')}</span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="num text-5xl font-semibold" data-testid="text-health-score">{score}</span>
            <span className="mb-1.5 text-sm text-muted-foreground">{t('overview.diversificationScore')}</span>
          </div>
          <ul className="mt-5 space-y-3">
            {insights.slice(0, 4).map((i) => (
              <li key={i.id} className="flex gap-3 text-sm">
                <ToneDot tone={i.tone} />
                <div className="flex-1"><div className="font-medium">{presentInsight(i, s, translate).title}</div></div>
                <span className="num text-muted-foreground">{presentInsight(i, s, translate).metric}</span>
              </li>
            ))}
          </ul>
          <Link href="/insights" className="mt-5 flex items-center gap-1 text-sm font-medium text-primary hover:underline" data-testid="link-insights">{t('overview.fullAssessment')} <ArrowUpRight className="legacy-direction-arrow h-3.5 w-3.5" /></Link>
          <p className="mt-3 text-[11px] text-muted-foreground">{t('overview.healthDisclaimer')}</p>
        </div>
      </section>

      <section className="rise mt-4 grid gap-4 md:grid-cols-5" style={{ animationDelay: '240ms' }}>
        {s.byType.map((item) => (
          <div key={item.type} className="rounded-xl border border-card-border bg-card p-4 transition-transform hover:-translate-y-0.5">
            <TypeChip type={item.type} />
            <div className="num mt-3 font-semibold">{money(item.value)}</div>
            <div className="mt-0.5 flex justify-between text-xs text-muted-foreground"><span>{t('overview.ofTotal', { percent: pct(item.pct) })}</span><Gain v={item.gain} /></div>
          </div>
        ))}
      </section>
      {addDialog}
    </>
  );
}
