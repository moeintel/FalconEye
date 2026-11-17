import { useMemo } from 'react';
import { Link } from 'wouter';
import { Sparkles, ShieldCheck, Eye, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell';
import { AllocationDonut, AllocationLegend, Gain } from '@/components/allocation';
import { type Tone, buildInsights, healthScore, summarize, usePortfolio } from '@/lib/portfolio';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/locale';
import type { Insight, Summary } from '@/lib/portfolio';
import type { TOptions } from 'i18next';

const TONE: Record<Tone, { cls: string; Icon: typeof Eye }> = {
  good: { cls: 'bg-[hsl(176_42%_38%)]', Icon: ShieldCheck },
  watch: { cls: 'bg-accent', Icon: Eye },
  risk: { cls: 'bg-[hsl(14_72%_52%)]', Icon: AlertOctagon },
};

export function ToneDot({ tone }: { tone: Tone }) {
  const { t } = useTranslation('legacy');
  return <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE[tone].cls)} title={t(`insights.tones.${tone}`)} />;
}

export function scoreLabel(n: number) {
  return n >= 75 ? 'insights.scoreLabels.wellSpread' : n >= 50 ? 'insights.scoreLabels.moderate' : 'insights.scoreLabels.high';
}

const typeMessage = (type: string) => `assetTypes.${type.toLowerCase()}`;
const formatPct = (value: number) => `${formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const formatSignedPct = (value: number) => `${value >= 0 ? '+' : ''}${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export type Translate = (key: string, options?: TOptions) => string;

export function presentInsight(insight: Insight, s: Summary, t: Translate) {
  const top = s.sorted[0];
  const top3 = s.sorted.slice(0, 3).reduce((total, holding) => total + holding.pct, 0);
  const types = s.byType.map(({ type }) => t(typeMessage(type))).join(', ');
  const base = `insights.items.${insight.id}`;
  let titleKey = `${base}.title`;
  let detailKey = `${base}.detail`;
  let metric = insight.metric;
  let options: TOptions = {};
  if (insight.id === 'top' && top) {
    const variant = insight.tone === 'risk' ? 'risk' : insight.tone === 'watch' ? 'watch' : 'good';
    titleKey = `${base}.title.${variant}`;
    detailKey = `${base}.detail.${variant}`;
    options = { symbol: top.symbol, name: top.name, percent: formatPct(top.pct) };
    metric = formatPct(top.pct);
  } else if (insight.id === 'top3') {
    options = { symbols: s.sorted.slice(0, 3).map((holding) => holding.symbol).join(', '), percent: formatPct(top3) };
    metric = formatPct(top3);
  } else if (insight.id === 'mix') {
    const count = s.byType.length;
    const variant = count >= 4 ? 'broad' : 'narrow';
    titleKey = `${base}.title.${variant}`;
    options = { count, types };
    metric = `${formatNumber(count)}/5`;
  } else if (insight.id === 'crypto') {
    const percent = s.byType.find(({ type }) => type === 'Crypto')?.pct ?? 0;
    options = { percent: formatPct(percent) };
    metric = formatPct(percent);
  } else if (insight.id === 'cash') {
    const percent = s.byType.find(({ type }) => type === 'Cash')?.pct ?? 0;
    const variant = percent < 2 ? 'thin' : percent > 30 ? 'large' : 'inRange';
    titleKey = `${base}.title.${variant}`;
    options = { percent: formatPct(percent) };
    metric = formatPct(percent);
  } else if (insight.id === 'losers') {
    const losers = s.sorted.filter((holding) => holding.gain < 0);
    const worst = [...losers].sort((a, b) => a.gainPct - b.gainPct)[0];
    options = { count: losers.length, total: formatNumber(losers.length), symbol: worst?.symbol ?? '', percent: formatSignedPct(worst?.gainPct ?? 0) };
    metric = formatSignedPct(worst?.gainPct ?? 0);
  } else if (insight.id === 'sources') {
    const sources = new Set(s.sorted.map((holding) => holding.source.trim()).filter(Boolean));
    options = { count: s.count, sources: formatNumber(sources.size) };
    metric = formatNumber(sources.size);
  }
  return { title: String(t(titleKey, options)), detail: String(t(detailKey, options)), metric };
}

export default function Insights() {
  const { t } = useTranslation('legacy');
  const { holdings } = usePortfolio();
  const s = useMemo(() => summarize(holdings), [holdings]);
  const insights = useMemo(() => buildInsights(s), [s]);
  const score = healthScore(s);
  const translate: Translate = (key, options) => String(t(key, options ?? {}));

  return (
    <>
      <PageHeader kicker={t('insights.kicker')} title={t('insights.title')}>
        {t('insights.description')}
      </PageHeader>

      {!s.count ? (
        <div className="rise rounded-2xl border border-dashed border-input bg-card p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-accent" />
          <h2 className="text-xl font-bold">{t('insights.emptyTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('insights.emptyDescription')}</p>
          <Button asChild className="mt-5"><Link href="/import" data-testid="link-insights-import">{t('insights.addHoldings')}</Link></Button>
        </div>
      ) : (
        <>
          <section className="rise grid gap-4 lg:grid-cols-[1fr_1.3fr]">
            <div className="relative overflow-hidden rounded-2xl bg-sidebar p-8 text-sidebar-foreground">
              <div className="contour absolute inset-0" />
              <div className="relative">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/55">{t('insights.score')}</div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="num text-7xl font-semibold" data-testid="text-score">{score}</span>
                  <span className="mb-3 text-sidebar-foreground/50">{t('insights.outOf100')}</span>
                </div>
                <div className="mt-1 text-lg font-semibold text-sidebar-primary">{t(scoreLabel(score))}</div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-sidebar-accent">
                  <div className="h-full origin-left rounded-full bg-sidebar-primary transition-transform duration-1000" style={{ transform: `scaleX(${score / 100})` }} />
                </div>
                <p className="mt-5 text-xs leading-relaxed text-sidebar-foreground/60">
                  {t('insights.scoreExplanation')}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-card-border bg-card p-6">
              <h2 className="mb-4 font-bold">{t('insights.whereValueSits')}</h2>
              <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
                <AllocationDonut s={s} size={210} />
                <div>
                  <AllocationLegend s={s} />
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-3 md:grid-cols-2">
            {insights.map((i, idx) => {
              const T = TONE[i.tone];
              const presented = presentInsight(i, s, translate);
              return (
                <article key={i.id} className="rise group rounded-2xl border border-card-border bg-card p-5 transition-transform hover:-translate-y-0.5" style={{ animationDelay: `${80 + idx * 50}ms` }} data-testid={`card-insight-${i.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white', T.cls)}><T.Icon className="h-3.5 w-3.5" /></span>
                       <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t(`insights.tones.${i.tone}`)}</span>
                    </div>
                     <span className="num text-2xl font-semibold">{presented.metric}</span>
                  </div>
                   <h3 className="mt-3 font-bold">{presented.title}</h3>
                   <p className="mt-1 text-sm text-muted-foreground">{presented.detail}</p>
                </article>
              );
            })}
          </section>

          <section className="rise mt-4 rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 font-bold">{t('insights.gainByType')}</h2>
            <div className="divide-y divide-border">
              {s.byType.map((item) => (
                <div key={item.type} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{t(typeMessage(item.type))} <span className="text-muted-foreground">· {formatPct(item.pct)}</span></span>
                  <Gain v={item.gain} />
                </div>
              ))}
            </div>
          </section>
          <p className="mt-6 text-xs text-muted-foreground">{t('insights.footer')}</p>
        </>
      )}
    </>
  );
}
