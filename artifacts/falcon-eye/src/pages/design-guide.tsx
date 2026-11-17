import { ArrowDown, ArrowRight, Check, Coins, Eye, Fingerprint, HandCoins, HeartHandshake, Home, Layers3, MessageCircle, MousePointer2, ShieldCheck, Smartphone, Sparkles, Wallet } from 'lucide-react';
import { FalcMascot } from '@/components/falc-mascot';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';

const principles = [
  { icon: Eye },
  { icon: MousePointer2 },
  { icon: ShieldCheck },
];
const navigation = [
  { icon: Home },
  { icon: Wallet },
  { icon: HandCoins },
  { icon: Layers3 },
];
const steps = [
  '01',
  '02',
  '03',
  '04',
];
export default function DesignGuide() {
  const { t } = useTranslation('design');
  return <div className="blueprint mx-auto max-w-5xl" data-testid="ui-improvement-infographic">
    <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-sm underline">{t('actions.back')}</Link><button className="finance-button secondary" onClick={() => window.print()}>{t('actions.print')}</button></div>
    <header className="blueprint-hero">
      <div className="flex items-start justify-between gap-4"><div><p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-amber-200">{t('hero.kicker')}</p><h1 className="text-4xl font-extrabold leading-tight md:text-6xl">{t('hero.title')}<br />{t('hero.titleAccent')}</h1><p className="mt-5 max-w-lg text-base leading-relaxed text-white/80">{t('hero.description')}</p></div><FalcMascot className="hidden h-36 w-36 shrink-0 md:block" /></div>
      <p className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs"><HeartHandshake size={15} />{t('hero.promise')}</p>
    </header>
    <section className="my-6 grid gap-4 md:grid-cols-3">{principles.map(({ icon: Icon }, i) => <article className="rounded-2xl border bg-card p-5" key={i}><Icon className="mb-4 text-teal-800" size={26} /><h2 className="mb-2 font-bold">{t(`principles.${i}.title`)}</h2><p className="text-sm leading-relaxed text-muted-foreground">{t(`principles.${i}.detail`)}</p></article>)}</section>
    <section className="blueprint-section">
      <p className="blueprint-kicker">{t('sections.navigation.kicker')}</p><h2 className="mb-5 text-2xl font-bold">{t('sections.navigation.title')}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{navigation.map(({ icon: Icon }, i) => <div className="rounded-xl bg-[#EDF3EE] p-4" key={i}><Icon className="mb-3 text-teal-800" size={24} /><h3 className="font-semibold">{t(`navigation.${i}.title`)}</h3><p className="mt-1 text-xs text-muted-foreground">{t(`navigation.${i}.note`)}</p></div>)}</div>
      <p className="mt-4 text-sm text-muted-foreground">{t('sections.navigation.note')}</p>
    </section>
    <section className="blueprint-section">
      <p className="blueprint-kicker">{t('sections.steps.kicker')}</p><h2 className="mb-5 text-2xl font-bold">{t('sections.steps.title')}</h2>
      <div className="grid gap-3 md:grid-cols-4">{steps.map((number, i) => <div className="relative rounded-xl border p-4" key={number}><span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-950">{number}</span><h3 className="mb-2 font-bold">{t(`steps.${i}.title`)}</h3><p className="text-sm leading-relaxed text-muted-foreground">{t(`steps.${i}.detail`)}</p>{i < 3 && <ArrowRight className="absolute -right-4 top-8 z-10 hidden rounded-full bg-card text-teal-800 md:block" size={22} />}</div>)}</div>
    </section>
    <section className="blueprint-section overflow-hidden">
      <p className="blueprint-kicker">{t('sections.falc.kicker')}</p>
      <div className="grid items-center gap-6 md:grid-cols-[1fr_1.1fr]"><div className="flex items-start gap-4"><FalcMascot className="h-24 w-24 shrink-0" /><div><h2 className="mb-2 text-2xl font-bold">{t('sections.falc.title')}</h2><p className="text-sm leading-relaxed text-muted-foreground">{t('sections.falc.description')}</p></div></div><div className="space-y-3 rounded-2xl bg-[#EDF3EE] p-5"><p className="ml-5 rounded-xl bg-white p-3 text-sm">{t('sections.falc.exampleUser')}</p><p className="mr-5 rounded-xl bg-[#173D46] p-3 text-sm text-white">{t('sections.falc.exampleAssistant')}</p><div className="flex items-center justify-center gap-3 text-xs font-semibold text-teal-900"><MessageCircle size={15} />{t('sections.falc.talk')} <ArrowRight size={14} />{t('sections.falc.review')} <ArrowRight size={14} /><Check size={15} />{t('sections.falc.confirm')}</div></div></div>
      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">{t('sections.falc.disclaimer')}</p>
    </section>
    <section className="blueprint-section">
      <p className="blueprint-kicker">{t('sections.assets.kicker')}</p><h2 className="mb-5 text-2xl font-bold">{t('sections.assets.title')}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {[Coins, HeartHandshake, HandCoins].map((Icon, i) => <article className="rounded-xl border p-4" key={i}><Icon size={24} className="mb-3 text-teal-800" /><h3 className="mb-2 font-bold">{t(`sections.assets.items.${i}.title`)}</h3><p className="text-sm leading-relaxed text-muted-foreground">{t(`sections.assets.items.${i}.text`)}</p></article>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{Array.from({ length: 8 }, (_, i) => <span className="rounded-full bg-secondary px-3 py-2 text-xs" key={i}>{t(`sections.assets.types.${i}`)}</span>)}</div>
    </section>
    <section className="blueprint-section">
      <p className="blueprint-kicker">{t('sections.accessibility.kicker')}</p><div className="grid gap-5 md:grid-cols-2"><div><h2 className="mb-4 text-2xl font-bold">{t('sections.accessibility.title')}</h2><ul className="space-y-3 text-sm">{Array.from({ length: 6 }, (_, i) => <li className="flex items-start gap-2" key={i}><Check size={16} className="mt-0.5 shrink-0 text-teal-700" />{t(`sections.accessibility.items.${i}`)}</li>)}</ul></div><div className="rounded-2xl bg-[#173D46] p-6 text-white"><Smartphone size={32} className="mb-4 text-amber-200" /><h3 className="text-xl font-bold">{t('sections.accessibility.plainLanguage')}</h3><div className="mt-4 space-y-3 text-sm"><p><span className="text-white/50 line-through">{t('sections.accessibility.jargon.cost')}</span><br />{t('sections.accessibility.plain.cost')}</p><p><span className="text-white/50 line-through">{t('sections.accessibility.jargon.liquidity')}</span><br />{t('sections.accessibility.plain.liquidity')}</p><p><span className="text-white/50 line-through">{t('sections.accessibility.jargon.score')}</span><br />{t('sections.accessibility.plain.score')}</p></div></div></div>
    </section>
    <section className="blueprint-section">
      <p className="blueprint-kicker">{t('sections.rollout.kicker')}</p><h2 className="mb-5 text-2xl font-bold">{t('sections.rollout.title')}</h2>
      <div className="grid gap-3 md:grid-cols-3">{[Eye, Fingerprint, Sparkles].map((Icon, i) => <article className="rounded-xl border p-4" key={i}><Icon className="mb-3 text-teal-800" size={23} /><h3 className="mb-2 font-bold">{t(`sections.rollout.items.${i}.title`)}</h3><p className="text-sm leading-relaxed text-muted-foreground">{t(`sections.rollout.items.${i}.text`)}</p></article>)}</div>
      <p className="mt-5 text-sm text-muted-foreground">{t('sections.rollout.disclaimer')}</p>
    </section>
    <footer className="flex items-center justify-between gap-4 border-t pt-5 text-xs text-muted-foreground"><span>{t('footer.brand')}</span><span>{t('footer.label')}</span></footer>
  </div>;
}
