import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, CheckCircle2, Layers, PieChart, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/shell';
import { postInterest, recordVisitOnce, sanitizeChannel } from '@/lib/outreach';

export default function Welcome() {
  const channel = useMemo(() => sanitizeChannel(new URLSearchParams(window.location.search).get('channel')), []);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');

  useEffect(() => { recordVisitOnce(channel); }, [channel]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setErr('Please enter a valid email address.'); setState('error'); return; }
    if (!consent) { setErr('Please tick the consent box so we may email you.'); setState('error'); return; }
    setState('sending'); setErr('');
    try { await postInterest(email.trim(), channel); setState('done'); }
    catch { setErr('We could not save your interest just now. Please try again in a moment.'); setState('error'); }
  };

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-sidebar px-6 py-14 text-sidebar-foreground md:px-14 md:py-20">
        <div className="contour absolute inset-0" />
        <div className="relative grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="rise">
            <div className="mb-6 flex items-center gap-3"><Logo className="h-10 w-10" /><span className="font-mono text-[11px] uppercase tracking-[0.2em] text-sidebar-primary">Everyday finances, made clearer</span></div>
            <h1 className="text-4xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">Your money, wherever it is. <span className="text-sidebar-primary">One clear picture.</span></h1>
            <p className="mt-6 max-w-xl text-lg text-sidebar-foreground/75">Gold you bought. Shares from an IPO. Money invested with family. Bring what you own and owe into one simple overview, without needing financial expertise. Start with what you know—no bank connection required.</p>
          </div>
          <div className="rise rounded-2xl bg-card p-6 text-card-foreground md:p-8" style={{ animationDelay: '120ms' }}>
            {state === 'done' ? (
              <div className="py-6 text-center" data-testid="status-interest-done">
                <CheckCircle2 className="mx-auto h-10 w-10 text-[hsl(176_42%_38%)]" />
                <h2 className="mt-3 text-xl font-bold">You're on the list.</h2>
                <p className="mt-1 text-sm text-muted-foreground">We'll email {email.trim()} when Falcon Eye opens to early users. No account was created.</p>
                <Button asChild variant="outline" className="mt-5"><Link href="/" data-testid="link-try-demo-done">Try the prototype now</Link></Button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-4">
                <h2 className="text-xl font-bold">Get early access</h2>
                <p className="text-sm text-muted-foreground">Register interest. This is not an account signup.</p>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" data-testid="input-interest-email" />
                <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" data-testid="checkbox-consent" />
                  <span>I agree that the Falcon Eye student team may store my email and contact me about this project. I can ask to be removed at any time.</span>
                </label>
                {state === 'error' && <p className="flex items-center gap-1.5 text-sm text-destructive" data-testid="text-interest-error"><AlertTriangle className="h-4 w-4" />{err}</p>}
                <Button type="submit" className="w-full" disabled={state === 'sending'} data-testid="button-submit-interest">
                  {state === 'sending' ? 'Saving...' : <>Notify me <ArrowRight className="ml-1 h-4 w-4" /></>}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_1.2fr_1fr]">
        {[
          [Layers, 'Everything you own and owe', 'Record savings, gold, stocks, private investments, and debts using simple, relevant questions.'],
          [PieChart, 'Understand the whole picture', 'See recorded assets, outstanding debts, and estimated net worth. Missing values stay visible—not quietly counted as zero.'],
          [ShieldCheck, 'You stay in control', 'No broker logins or trading. Browser records stay local unless you explicitly save to a configured private account.'],
        ].map(([I, t, d], i) => {
          const Icon = I as typeof Layers;
          return (
            <div key={t as string} className="rise rounded-2xl border border-card-border bg-card p-6" style={{ animationDelay: `${200 + i * 80}ms` }}>
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-bold">{t as string}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d as string}</p>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-input p-8 md:flex-row md:items-center">
        <div><h2 className="text-xl font-bold">Start with a clearer view.</h2><p className="text-sm text-muted-foreground">Explore the prototype, or begin your own records. Values are manually entered or illustrative, not live quotes. Not financial advice.</p></div>
        <Button asChild><Link href="/" data-testid="link-open-prototype">Open the dashboard <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
      </section>
    </div>
  );
}
