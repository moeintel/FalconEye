import { useMemo } from 'react';
import { Link } from 'wouter';
import { Sparkles, ShieldCheck, Eye, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell';
import { AllocationDonut, AllocationLegend, Gain } from '@/components/allocation';
import { type Tone, buildInsights, healthScore, pct, summarize, usePortfolio } from '@/lib/portfolio';
import { cn } from '@/lib/utils';

const TONE: Record<Tone, { label: string; cls: string; Icon: typeof Eye }> = {
  good: { label: 'Healthy', cls: 'bg-[hsl(176_42%_38%)]', Icon: ShieldCheck },
  watch: { label: 'Watch', cls: 'bg-accent', Icon: Eye },
  risk: { label: 'Concentrated', cls: 'bg-[hsl(14_72%_52%)]', Icon: AlertOctagon },
};

export function ToneDot({ tone }: { tone: Tone }) {
  return <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE[tone].cls)} title={TONE[tone].label} />;
}

export function scoreLabel(n: number) {
  return n >= 75 ? 'Well spread' : n >= 50 ? 'Moderately concentrated' : 'Highly concentrated';
}

export default function Insights() {
  const { holdings } = usePortfolio();
  const s = useMemo(() => summarize(holdings), [holdings]);
  const insights = useMemo(() => buildInsights(s), [s]);
  const score = healthScore(s);

  return (
    <>
      <PageHeader kicker="Simulated AI insights · demo" title="How balanced is it, really?">
        A rules-based read of your actual holdings: concentration, mix and exposure. No model, no market data, and not financial advice.
      </PageHeader>

      {!s.count ? (
        <div className="rise rounded-2xl border border-dashed border-input bg-card p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-accent" />
          <h2 className="text-xl font-bold">Insights need holdings to look at</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add or import a few positions and the assessment appears here.</p>
          <Button asChild className="mt-5"><Link href="/import" data-testid="link-insights-import">Add holdings</Link></Button>
        </div>
      ) : (
        <>
          <section className="rise grid gap-4 lg:grid-cols-[1fr_1.3fr]">
            <div className="relative overflow-hidden rounded-2xl bg-sidebar p-8 text-sidebar-foreground">
              <div className="contour absolute inset-0" />
              <div className="relative">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/55">Diversification score</div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="num text-7xl font-semibold" data-testid="text-score">{score}</span>
                  <span className="mb-3 text-sidebar-foreground/50">/ 100</span>
                </div>
                <div className="mt-1 text-lg font-semibold text-sidebar-primary">{scoreLabel(score)}</div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-sidebar-accent">
                  <div className="h-full origin-left rounded-full bg-sidebar-primary transition-transform duration-1000" style={{ transform: `scaleX(${score / 100})` }} />
                </div>
                <p className="mt-5 text-xs leading-relaxed text-sidebar-foreground/60">
                  Starts at 100 and deducts for position concentration (Herfindahl index), a largest holding above 20%, crypto above 15%, and fewer than four asset classes.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-card-border bg-card p-6">
              <h2 className="mb-4 font-bold">Where the value sits</h2>
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
              return (
                <article key={i.id} className="rise group rounded-2xl border border-card-border bg-card p-5 transition-transform hover:-translate-y-0.5" style={{ animationDelay: `${80 + idx * 50}ms` }} data-testid={`card-insight-${i.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white', T.cls)}><T.Icon className="h-3.5 w-3.5" /></span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{T.label}</span>
                    </div>
                    <span className="num text-2xl font-semibold">{i.metric}</span>
                  </div>
                  <h3 className="mt-3 font-bold">{i.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{i.detail}</p>
                </article>
              );
            })}
          </section>

          <section className="rise mt-4 rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 font-bold">Unrealized gain by asset class</h2>
            <div className="divide-y divide-border">
              {s.byType.map((t) => (
                <div key={t.type} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{t.type} <span className="text-muted-foreground">· {pct(t.pct)}</span></span>
                  <Gain v={t.gain} />
                </div>
              ))}
            </div>
          </section>
          <p className="mt-6 text-xs text-muted-foreground">Simulated AI insights · demo. Generated by fixed rules from the quantities and prices you entered. Educational only; not investment, tax or financial advice.</p>
        </>
      )}
    </>
  );
}
