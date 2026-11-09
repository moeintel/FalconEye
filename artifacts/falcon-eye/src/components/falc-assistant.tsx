import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Mic, Send, ShieldCheck, X } from 'lucide-react';
import { FalcMascot } from './falc-mascot';
import { guideMessage, type AssistantDraft } from '@/lib/assistant-guide';
import { useFinance, financeStore } from '@/lib/finance-store';
import { CATEGORIES, formatMoney, summarizeFinance, type FinanceRecord } from '@/lib/finance-model';

type Message = { role: 'user' | 'assistant'; content: string };
const savedReply = () => financeStore.getStorageError()
  ? 'Added for this session only. Browser storage could not save it. Download a backup from Reports before closing the page.'
  : 'Saved in this browser. You can find it in Assets or Debts. Cloud saving is a separate, explicit action in Settings.';
type Recognition = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

export function FalcAssistant() {
  const doc = useFinance();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Hi, I’m Falc. Tell me about something you own or owe. I’ll prepare a record for you to review—nothing is saved without your confirmation.' }]);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const recognition = useRef<Recognition | null>(null);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('falconeye:open-assistant', show);
    return () => { window.removeEventListener('falconeye:open-assistant', show); recognition.current?.stop(); };
  }, []);
  useEffect(() => { if (open) end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, open]);

  async function send(text = input) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next); setInput(''); setError('');
    if (/^(confirm and save|save this|yes,? save it)$/i.test(content) && draft) {
      try {
        commitDraft(draft, doc.isSample, doc.baseCurrency);
        setDraft(null);
        setMessages([...next, { role: 'assistant', content: savedReply() }]);
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save this draft.'); }
      return;
    }
    if (/^start my own records$/i.test(content)) {
      setMessages([...next, { role: 'assistant', content: doc.isSample ? 'This will replace this browser’s labelled sample picture with empty personal records. Your older portfolio remains preserved. To confirm, type “confirm start my own records”. Your draft will stay here.' : 'You are already using personal records. I will not clear them through chat.' }]);
      return;
    }
    if (/^confirm start my own records$/i.test(content) && doc.isSample) {
      financeStore.startEmpty();
      setMessages([...next, { role: 'assistant', content: 'Your empty personal picture is ready. Review your draft, then type “confirm and save” when the details are right.' }]);
      return;
    }
    if (/\b(what do i own|my summary|my financial position|net worth)\b/i.test(content)) {
      const summary = summarizeFinance(doc);
      setMessages([...next, { role: 'assistant', content: `Your recorded assets: ${formatMoney(summary.assets, doc.baseCurrency)}. Debts: ${formatMoney(summary.debts, doc.baseCurrency)}. Estimated net worth: ${formatMoney(summary.netWorth, doc.baseCurrency)}. ${summary.missingValues || summary.missingRates ? 'This is incomplete: some values or currency rates are missing.' : 'These totals use the values you recorded, not guaranteed sale prices.'} ${doc.isSample ? 'You are viewing sample data, not your personal finances.' : ''}` }]);
      return;
    }
    setBusy(true);
    try {
      let result: { reply: string; draft: AssistantDraft | null };
      if (useAI) {
        const response = await fetch('/api/assistant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: next.slice(-12), currency: doc.baseCurrency }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'AI is unavailable. Turn off AI mode to use the local guided assistant.');
        result = data;
      } else result = guideMessage(content, draft, doc.baseCurrency);
      if (!result || typeof result.reply !== 'string') throw new Error('Unable to prepare a draft. Please try again.');
      setMessages([...next, { role: 'assistant', content: result.reply }]);
      if (result.draft) setDraft((old) => ({ ...old, ...result.draft, details: { ...old?.details, ...result.draft?.details } }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to prepare a draft.'); }
    finally { setBusy(false); }
  }

  function dictate() {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!Ctor) { setError('Voice input is not supported in this browser. You can type instead.'); return; }
    if (listening) { recognition.current?.stop(); return; }
    if (!window.confirm('Voice dictation uses your browser’s speech service, which may send audio to its provider. FalconEye does not store audio. Continue?')) return;
    const r = new Ctor(); recognition.current = r; r.lang = 'en-US'; r.interimResults = false;
    r.onresult = (e) => { setInput((previous) => `${previous} ${e.results[0][0].transcript}`.trim()); };
    r.onerror = () => { setError('Microphone unavailable or permission denied. You can type instead.'); setListening(false); };
    r.onend = () => setListening(false);
    try { r.start(); setListening(true); } catch { setError('Unable to start dictation. You can type instead.'); }
  }

  if (!open) return <button className="falc-launch no-print" onClick={() => setOpen(true)} aria-label="Talk to Falc"><FalcMascot className="h-12 w-12" /><span>Ask Falc</span><MessageCircle size={17} /></button>;
  return (
    <section className="falc-panel no-print" role="dialog" aria-label="Talk to Falc" aria-modal="false">
      <header className="flex items-center gap-3 border-b p-4">
        <FalcMascot className="h-12 w-12 shrink-0" speaking={busy} />
        <div className="min-w-0 flex-1"><h2 className="font-bold">A little help from Falc</h2><p className="text-xs text-muted-foreground">{useAI ? 'AI drafts · review required' : 'Local guided assistant · no AI provider'}</p></div>
        <button onClick={() => { setOpen(false); recognition.current?.stop(); }} aria-label="Close assistant" className="rounded-lg p-2 hover:bg-secondary"><X size={20} /></button>
      </header>
      <div className="falc-conversation">
        {messages.map((m, i) => <div className={`falc-message ${m.role === 'user' ? 'falc-user' : ''}`} key={i}>{m.content}</div>)}
        {busy && <p className="text-sm text-muted-foreground" role="status">Preparing your draft…</p>}
        {draft && <DraftCard draft={draft} setDraft={setDraft} onSaved={() => { setDraft(null); setMessages((m) => [...m, { role: 'assistant', content: savedReply() }]); }} />}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        <div ref={end} />
      </div>
      <div className="border-t p-3">
        {!draft && messages.length < 3 && <div className="mb-3 flex flex-wrap gap-2">{['I bought 20g of 22k gold for AED 5,000', 'I invested with a relative', 'What do I own?'].map((example) => <button className="rounded-full border px-3 py-2 text-left text-xs hover:bg-secondary" onClick={() => void send(example)} key={example}>{example}</button>)}</div>}
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2">
          <label className="sr-only" htmlFor="falc-input">Message Falc</label>
          <textarea id="falc-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={4000} rows={2} placeholder="Tell me what you own or owe…" className="min-w-0 flex-1 rounded-xl border bg-background p-3 text-sm" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <button type="button" onClick={dictate} aria-label={listening ? 'Stop dictation' : 'Dictate a message'} className={`rounded-xl p-3 ${listening ? 'bg-red-100 text-red-800' : 'bg-secondary'}`}><Mic size={18} /></button>
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send message" className="rounded-xl bg-primary p-3 text-primary-foreground disabled:opacity-40"><Send size={18} /></button>
        </form>
        <label className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} className="mt-0.5" />Use AI mode: send this conversation to the configured AI provider. Optional; requires server setup.</label>
        <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck size={12} />No trades. No bank access. No saving without confirmation.</p>
      </div>
    </section>
  );
}

function commitDraft(draft: AssistantDraft, isSample: boolean, baseCurrency: string) {
  if (isSample) throw new Error('These are sample records. Start your own records first. You can type “start my own records” in chat; your draft will stay here.');
  if (!draft.name?.trim() || !draft.category) throw new Error('Choose a category and give this record a name.');
  if (draft.value != null && !draft.valuationDate) throw new Error('Choose the date for this value, or mark the value unknown.');
  if (draft.category === 'private' && !draft.details?.agreementType) throw new Error('Choose whether this is ownership, a loan, or a gift.');
  const record: Omit<FinanceRecord, 'id'> = {
    name: draft.name.trim(), category: draft.category, currency: draft.currency ?? baseCurrency,
    cost: draft.cost ?? null, value: draft.value ?? null, valuationDate: draft.valuationDate || new Date().toISOString().slice(0, 10),
    valuationSource: draft.valuationSource ?? 'manual', access: draft.access ?? 'unknown',
    location: draft.location ?? '', notes: draft.notes ?? '', details: draft.details ?? {},
  };
  financeStore.add(record);
}

function DraftCard({ draft, setDraft, onSaved }: { draft: AssistantDraft; setDraft: (d: AssistantDraft | null) => void; onSaved: () => void }) {
  const doc = useFinance();
  const [error, setError] = useState('');
  const patch = (field: keyof AssistantDraft, value: unknown) => setDraft({ ...draft, [field]: value });
  function save() {
    setError('');
    try {
      commitDraft(draft, doc.isSample, doc.baseCurrency); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save this record.'); }
  }
  const inputClass = 'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm';
  return <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-4">
    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-900">Review before saving</p>
    <p className="mb-3 text-xs text-muted-foreground">Draft only. Unknown values are not treated as zero. You can also type “confirm and save” in chat.</p>
    <div className="grid grid-cols-2 gap-3">
      <label className="col-span-2 text-xs">Name<input aria-label="Draft name" className={inputClass} value={draft.name ?? ''} onChange={(e) => patch('name', e.target.value)} maxLength={100} /></label>
      <label className="text-xs">Category<select aria-label="Draft category" className={inputClass} value={draft.category ?? ''} onChange={(e) => patch('category', e.target.value)}><option value="">Choose…</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label className="text-xs">Currency<input aria-label="Draft currency" className={inputClass} value={draft.currency ?? doc.baseCurrency} maxLength={3} onChange={(e) => patch('currency', e.target.value.toUpperCase())} /></label>
      <label className="text-xs">What you paid<input aria-label="Draft cost" className={inputClass} type="number" min="0" step="any" value={draft.cost ?? ''} onChange={(e) => patch('cost', e.target.value === '' ? null : Number(e.target.value))} /></label>
      <label className="text-xs">{draft.category === 'debt' ? 'Outstanding balance' : 'Current value'}<input aria-label="Draft current value" className={inputClass} type="number" min="0" step="any" value={draft.value ?? ''} placeholder="Unknown" onChange={(e) => patch('value', e.target.value === '' ? null : Number(e.target.value))} /></label>
      <label className="col-span-2 text-xs">Value as of<input aria-label="Draft valuation date" className={inputClass} type="date" value={draft.valuationDate ?? ''} onChange={(e) => patch('valuationDate', e.target.value)} /></label>
      {draft.category === 'private' && <label className="col-span-2 text-xs">What kind of agreement?<select aria-label="Draft agreement type" className={inputClass} value={String(draft.details?.agreementType ?? '')} onChange={(e) => patch('details', { ...draft.details, agreementType: e.target.value })}><option value="">Choose…</option><option value="equity">Ownership in a business</option><option value="loan">Money expected to be repaid</option><option value="gift">Gift · excluded from assets</option></select></label>}
      {draft.category === 'gold' && <>
        <label className="text-xs">Gold weight (grams)<input aria-label="Draft gold grams" className={inputClass} type="number" min="0" step="any" value={draft.details?.weightGrams ?? ''} onChange={(e) => patch('details', { ...draft.details, weightGrams: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        <label className="text-xs">Purity (karat)<select aria-label="Draft gold purity" className={inputClass} value={typeof draft.details?.purity === 'number' ? String(Math.round(draft.details.purity * 24)) : ''} onChange={(e) => patch('details', { ...draft.details, purity: e.target.value === '' ? null : Number(e.target.value) / 24 })}><option value="">Unknown</option>{[9, 10, 14, 18, 21, 22, 24].map((k) => <option key={k} value={k}>{k}k</option>)}</select></label>
        <p className="col-span-2 text-xs">Value is your estimate, not a live gold quote. Jewellery making charges may not be recoverable.</p>
      </>}
      {draft.category === 'ipo' && <label className="col-span-2 text-xs">IPO status<select aria-label="Draft IPO status" className={inputClass} value={String(draft.details?.status ?? '')} onChange={(e) => patch('details', { ...draft.details, status: e.target.value })}><option value="">Choose…</option><option value="applied">Applied · awaiting allocation</option><option value="allocated">Shares allocated</option></select></label>}
    </div>
    {error && <p className="mt-3 text-xs text-red-800" role="alert">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2"><button onClick={save} className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Confirm and save</button><button onClick={() => setDraft(null)} className="rounded-lg border px-3 py-3 text-sm">Discard draft</button></div>
  </div>;
}
