import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Mic, Send, ShieldCheck, X } from 'lucide-react';
import { FalcMascot } from './falc-mascot';
import { assistantCommand, guideMessage, type AssistantDraft } from '@/lib/assistant-guide';
import { useFinance, financeStore } from '@/lib/finance-store';
import { CATEGORIES, summarizeFinance, type FinanceRecord } from '@/lib/finance-model';
import { formatMoney } from '@/lib/locale';

type Message = { role: 'user' | 'assistant'; content: string };
type AssistantErrorKey = 'unableSave' | 'unablePrepare' | 'unavailableAI' | 'unsupportedVoice' | 'microphone' | 'startDictation' | 'sampleRecords' | 'chooseNameCategory' | 'chooseDate' | 'chooseAgreement' | 'unableSaveRecord';
type AssistantError = { key: AssistantErrorKey };
const commitErrorKeys = ['sampleRecords', 'chooseNameCategory', 'chooseDate', 'chooseAgreement'] as const;
function isCommitErrorKey(key: string): key is (typeof commitErrorKeys)[number] {
  return commitErrorKeys.includes(key as (typeof commitErrorKeys)[number]);
}
type Recognition = {
  lang: string;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function FalcAssistant() {
  const { t, i18n } = useTranslation('assistant');
  const { t: ux } = useTranslation('ux');
  const language = i18n.resolvedLanguage === 'ar-simple' ? 'ar-simple' : i18n.resolvedLanguage?.startsWith('ar') ? 'ar' : 'en';
  const doc = useFinance();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [error, setError] = useState<AssistantError | null>(null);
  const [listening, setListening] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const recognition = useRef<Recognition | null>(null);

  function savedReply() {
    return financeStore.getStorageError() ? t('messages.savedSession') : t('messages.saved');
  }

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('falconeye:open-assistant', show);
    return () => { window.removeEventListener('falconeye:open-assistant', show); recognition.current?.stop(); };
  }, []);
  useEffect(() => { if (open) end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, open, draft]);

  async function send(text = input) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next); setInput(''); setError(null);
    const command = assistantCommand(content, language);
    if (command === 'save' && draft) {
      try {
        commitDraft(draft, doc.isSample, doc.baseCurrency);
        setDraft(null);
        setMessages([...next, { role: 'assistant', content: savedReply() }]);
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        setError({ key: isCommitErrorKey(message) ? message : 'unableSave' });
      }
      return;
    }
    if (command === 'start') {
      setMessages([...next, { role: 'assistant', content: doc.isSample
        ? t('messages.sampleStart', { confirmStartCommand: t('commands.confirmStart') })
        : t('messages.alreadyPersonal') }]);
      return;
    }
    if (command === 'confirmStart' && doc.isSample) {
      financeStore.startEmpty();
      setMessages([...next, { role: 'assistant', content: t('messages.personalStarted', { saveCommand: t('commands.save') }) }]);
      return;
    }
    const searchable = content.normalize('NFD').replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي');
    if (/\b(what do i own|my summary|my financial position|net worth)\b/i.test(content) || /ما الذي املك|ماذا املك|ملخصي|صافي الثروة/.test(searchable)) {
      const summary = summarizeFinance(doc);
      setMessages([...next, { role: 'assistant', content: t('messages.summary', {
        assets: formatMoney(summary.assets, doc.baseCurrency),
        debts: formatMoney(summary.debts, doc.baseCurrency),
        netWorth: formatMoney(summary.netWorth, doc.baseCurrency),
        qualification: summary.missingValues || summary.missingRates ? t('messages.incomplete') : t('messages.estimateOnly'),
        sampleNote: doc.isSample ? t('messages.sampleNote') : '',
      }) }]);
      return;
    }
    setBusy(true);
    try {
      let result: { reply: string; draft: AssistantDraft | null };
      if (useAI) {
        const response = await fetch('/api/assistant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: next.slice(-12), currency: doc.baseCurrency, language: language === 'en' ? 'en' : 'ar' }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error('assistant-unavailable');
        if (!data || typeof data.reply !== 'string') throw new Error('invalid-draft');
        result = data;
        setMessages([...next, { role: 'assistant', content: result.reply }]);
        if (result.draft) setDraft((old) => ({ ...old, ...result.draft, details: { ...old?.details, ...result.draft?.details } }));
      } else {
        const result = guideMessage(content, draft, doc.baseCurrency, language);
        setMessages([...next, { role: 'assistant', content: result.reply }]);
        if (result.draft) setDraft((old) => ({ ...old, ...result.draft, details: { ...old?.details, ...result.draft?.details } }));
      }
    } catch (e) {
      setError({ key: e instanceof Error && e.message === 'assistant-unavailable' ? 'unavailableAI' : 'unablePrepare' });
    } finally { setBusy(false); }
  }

  function dictate() {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!Ctor) { setError({ key: 'unsupportedVoice' }); return; }
    if (listening) { recognition.current?.stop(); return; }
    if (!window.confirm(t('errors.voiceConsent'))) return;
    const r = new Ctor(); recognition.current = r; r.lang = language.startsWith('ar') ? 'ar-AE' : 'en-US'; r.interimResults = false;
    r.onresult = (e) => { setInput((previous) => `${previous} ${e.results[0][0].transcript}`.trim()); };
    r.onerror = () => { setError({ key: 'microphone' }); setListening(false); };
    r.onend = () => setListening(false);
    try { r.start(); setListening(true); } catch { setError({ key: 'startDictation' }); }
  }

  if (!open) return <button className="falc-launch no-print" onClick={() => setOpen(true)} aria-label={t('launch')}>
    <FalcMascot className="h-12 w-12" /><span>{t('launchAsk')}</span><MessageCircle size={17} />
  </button>;
  return (
    <section className="falc-panel no-print" role="dialog" aria-label={t('launch')} aria-modal="false">
      <header className="flex items-center gap-3 border-b p-4">
        <FalcMascot className="h-12 w-12 shrink-0" speaking={busy} />
        <div className="min-w-0 flex-1"><h2 className="font-bold">{t('heading')}</h2><p className="text-xs text-muted-foreground">{useAI ? t('aiStatus') : t('localStatus')}</p></div>
        <button onClick={() => { setOpen(false); recognition.current?.stop(); }} aria-label={t('close')} className="rounded-lg p-2 hover:bg-secondary"><X size={20} /></button>
      </header>
      <div className="falc-conversation">
        {messages.length === 0 && <div className="falc-message">{t('welcome')}</div>}
        {messages.length === 0 && <p className="mb-3 text-sm text-muted-foreground">{ux('falcGuidance')}</p>}
        {messages.map((m, i) => <div className={`falc-message ${m.role === 'user' ? 'falc-user' : ''}`} key={i}>{m.content}</div>)}
        {busy && <p className="text-sm text-muted-foreground" role="status">{t('preparing')}</p>}
        {draft && <DraftCard draft={draft} setDraft={setDraft} onSaved={() => { setDraft(null); setMessages((m) => [...m, { role: 'assistant', content: savedReply() }]); }} />}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error.key === 'sampleRecords' ? t('errors.sampleRecords', { startCommand: t('commands.start') }) : t(`errors.${error.key}`)}</p>}
        <div ref={end} />
      </div>
      <div className="border-t p-3">
        {!draft && messages.length < 3 && <div className="mb-3 flex flex-wrap gap-2">
          {(['gold', 'private', 'summary'] as const).map((example) => <button className="rounded-full border px-3 py-2 text-start text-xs hover:bg-secondary" onClick={() => void send(t(`examples.${example}`))} key={example}>{t(`examples.${example}`)}</button>)}
        </div>}
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2">
          <label className="sr-only" htmlFor="falc-input">{t('messageLabel')}</label>
          <textarea id="falc-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={4000} rows={2} placeholder={t('messagePlaceholder')} className="min-w-0 flex-1 rounded-xl border bg-background p-3 text-sm" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <button type="button" onClick={dictate} aria-label={listening ? t('stopDictation') : t('dictate')} className={`rounded-xl p-3 ${listening ? 'bg-red-100 text-red-800' : 'bg-secondary'}`}><Mic size={18} /></button>
          <button type="submit" disabled={busy || !input.trim()} aria-label={t('send')} className="rounded-xl bg-primary p-3 text-primary-foreground disabled:opacity-40"><Send size={18} /></button>
        </form>
        <label className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} className="mt-0.5" />{t('aiOptIn')}</label>
        <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck size={12} />{t('safety')}</p>
      </div>
    </section>
  );
}

