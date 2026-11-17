import { ArrowDown, ArrowRight, Check, Coins, Eye, Fingerprint, HandCoins, HeartHandshake, Home, Layers3, MessageCircle, MousePointer2, ShieldCheck, Smartphone, Sparkles, Wallet } from 'lucide-react';
import { FalcMascot } from '@/components/falc-mascot';
import { Link } from 'wouter';

const principles = [
  { icon: Eye, title: 'Understand at a glance', detail: 'What you own. What you owe. What you can access. Clear totals, with missing information called out.' },
  { icon: MousePointer2, title: 'One obvious next step', detail: 'Add an asset or debt, or ask Falc. Relevant questions only—no finance vocabulary test.' },
  { icon: ShieldCheck, title: 'Trust before automation', detail: 'Dated values. Estimates labelled. Samples kept separate. Review every assistant draft before saving.' },
];
const navigation = [
  { icon: Home, title: 'Overview', note: 'My financial picture' },
  { icon: Wallet, title: 'My assets', note: 'Everything I own' },
  { icon: HandCoins, title: 'My debts', note: 'What I still owe' },
  { icon: Layers3, title: 'Activity', note: 'Changes and payments' },
];
const steps = [
  ['01', 'Tell us what it is', 'Gold, cash, stocks, an IPO, a private investment, or a debt.'],
  ['02', 'Add what you know', 'Skip unknown values. Record currency, source, and date.'],
  ['03', 'Review the meaning', 'Ownership, a loan, or a gift? Available money or restricted?'],
  ['04', 'See one clear picture', 'Understand your recorded position without mistaking estimates for cash.'],
];
export default function DesignGuide() {
  return <div className="blueprint mx-auto max-w-5xl" data-testid="ui-improvement-infographic">
    <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-sm underline">Back to my overview</Link><button className="finance-button secondary" onClick={() => window.print()}>Print / save as PDF</button></div>
    <header className="blueprint-hero">
      <div className="flex items-start justify-between gap-4"><div><p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-amber-200">FalconEye · experience blueprint</p><h1 className="text-4xl font-extrabold leading-tight md:text-6xl">Your money.<br />One clear picture.</h1><p className="mt-5 max-w-lg text-base leading-relaxed text-white/80">A friendlier financial home for everyday people—from physical gold to money invested with family.</p></div><FalcMascot className="hidden h-36 w-36 shrink-0 md:block" /></div>
      <p className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs"><HeartHandshake size={15} />Built for confidence, not financial expertise.</p>
    </header>
    <section className="my-6 grid gap-4 md:grid-cols-3">{principles.map(({ icon: Icon, title, detail }) => <article className="rounded-2xl border bg-card p-5" key={title}><Icon className="mb-4 text-teal-800" size={26} /><h2 className="mb-2 font-bold">{title}</h2><p className="text-sm leading-relaxed text-muted-foreground">{detail}</p></article>)}</section>
    <section className="blueprint-section">
      <p className="blueprint-kicker">01 · Easy to find your way</p><h2 className="mb-5 text-2xl font-bold">Every destination has a clear job.</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{navigation.map(({ icon: Icon, title, note }) => <div className="rounded-xl bg-[#EDF3EE] p-4" key={title}><Icon className="mb-3 text-teal-800" size={24} /><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>)}</div>
      <p className="mt-4 text-sm text-muted-foreground">Reports and settings stay easy to reach. Team outreach stays separate from personal finances. On mobile, primary actions stay within reach.</p>
    </section>
    <section className="blueprint-section">
      <p className="blueprint-kicker">02 · Add something without getting lost</p><h2 className="mb-5 text-2xl font-bold">A short, guided path—not a spreadsheet.</h2>
      <div className="grid gap-3 md:grid-cols-4">{steps.map(([number, title, detail], i) => <div className="relative rounded-xl border p-4" key={number}><span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-950">{number}</span><h3 className="mb-2 font-bold">{title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{detail}</p>{i < 3 && <ArrowRight className="absolute -right-4 top-8 z-10 hidden rounded-full bg-card text-teal-800 md:block" size={22} />}</div>)}</div>
    </section>
    <section className="blueprint-section overflow-hidden">
      <p className="blueprint-kicker">03 · A helper, not another menu</p>
      <div className="grid items-center gap-6 md:grid-cols-[1fr_1.1fr]"><div className="flex items-start gap-4"><FalcMascot className="h-24 w-24 shrink-0" /><div><h2 className="mb-2 text-2xl font-bold">Meet Falc.</h2><p className="text-sm leading-relaxed text-muted-foreground">Type naturally. Dictate if your browser supports it. Falc prepares the details; you stay in control.</p></div></div><div className="space-y-3 rounded-2xl bg-[#EDF3EE] p-5"><p className="ml-5 rounded-xl bg-white p-3 text-sm">“I bought 20g of 22k gold for AED 5,000.”</p><p className="mr-5 rounded-xl bg-[#173D46] p-3 text-sm text-white">“I’ve started a draft. What is its current value—or should we leave it unknown?”</p><div className="flex items-center justify-center gap-3 text-xs font-semibold text-teal-900"><MessageCircle size={15} />Talk <ArrowRight size={14} />Review <ArrowRight size={14} /><Check size={15} />Confirm</div></div></div>
      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Local guided mode works without an AI provider. Optional AI mode requires configuration and consent to share the conversation. Falc never trades, connects a wallet, or silently saves.</p>
    </section>
    <section className="blueprint-section">
      <p className="blueprint-kicker">04 · Design the meaning, not just the numbers</p><h2 className="mb-5 text-2xl font-bold">Different assets need different questions.</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {[{ icon: Coins, title: 'Physical gold', text: 'Weight + purity + purchase cost. Estimated resale value, not the original jewellery bill.' }, { icon: HeartHandshake, title: 'Family investments', text: 'Ownership, loan, or gift. Record the arrangement before interpreting the amount.' }, { icon: HandCoins, title: 'Money owed', text: 'Outstanding balance + repayment history. Never confuse borrowed money with wealth.' }].map(({ icon: Icon, title, text }) => <article className="rounded-xl border p-4" key={title}><Icon size={24} className="mb-3 text-teal-800" /><h3 className="mb-2 font-bold">{title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{text}</p></article>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{['Cash', 'Stocks', 'Funds', 'Crypto', 'IPOs', 'Money lent', 'Bonds / sukuk', 'Property'].map((label) => <span className="rounded-full bg-secondary px-3 py-2 text-xs" key={label}>{label}</span>)}</div>
    </section>
    <section className="blueprint-section">
      <p className="blueprint-kicker">05 · Comfortable on every screen</p><div className="grid gap-5 md:grid-cols-2"><div><h2 className="mb-4 text-2xl font-bold">Small details make it easier.</h2><ul className="space-y-3 text-sm">{['Readable text and generous tap targets.', 'Labels beside icons, not mystery buttons.', 'Search and filter before endless scrolling.', 'Clear errors next to the action that failed.', 'Keyboard focus, contrast, and reduced motion.', 'Confirmation for replacing or deleting records.'].map((text) => <li className="flex items-start gap-2" key={text}><Check size={16} className="mt-0.5 shrink-0 text-teal-700" />{text}</li>)}</ul></div><div className="rounded-2xl bg-[#173D46] p-6 text-white"><Smartphone size={32} className="mb-4 text-amber-200" /><h3 className="text-xl font-bold">Plain language first.</h3><div className="mt-4 space-y-3 text-sm"><p><span className="text-white/50 line-through">Cost basis</span><br />What you paid</p><p><span className="text-white/50 line-through">Liquidity</span><br />How quickly you can access it</p><p><span className="text-white/50 line-through">Portfolio health score</span><br />What needs your attention</p></div></div></div>
    </section>
    <section className="blueprint-section">
      <p className="blueprint-kicker">06 · Safe rollout</p><h2 className="mb-5 text-2xl font-bold">Trust is a release requirement.</h2>
      <div className="grid gap-3 md:grid-cols-3">{[{ icon: Eye, title: 'Build & check', text: 'Working guided entry, honest summaries, local history, and exports. Existing data preserved.' }, { icon: Fingerprint, title: 'Configure & verify', text: 'Supabase accounts, reviewed migration, private access tests, backup and restore. Required before cloud launch.' }, { icon: Sparkles, title: 'Learn & expand', text: 'Invited user testing first. Then household permissions, documents, Arabic, and selected price feeds.' }].map(({ icon: Icon, title, text }) => <article className="rounded-xl border p-4" key={title}><Icon className="mb-3 text-teal-800" size={23} /><h3 className="mb-2 font-bold">{title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{text}</p></article>)}</div>
      <p className="mt-5 text-sm text-muted-foreground">This infographic describes the experience and release plan—not a claim that every future feature is live. Cloud setup, external services, and public release require separate verification.</p>
    </section>
    <footer className="flex items-center justify-between gap-4 border-t pt-5 text-xs text-muted-foreground"><span>FalconEye · Everyday finances, explained simply.</span><span>Product & UI improvement blueprint</span></footer>
  </div>;
}
