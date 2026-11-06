import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Layers, Radar, Lock, Database, PenLine } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Logo } from '@/components/shell';
import { store, usePortfolio } from '@/lib/portfolio';
import { useToast } from '@/hooks/use-toast';

const SCATTER = [
  ['Brokerage', 'AAPL · MSFT · NVDA', 'left-[4%] top-[8%]'],
  ['Crypto wallet', 'BTC · ETH', 'right-[6%] top-[18%]'],
  ['Retirement', 'VTI · FXAIX · AGG', 'left-[10%] bottom-[12%]'],
  ['Bank', 'Savings', 'right-[10%] bottom-[6%]'],
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { holdings } = usePortfolio();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<null | 'demo' | 'empty'>(null);
  const go = (m: 'demo' | 'empty') => {
    if (m === 'demo') { store.loadDemo(); toast({ title: 'Demo portfolio loaded', description: 'Sample data, illustrative prices.' }); navigate('/'); }
    else { store.startEmpty(); toast({ title: 'Fresh start', description: 'Add your first holding.' }); navigate('/import'); }
  };
  const choose = (m: 'demo' | 'empty') => (holdings.length ? setConfirm(m) : go(m));

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
      <div className="rise">
        <div className="mb-6 flex items-center gap-3"><Logo className="h-11 w-11 text-foreground" /><span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Welcome to Falcon Eye</span></div>
        <h1 className="text-4xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">Your money lives in five places.<br /><span className="text-muted-foreground">See it from one.</span></h1>
        <p className="mt-5 max-w-lg text-lg text-muted-foreground">Stocks at one broker, crypto in a wallet, funds in a retirement account. Falcon Eye pulls them into a single picture so you know what you own, how it's split, and where it's concentrated.</p>
        <ul className="mt-8 space-y-4">
          {[
            [Layers, 'Consolidate', 'Enter positions by hand or import a CSV from any account.'],
            [Radar, 'Understand', 'Totals, gains, allocation and a plain-language concentration check.'],
            [Lock, 'Stay private', 'No logins, no broker connections. Everything stays in this browser.'],
          ].map(([I, t, d], i) => {
            const Icon = I as typeof Layers;
            return (
              <li key={t as string} className="rise flex gap-4" style={{ animationDelay: `${150 + i * 90}ms` }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Icon className="h-4 w-4" /></span>
                <div><div className="font-bold">{t as string}</div><div className="text-sm text-muted-foreground">{d as string}</div></div>
              </li>
            );
          })}
        </ul>
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <button onClick={() => choose('demo')} className="group flex items-center justify-between rounded-2xl bg-primary p-5 text-left text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[.98]" data-testid="button-start-demo">
            <span><Database className="mb-2 h-5 w-5 text-accent" /><span className="block font-bold">Explore the demo</span><span className="text-sm opacity-70">11 sample holdings, 5 asset classes</span></span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
          <button onClick={() => choose('empty')} className="group flex items-center justify-between rounded-2xl border border-input bg-card p-5 text-left transition-transform hover:-translate-y-0.5 active:scale-[.98]" data-testid="button-start-empty">
            <span><PenLine className="mb-2 h-5 w-5 text-primary" /><span className="block font-bold">Start empty</span><span className="text-sm text-muted-foreground">Add your own positions</span></span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Prototype for demonstration. No real accounts, trades or live prices. Not investment advice.</p>
      </div>

      <div className="rise relative hidden aspect-square overflow-hidden rounded-[2rem] bg-sidebar lg:block" style={{ animationDelay: '200ms' }}>
        <div className="contour absolute inset-0" />
        <div className="absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sidebar-primary/20" />
        <div className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sidebar-primary/30" />
        <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sidebar-accent">
          <Logo className="h-14 w-14 text-sidebar-foreground" />
        </div>
        {SCATTER.map(([t, d, pos], i) => (
          <div key={t} className={`rise absolute ${pos} rounded-xl border border-sidebar-border bg-sidebar-accent/90 px-4 py-3 text-sidebar-foreground`} style={{ animationDelay: `${400 + i * 120}ms` }}>
            <div className="font-mono text-[10px] uppercase tracking-wider text-sidebar-primary">{t}</div>
            <div className="text-sm">{d}</div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your current {holdings.length} holdings?</AlertDialogTitle>
            <AlertDialogDescription>{confirm === 'demo' ? 'They will be replaced by the sample portfolio.' : 'They will be cleared so you can start fresh.'} This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm) go(confirm); setConfirm(null); }} data-testid="button-confirm-onboarding">Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