function commitDraft(draft: AssistantDraft, isSample: boolean, baseCurrency: string) {
  if (isSample) throw new Error('sampleRecords');
  if (!draft.name?.trim() || !draft.category) throw new Error('chooseNameCategory');
  if (draft.value != null && !draft.valuationDate) throw new Error('chooseDate');
  if (draft.category === 'private' && !draft.details?.agreementType) throw new Error('chooseAgreement');
  const record: Omit<FinanceRecord, 'id'> = {
    name: draft.name.trim(), category: draft.category, currency: draft.currency ?? baseCurrency,
    cost: draft.cost ?? null, value: draft.value ?? null, valuationDate: draft.valuationDate || new Date().toISOString().slice(0, 10),
    valuationSource: draft.valuationSource ?? 'manual', access: draft.access ?? 'unknown',
    location: draft.location ?? '', notes: draft.notes ?? '', details: draft.details ?? {},
  };
  financeStore.add(record);
}

function DraftCard({ draft, setDraft, onSaved }: { draft: AssistantDraft; setDraft: (d: AssistantDraft | null) => void; onSaved: () => void }) {
  const { t } = useTranslation('assistant');
  const { t: common } = useTranslation('common');
  const { t: ux } = useTranslation('ux');
  const doc = useFinance();
  const [error, setError] = useState<AssistantError | null>(null);
  const patch = (field: keyof AssistantDraft, value: unknown) => setDraft({ ...draft, [field]: value });
  function save() {
    setError(null);
    try {
      commitDraft(draft, doc.isSample, doc.baseCurrency);
      onSaved();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError({ key: isCommitErrorKey(message) ? message : 'unableSaveRecord' });
    }
  }
  const inputClass = 'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm';
  const question = !draft.category ? 'chooseType' : !draft.name?.trim() ? 'falcName'
    : draft.category === 'private' && !draft.details?.agreementType ? 'falcAgreement'
    : draft.category === 'gold' && (draft.details?.weightGrams == null || draft.details?.purity == null) ? 'falcGold'
    : draft.category === 'ipo' && !draft.details?.status ? 'falcIpo'
    : draft.value === undefined ? 'falcValue'
    : draft.value != null && !draft.valuationDate ? 'falcDate' : null;
  return <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-4">
    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-900">{t('reviewTitle')}</p>
    <p className="mb-3 text-xs text-muted-foreground">{t('reviewHelp', { saveCommand: t('commands.save') })}</p>
    <p className="mb-3 text-sm font-medium" aria-live="polite">{question ? ux('falcNext', { question: ux(question) }) : ux('falcReady')}</p>
    {draft.value !== null && <button type="button" className="mb-3 min-h-11 rounded-lg border px-3 py-2 text-sm" onClick={() => patch('value', null)}>{ux('falcUnknown')}</button>}
    <div className="grid grid-cols-2 gap-3">
      <label className="col-span-2 text-xs">{t('fields.name')}<input aria-label={t('fields.name')} className={inputClass} value={draft.name ?? ''} onChange={(e) => patch('name', e.target.value)} maxLength={100} /></label>
      <label className="text-xs">{t('fields.category')}<select aria-label={t('fields.category')} className={inputClass} value={draft.category ?? ''} onChange={(e) => patch('category', e.target.value)}><option value="">{t('choose')}</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{common(`categories.${c.id}`)}</option>)}</select></label>
      <label className="text-xs">{t('fields.currency')}<input aria-label={t('fields.currency')} className={inputClass} value={draft.currency ?? doc.baseCurrency} maxLength={3} onChange={(e) => patch('currency', e.target.value.toUpperCase())} /></label>
      <label className="text-xs">{t('fields.cost')}<input aria-label={t('fields.cost')} className={inputClass} type="number" min="0" step="any" value={draft.cost ?? ''} onChange={(e) => patch('cost', e.target.value === '' ? null : Number(e.target.value))} /></label>
      <label className="text-xs">{draft.category === 'debt' ? t('fields.outstanding') : t('fields.currentValue')}<input aria-label={t('fields.currentValue')} className={inputClass} type="number" min="0" step="any" value={draft.value ?? ''} placeholder={t('unknown')} onChange={(e) => patch('value', e.target.value === '' ? null : Number(e.target.value))} /></label>
      <label className="col-span-2 text-xs">{t('fields.valueDate')}<input aria-label={t('fields.valueDate')} className={inputClass} type="date" value={draft.valuationDate ?? ''} onChange={(e) => patch('valuationDate', e.target.value)} /></label>
      {draft.category === 'private' && <label className="col-span-2 text-xs">{t('fields.agreement')}<select aria-label={t('fields.agreement')} className={inputClass} value={String(draft.details?.agreementType ?? '')} onChange={(e) => patch('details', { ...draft.details, agreementType: e.target.value })}><option value="">{t('choose')}</option><option value="equity">{t('agreementTypes.equity')}</option><option value="loan">{t('agreementTypes.loan')}</option><option value="gift">{t('agreementTypes.gift')}</option></select></label>}
      {draft.category === 'gold' && <>
        <label className="text-xs">{t('fields.goldWeight')}<input aria-label={t('fields.goldWeight')} className={inputClass} type="number" min="0" step="any" value={draft.details?.weightGrams ?? ''} onChange={(e) => patch('details', { ...draft.details, weightGrams: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        <label className="text-xs">{t('fields.goldPurity')}<select aria-label={t('fields.goldPurity')} className={inputClass} value={typeof draft.details?.purity === 'number' ? String(Math.round(draft.details.purity * 24)) : ''} onChange={(e) => patch('details', { ...draft.details, purity: e.target.value === '' ? null : Number(e.target.value) / 24 })}><option value="">{t('unknown')}</option>{[9, 10, 14, 18, 21, 22, 24].map((k) => <option key={k} value={k}>{t('goldKarat', { count: k })}</option>)}</select></label>
        <p className="col-span-2 text-xs">{t('goldNote')}</p>
      </>}
      {draft.category === 'ipo' && <label className="col-span-2 text-xs">{t('fields.ipoStatus')}<select aria-label={t('fields.ipoStatus')} className={inputClass} value={String(draft.details?.status ?? '')} onChange={(e) => patch('details', { ...draft.details, status: e.target.value })}><option value="">{t('choose')}</option><option value="applied">{t('ipoStatuses.applied')}</option><option value="allocated">{t('ipoStatuses.allocated')}</option></select></label>}
    </div>
    {error && <p className="mt-3 text-xs text-red-800" role="alert">{error.key === 'sampleRecords' ? t('errors.sampleRecords', { startCommand: t('commands.start') }) : t(`errors.${error.key}`)}</p>}
    {doc.isSample && <p className="mt-3 text-sm">{ux('falcSample')}</p>}
    <div className="mt-4 flex flex-wrap gap-2">{doc.isSample ? <button className="finance-button" onClick={() => { if (window.confirm(ux('sampleConfirm'))) financeStore.startEmpty(); }}>{ux('startOwn')}</button> : <button onClick={save} className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">{t('confirmSave')}</button>}<button onClick={() => setDraft(null)} className="rounded-lg border px-3 py-3 text-sm">{t('discard')}</button></div>
  </div>;
}
