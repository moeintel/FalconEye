import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Layers, Radar, Lock, Database, PenLine } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Logo } from '@/components/shell';
import { store, usePortfolio } from '@/lib/portfolio';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

const SCATTER = [
  'left-[4%] top-[8%]',
  'right-[6%] top-[18%]',
  'left-[10%] bottom-[12%]',
  'right-[10%] bottom-[6%]',
];

export default function Onboarding() {
  const { t, i18n } = useTranslation('legacy');
  const rtl = i18n.resolvedLanguage?.startsWith('ar');
  const [, navigate] = useLocation();
  const { holdings } = usePortfolio();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<null | 'demo' | 'empty'>(null);
  const go = (m: 'demo' | 'empty') => {
    if (m === 'demo') { store.loadDemo(); toast({ title: t('onboarding.toast.demoTitle'), description: t('onboarding.toast.demoDescription') }); navigate('/'); }
    else { store.startEmpty(); toast({ title: t('onboarding.toast.emptyTitle'), description: t('onboarding.toast.emptyDescription') }); navigate('/import'); }
  };
  const choose = (m: 'demo' | 'empty') => (holdings.length ? setConfirm(m) : go(m));

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
      <div className="rise">
        <div className="mb-6 flex items-center gap-3"><Logo className="h-11 w-11 text-foreground" /><span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('onboarding.welcome')}</span></div>
        <h1 className="text-4xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">{t('onboarding.title')}<br /><span className="text-muted-foreground">{t('onboarding.titleAccent')}</span></h1>
        <p className="mt-5 max-w-lg text-lg text-muted-foreground">{t('onboarding.description')}</p>
        <ul className="mt-8 space-y-4">
          {[
            [Layers, 0],
            [Radar, 1],
            [Lock, 2],
          ].map(([I, key], i) => {
            const Icon = I as typeof Layers;
            return (
              <li key={key as number} className="rise flex gap-4" style={{ animationDelay: `${150 + i * 90}ms` }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Icon className="h-4 w-4" /></span>
                <div><div className="font-bold">{t(`onboarding.benefits.${key as number}.title`)}</div><div className="text-sm text-muted-foreground">{t(`onboarding.benefits.${key as number}.detail`)}</div></div>
              </li>
            );
          })}
        </ul>
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <button onClick={() => choose('demo')} className="group flex items-center justify-between rounded-2xl bg-primary p-5 text-left text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[.98]" data-testid="button-start-demo">
            <span><Database className="mb-2 h-5 w-5 text-accent" /><span className="block font-bold">{t('onboarding.demo.label')}</span><span className="text-sm opacity-70">{t('onboarding.demo.detail')}</span></span>
            <ArrowRight className={`h-5 w-5 transition-transform group-hover:translate-x-1 ${rtl ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
          </button>
          <button onClick={() => choose('empty')} className="group flex items-center justify-between rounded-2xl border border-input bg-card p-5 text-left transition-transform hover:-translate-y-0.5 active:scale-[.98]" data-testid="button-start-empty">
            <span><PenLine className="mb-2 h-5 w-5 text-primary" /><span className="block font-bold">{t('onboarding.empty.label')}</span><span className="text-sm text-muted-foreground">{t('onboarding.empty.detail')}</span></span>
            <ArrowRight className={`h-5 w-5 transition-transform group-hover:translate-x-1 ${rtl ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
          </button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{t('onboarding.disclaimer')}</p>
      </div>

      <div className="rise relative hidden aspect-square overflow-hidden rounded-[2rem] bg-sidebar lg:block" style={{ animationDelay: '200ms' }}>
        <div className="contour absolute inset-0" />
        <div className="absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sidebar-primary/20" />
        <div className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sidebar-primary/30" />
        <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sidebar-accent">
          <Logo className="h-14 w-14 text-sidebar-foreground" />
        </div>
        {SCATTER.map((pos, i) => (
          <div key={i} className={`rise absolute ${pos} rounded-xl border border-sidebar-border bg-sidebar-accent/90 px-4 py-3 text-sidebar-foreground`} style={{ animationDelay: `${400 + i * 120}ms` }}>
            <div className="font-mono text-[10px] uppercase tracking-wider text-sidebar-primary">{t(`onboarding.sources.${i}.title`)}</div>
            <div className="text-sm">{t(`onboarding.sources.${i}.detail`)}</div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('onboarding.confirm.replace', { count: holdings.length })}</AlertDialogTitle>
            <AlertDialogDescription>{confirm === 'demo' ? t('onboarding.confirm.demoDescription') : t('onboarding.confirm.emptyDescription')} {t('onboarding.confirm.cannotUndo')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('onboarding.confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm) go(confirm); setConfirm(null); }} data-testid="button-confirm-onboarding">{t('onboarding.confirm.continue')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
