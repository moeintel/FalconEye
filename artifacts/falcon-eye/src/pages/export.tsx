import { useMemo } from 'react';
import { FileSpreadsheet, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, Logo } from '@/components/shell';
import { buildInsights, download, healthScore, money, pct, qty, summarize, toCsv, usePortfolio } from '@/lib/portfolio';
import { scoreLabel } from '@/pages/insights';
import { useToast } from '@/hooks/use-toast';

export default function ExportPage() {
  const { holdings, isDemo } = usePortfolio();
  const s = useMemo(() => summarize(holdings), [holdings]);
  const insights = useMemo(() => buildInsights(s), [s]);
  const { toast } = useToast();
  const stamp = new Date().toISOString().slice(0, 10);
  const empty = !holdings.length;

  return (
    <>
      <div className="no-print">
        <PageHeader kicker="Export" title="Take it with you.">
          Download your holdings as a spreadsheet-safe CSV, or print the report below (choose "Save as PDF" in the print dialog for a file).
        </PageHeader>
        <div className="rise mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <h2 className="mt-3 font-bold">Holdings CSV</h2>
            <p className="mt-1 text-sm text-muted-foreground">Same schema as import, plus market value, cost basis and gain. Re-importable.</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Values are quoted and escaped; cells starting with = + - @ are neutralised against spreadsheet formula injection.</p>
            <Button className="mt-4" disabled={empty} data-testid="button-export-csv" onClick={() => { download(`falcon-eye-holdings-${stamp}.csv`, toCsv(holdings, true)); toast({ title: 'CSV downloaded', description: `${holdings.length} holdings exported.` }); }}>Download CSV</Button>
          </div>
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <Printer className="h-6 w-6 text-primary" />
            <h2 className="mt-3 font-bold">Print report</h2>
            <p className="mt-1 text-sm text-muted-foreground">Totals, allocation, every holding and the insight summary on clean paper. Navigation and banners are hidden when printing.</p>
            <Button className="mt-4" variant="outline" disabled={empty} onClick={() => window.print()} data-testid="button-print">Print or save as PDF</Button>
          </div>
        </div>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Report preview</div>
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-input bg-card p-10 text-center text-muted-foreground">No holdings to report. Add or import some first.</div>
      ) : (
        <article className="rounded-2xl border border-card-border bg-card p-8 text-[13px] print:border-0 print:p-0 md:p-12" data-testid="report">
          <header className="flex items-start justify-between border-b-2 border-foreground pb-5">
            <div className="flex items-center gap-3">
              <Logo className="h-10 w-10 text-foreground" />
              <div>
                <div className="text-2xl font-extrabold tracking-tight">Falcon Eye portfolio report</div>
                <div className="text-muted-foreground">Generated {new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</div>
              </div>
            </div>
            <div className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Prototype<br />{isDemo ? 'Sample data' : 'User-entered data'}</div>
          </header>

          <section className="grid grid-cols-2 gap-4 border-b border-border py-6 md:grid-cols-4">
            {[['Total value', money(s.total)], ['Cost basis', money(s.cost)], ['Unrealized gain', `${s.gain >= 0 ? '+' : '-'}${money(Math.abs(s.gain))} (${s.gainPct.toFixed(2)}%)`], ['Diversification', `${healthScore(s)}/100 · ${scoreLabel(healthScore(s))}`]].map(([k, v]) => (
              <div key={k}><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div><div className="num mt-1 text-base font-semibold">{v}</div></div>
            ))}
          </section>

          <section className="border-b border-border py-6">
            <h3 className="mb-3 font-bold uppercase tracking-wider">Allocation</h3>
            <table className="w-full">
              <tbody>
                {s.byType.map((t) => (
                  <tr key={t.type} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5">{t.type}</td>
                    <td className="py-1.5 text-muted-foreground">{t.count} holding{t.count > 1 ? 's' : ''}</td>
                    <td className="num py-1.5 text-right">{money(t.value)}</td>
                    <td className="num w-20 py-1.5 text-right">{pct(t.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="border-b border-border py-6">
            <h3 className="mb-3 font-bold uppercase tracking-wider">Holdings</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground"><th className="py-1.5">Symbol</th><th>Name</th><th>Type</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Value</th><th className="text-right">Gain</th><th className="text-right">Weight</th></tr></thead>
                <tbody>
                  {s.sorted.map((h) => (
                    <tr key={h.id} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 font-mono font-semibold">{h.symbol}</td><td>{h.name}</td><td>{h.assetType}</td>
                      <td className="num text-right">{qty(h.quantity)}</td><td className="num text-right">{money(h.currentPrice)}</td><td className="num text-right">{money(h.value)}</td>
                      <td className="num text-right">{h.gain >= 0 ? '+' : '-'}{money(Math.abs(h.gain))}</td><td className="num text-right">{pct(h.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="py-6">
            <h3 className="mb-3 font-bold uppercase tracking-wider">Insights <span className="font-mono text-[10px] font-normal normal-case text-muted-foreground">Simulated AI insights · demo</span></h3>
            <ul className="space-y-2">
              {insights.map((i) => <li key={i.id}><b>{i.title}.</b> {i.detail}</li>)}
            </ul>
          </section>
          <footer className="border-t border-border pt-4 text-[11px] text-muted-foreground">
            Prototype report. Prices are {isDemo ? 'illustrative sample values' : 'values entered by the user'} and are not live market data. Data is stored only in the browser's local storage. Nothing in this report is investment, tax or financial advice.
          </footer>
        </article>
      )}
    </>
  );
}
