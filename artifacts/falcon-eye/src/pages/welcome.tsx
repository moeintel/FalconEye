import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, CheckCircle2, Layers, PieChart, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/shell';
import { postInterest, recordVisitOnce, sanitizeChannel } from '@/lib/outreach';
import { useTranslation } from 'react-i18next';

export default function Welcome() {
  const { t } = useTranslation('public');
  const channel = useMemo(() => sanitizeChannel(new URLSearchParams(window.location.search).get('channel')), []);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<'invalidEmail' | 'consentRequired' | 'saveFailed' | null>(null);

  useEffect(() => { recordVisitOnce(channel); }, [channel]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError('invalidEmail'); setState('error'); return; }
    if (!consent) { setError('consentRequired'); setState('error'); return; }
    setState('sending'); setError(null);
    try { await postInterest(email.trim(), channel); setState('done'); }
    catch { setError('saveFailed'); setState('error'); }
  };

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-sidebar px-6 py-14 text-sidebar-foreground md:px-14 md:py-20">
        <div className="contour absolute inset-0" />
        <div className="relative grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="rise">
            <div className="mb-6 flex items-center gap-3"><Logo className="h-10 w-10" /><span className="font-mono text-[11px] uppercase tracking-[0.2em] text-sidebar-primary">{t('hero.eyebrow')}</span></div>
            <h1 className="text-4xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">{t('hero.title')} <span className="text-sidebar-primary">{t('hero.titleAccent')}</span></h1>
            <p className="mt-6 max-w-xl text-lg text-sidebar-foreground/75">{t('hero.description')}</p>
          </div>
          <div className="rise rounded-2xl bg-card p-6 text-card-foreground md:p-8" style={{ animationDelay: '120ms' }}>
            {state === 'done' ? (
              <div className="py-6 text-center" data-testid="status-interest-done">
                <CheckCircle2 className="mx-auto h-10 w-10 text-[hsl(176_42%_38%)]" />
                <h2 className="mt-3 text-xl font-bold">{t('registration.success.title')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('registration.success.description', { email: email.trim() })}</p>
                <Button asChild variant="outline" className="mt-5"><Link href="/" data-testid="link-try-demo-done">{t('registration.success.tryPrototype')}</Link></Button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-4">
                <h2 className="text-xl font-bold">{t('registration.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('registration.description')}</p>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('registration.emailPlaceholder')} aria-label={t('registration.emailLabel')} data-testid="input-interest-email" dir="ltr" />
                <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" data-testid="checkbox-consent" />
                  <span>{t('registration.consent')}</span>
                </label>
                {state === 'error' && error && <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert" data-testid="text-interest-error"><AlertTriangle className="h-4 w-4" />{t(`registration.errors.${error}`)}</p>}
                <Button type="submit" className="w-full" disabled={state === 'sending'} data-testid="button-submit-interest">
                  {state === 'sending' ? t('registration.saving') : <>{t('registration.submit')} <ArrowRight className="legacy-direction-arrow ms-1 h-4 w-4" /></>}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_1.2fr_1fr]">
        {[
          [Layers, t('features.records.title'), t('features.records.description')],
          [PieChart, t('features.overview.title'), t('features.overview.description')],
          [ShieldCheck, t('features.control.title'), t('features.control.description')],
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
        <div><h2 className="text-xl font-bold">{t('closing.title')}</h2><p className="text-sm text-muted-foreground">{t('closing.description')}</p></div>
        <Button asChild><Link href="/" data-testid="link-open-prototype">{t('closing.openDashboard')} <ArrowRight className="legacy-direction-arrow ms-1 h-4 w-4" /></Link></Button>
      </section>
    </div>
  );
}
