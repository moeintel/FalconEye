import { type FormEvent, useEffect, useState } from 'react';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Check, CircleHelp, Plus } from 'lucide-react';
import { CATEGORIES, SUPPORTED_CURRENCIES, currencyMinorUnits, type FinanceRecord } from '@/lib/finance-model';
import { financeStore, useFinance } from '@/lib/finance-store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type CategoryId = FinanceRecord['category'];
type RecordDraft = Omit<FinanceRecord, 'id'>;
const TODAY = () => new Date().toISOString().slice(0, 10);
const CURRENCY_CHOICES = SUPPORTED_CURRENCIES;
function preserveSampleFlag(wasSample: boolean) {
  if (wasSample) financeStore.replace({ ...financeStore.getSnapshot(), isSample: true });
}

const blankRecord = (category: CategoryId, currency: string): RecordDraft => ({
  category, name: '', currency, cost: null, value: null, valuationDate: TODAY(),
  valuationSource: 'manual', access: 'unknown', location: '', notes: '', details: {},
});

export function FinanceEditor({ open, onOpenChange, record, initialCategory }: {
  open: boolean; onOpenChange: (open: boolean) => void; record?: FinanceRecord; initialCategory?: CategoryId;
}) {
  const doc = useFinance();
  const [draft, setDraft] = useState<RecordDraft>(() => blankRecord(initialCategory || 'cash', doc.baseCurrency));
  const [unknownValue, setUnknownValue] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(record ? { ...record, details: { ...record.details } } : blankRecord(initialCategory || 'cash', doc.baseCurrency));
    setUnknownValue(record?.value === null);
    setError('');
  }, [open, record, initialCategory, doc.baseCurrency]);

  const set = <K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) => setDraft((old) => ({ ...old, [key]: value, ...(key === 'category' ? { details: {} } : {}) }));
  const setDetail = (key: string, value: string) => setDraft((old) => ({ ...old, details: { ...old.details, [key]: value } }));
  const selectedCategory = CATEGORIES.find((category) => category.id === draft.category);
  const isDebt = draft.category === 'debt';
  const goldPurity = draft.details.purity == null ? '' : String(draft.details.purity);
  const purityOptions = [24, 22, 18, 14].map((karat) => ({ value: String(karat / 24), label: `${karat}K · ${karat}/24` }));
  const hasStandardPurity = purityOptions.some((option) => option.value === goldPurity);

  function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data: RecordDraft = {
        ...draft,
        name: draft.name.trim(),
        cost: draft.cost === null ? null : Number(draft.cost),
        value: unknownValue ? null : draft.value === null ? null : Number(draft.value),
        location: draft.location.trim(), notes: draft.notes.trim(),
        details: Object.fromEntries(Object.entries(draft.details).map(([key, value]) => [
          key,
          value === '' || value === null ? null : ['weightGrams', 'purity', 'ownershipPct', 'refundedAmount', 'couponRate', 'interestRate', 'units', 'stockunits'].includes(key) ? Number(value) : value,
        ])),
      };
      const wasSample = doc.isSample;
      if (record) financeStore.update(record.id, data);
      else financeStore.add(data);
      preserveSampleFlag(wasSample);
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this item. Please check the details and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="finance-dialog sm:max-w-[650px]">
        <DialogHeader className="finance-dialog-header">
          <div className="fe-dialog-eyebrow">{record ? 'EDIT YOUR RECORD' : 'ADD TO YOUR PICTURE'}</div>
          <DialogTitle>{record ? 'Update this item' : 'Add an asset or debt'}</DialogTitle>
          <DialogDescription>Enter what you know. You can leave value unknown and come back later.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="fe-form">
          <div className="fe-form-section">
            <div className="fe-form-section-title"><span>01</span> What is it?</div>
            <div className="fe-form-grid">
              <label className="fe-field fe-field-wide"><span>Type</span>
                <select className="fe-select" value={draft.category} onChange={(e) => set('category', e.target.value as CategoryId)} disabled={!!record}>
                  {CATEGORIES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                </select>
                <small>{selectedCategory?.description}</small>
              </label>
              <label className="fe-field fe-field-wide"><span>{isDebt ? 'What do you owe?' : 'Give it a name'}</span>
                <input className="fe-input" required autoFocus placeholder={isDebt ? 'e.g. Home loan' : 'e.g. Savings account'} value={draft.name} onChange={(e) => set('name', e.target.value)} />
              </label>
              <label className="fe-field"><span>Currency</span>
                <select className="fe-select" value={draft.currency} onChange={(e) => set('currency', e.target.value)}>
                  {Array.from(new Set([doc.baseCurrency, ...CURRENCY_CHOICES])).map((currency) => <option key={currency}>{currency}</option>)}
                </select>
              </label>
              <label className="fe-field"><span>Where is it held? <em>Optional</em></span>
                <input className="fe-input" placeholder="Bank, platform, or place" value={draft.location} onChange={(e) => set('location', e.target.value)} />
              </label>
            </div>
          </div>

          {draft.category === 'private' && draft.details.agreementType === 'gift' && <div className="fe-activity-explain"><CircleHelp /><span>Gift / non-financial records are kept for your notes but left out of asset and net-worth totals.</span></div>}
          {(draft.category === 'cash' || draft.category === 'gold' || draft.category === 'stocks' || draft.category === 'funds' || draft.category === 'crypto' || draft.category === 'bonds' || draft.category === 'lent' || draft.category === 'private' || draft.category === 'ipo' || draft.category === 'property' || draft.category === 'debt') && (
            <div className="fe-form-section">
              <div className="fe-form-section-title"><span>02</span> A few useful details <small>Optional</small></div>
              <div className="fe-form-grid">
                {draft.category === 'cash' && <label className="fe-field fe-field-wide"><span>Account type</span><input className="fe-input" value={String(draft.details.accountType ?? '')} onChange={(e) => setDetail('accountType', e.target.value)} placeholder="e.g. Checking, savings, term deposit" /></label>}
                {draft.category === 'stocks' && <>
                  <label className="fe-field"><span>Symbol <em>Optional</em></span><input className="fe-input" value={String(draft.details.symbol ?? '')} onChange={(e) => setDetail('symbol', e.target.value)} placeholder="e.g. AAPL" /></label>
                  <label className="fe-field"><span>Number of shares <em>Optional</em></span><input className="fe-input" type="number" min="0" step="any" value={String(draft.details.stockunits ?? '')} onChange={(e) => setDetail('stockunits', e.target.value)} placeholder="Optional" /></label>
                </>}
                {draft.category === 'funds' && <>
                  <label className="fe-field"><span>Fund name or ticker <em>Optional</em></span><input className="fe-input" value={String(draft.details.symbol ?? '')} onChange={(e) => setDetail('symbol', e.target.value)} placeholder="e.g. Total market index" /></label>
                  <label className="fe-field"><span>Units <em>Optional</em></span><input className="fe-input" type="number" min="0" step="any" value={String(draft.details.units ?? '')} onChange={(e) => setDetail('units', e.target.value)} placeholder="Optional" /></label>
                </>}
                {draft.category === 'crypto' && <>
                  <label className="fe-field"><span>Token or ticker <em>Optional</em></span><input className="fe-input" value={String(draft.details.symbol ?? '')} onChange={(e) => setDetail('symbol', e.target.value)} placeholder="e.g. BTC" /></label>
                  <label className="fe-field"><span>Units <em>Optional</em></span><input className="fe-input" type="number" min="0" step="any" value={String(draft.details.units ?? '')} onChange={(e) => setDetail('units', e.target.value)} placeholder="Optional" /></label>
                  <label className="fe-field fe-field-wide"><span>Network <em>Optional</em></span><input className="fe-input" value={String(draft.details.network ?? '')} onChange={(e) => setDetail('network', e.target.value)} placeholder="e.g. Bitcoin, Ethereum" /></label>
                </>}
                {draft.category === 'gold' && <>
                  <label className="fe-field"><span>Weight (grams)</span><input className="fe-input" required inputMode="decimal" type="number" min="0" step="any" value={String(draft.details.weightGrams ?? '')} onChange={(e) => setDetail('weightGrams', e.target.value)} placeholder="e.g. 25" /></label>
                  <label className="fe-field"><span>Purity</span><select className="fe-select" required value={goldPurity} onChange={(e) => setDetail('purity', e.target.value)}><option value="">Choose karat</option>{!hasStandardPurity && goldPurity && <option value={goldPurity}>Custom · {Number(goldPurity) * 100}%</option>}{purityOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><small>Stored as gold content: karat ÷ 24.</small></label>
                </>}
                {draft.category === 'bonds' && <>
                  <label className="fe-field"><span>Issuer <em>Optional</em></span><input className="fe-input" value={String(draft.details.issuer ?? '')} onChange={(e) => setDetail('issuer', e.target.value)} placeholder="Government or company" /></label>
                  <label className="fe-field"><span>Maturity date <em>Optional</em></span><input className="fe-input" type="date" value={String(draft.details.maturityDate ?? '')} onChange={(e) => setDetail('maturityDate', e.target.value)} /></label>
                  <label className="fe-field"><span>Coupon rate (%) <em>Optional</em></span><input className="fe-input" type="number" min="0" max="100" step="any" value={String(draft.details.couponRate ?? '')} onChange={(e) => setDetail('couponRate', e.target.value)} placeholder="Optional" /></label>
                  <label className="fe-field"><span>Units <em>Optional</em></span><input className="fe-input" type="number" min="0" step="any" value={String(draft.details.units ?? '')} onChange={(e) => setDetail('units', e.target.value)} placeholder="Optional" /></label>
                </>}
                {draft.category === 'lent' && <>
                  <label className="fe-field"><span>Borrower <em>Optional</em></span><input className="fe-input" value={String(draft.details.borrower ?? '')} onChange={(e) => setDetail('borrower', e.target.value)} placeholder="Person or organization" /></label>
                  <label className="fe-field"><span>Expected repayment <em>Optional</em></span><input className="fe-input" type="date" value={String(draft.details.dueDate ?? '')} onChange={(e) => setDetail('dueDate', e.target.value)} /></label>
                </>}
                {draft.category === 'private' && <><label className="fe-field"><span>Investment type</span><select className="fe-select" required value={String(draft.details.agreementType ?? '')} onChange={(e) => setDetail('agreementType', e.target.value)}><option value="">Choose one</option><option value="equity">Equity / shares</option><option value="loan">Private loan</option><option value="gift">Gift / non-financial</option></select></label><label className="fe-field"><span>Ownership share (%) <em>Optional</em></span><input className="fe-input" type="number" min="0" max="100" step="any" value={String(draft.details.ownershipPct ?? '')} onChange={(e) => setDetail('ownershipPct', e.target.value)} placeholder="Optional" /></label></>}
                {draft.category === 'ipo' && <>
                  <label className="fe-field"><span>Application status</span><select className="fe-select" required value={String(draft.details.status ?? '')} onChange={(e) => setDetail('status', e.target.value)}><option value="">Choose status</option><option value="applied">Applied / awaiting allocation</option><option value="allocated">Shares allocated</option></select></label>
                  <label className="fe-field"><span>Amount refunded <em>Optional</em></span><input className="fe-input" type="number" min="0" step="any" value={String(draft.details.refundedAmount ?? '')} onChange={(e) => setDetail('refundedAmount', e.target.value)} placeholder="0" /><small>For an application awaiting allocation, refunded money is excluded from its value.</small></label>
                </>}
                {draft.category === 'property' && <>
                  <label className="fe-field"><span>Your ownership share (%)</span><input className="fe-input" type="number" min="0" max="100" step="any" value={String(draft.details.ownershipPct ?? '')} onChange={(e) => setDetail('ownershipPct', e.target.value)} placeholder="e.g. 50" /></label>
                  <label className="fe-field"><span>Address or description <em>Optional</em></span><input className="fe-input" value={String(draft.details.address ?? '')} onChange={(e) => setDetail('address', e.target.value)} placeholder="Optional" /></label>
                  <p className="fe-detail-note fe-field-wide">Enter only your share of the property value below—not the whole property's value.</p>
                </>}
                {draft.category === 'debt' && <>
                  <label className="fe-field"><span>Creditor <em>Optional</em></span><input className="fe-input" value={String(draft.details.creditor ?? '')} onChange={(e) => setDetail('creditor', e.target.value)} placeholder="Lender or company" /></label>
                  <label className="fe-field"><span>Payment due date <em>Optional</em></span><input className="fe-input" type="date" value={String(draft.details.dueDate ?? '')} onChange={(e) => setDetail('dueDate', e.target.value)} /></label>
                  <label className="fe-field fe-field-wide"><span>Interest rate (%) <em>Optional</em></span><input className="fe-input" type="number" min="0" max="100" step="any" value={String(draft.details.interestRate ?? '')} onChange={(e) => setDetail('interestRate', e.target.value)} placeholder="Optional" /></label>
                </>}
              </div>
            </div>
          )}

          <div className="fe-form-section">
            <div className="fe-form-section-title"><span>03</span> Value today <CircleHelp className="fe-help-icon" /></div>
            <div className="fe-form-grid">
              <label className="fe-field"><span>{isDebt ? 'Outstanding balance' : 'What could it be worth now?'}</span>
                <input className="fe-input" inputMode="decimal" type="number" min="0" step="any" disabled={unknownValue} value={draft.value ?? ''} onChange={(e) => set('value', e.target.value === '' ? null : Number(e.target.value))} placeholder="Optional" />
                <small>{isDebt ? 'Enter the current amount owed, not the original loan.' : draft.category === 'ipo' ? 'For a pending application, enter the gross amount paid; refunded cash is subtracted.' : ['stocks', 'funds', 'crypto', 'bonds'].includes(draft.category) ? 'Enter the total value of all your shares or units, not the price of one. No live prices.' : draft.category === 'gold' ? 'Enter your estimated resale value, not the price per gram. Making charges may not be recoverable.' : 'Use an estimate or your latest statement. No live prices.'}</small>
              </label>
              <label className="fe-field"><span>As of</span><input className="fe-input" type="date" required value={draft.valuationDate} onChange={(e) => set('valuationDate', e.target.value)} /><small>Unknown values still need a date for this record.</small></label>
              <label className="fe-field"><span>How did you get this value?</span>
                <select className="fe-select" value={draft.valuationSource} onChange={(e) => set('valuationSource', e.target.value as FinanceRecord['valuationSource'])}><option value="manual">My own estimate</option><option value="statement">Statement or document</option><option value="estimate">Rough estimate</option></select>
              </label>
              <label className="fe-field"><span>{isDebt ? 'Original amount' : 'What you put in'} <em>Optional</em></span><input className="fe-input" type="number" min="0" step="any" inputMode="decimal" value={draft.cost ?? ''} onChange={(e) => set('cost', e.target.value === '' ? null : Number(e.target.value))} placeholder="Optional" /></label>
            </div>
            <label className="fe-checkbox"><input type="checkbox" checked={unknownValue} onChange={(e) => { setUnknownValue(e.target.checked); if (e.target.checked) set('value', null); }} /><span>I don't know the current value yet</span></label>
            {draft.category !== 'debt' && <label className="fe-field fe-access-field"><span>Access to this value</span><select className="fe-select" value={draft.access} onChange={(e) => set('access', e.target.value as FinanceRecord['access'])}><option value="unknown">I’m not sure</option><option value="available">Available when I need it</option><option value="restricted">Locked or not readily accessible</option></select><small>Only items you mark as available appear in the “Easy to access” estimate.</small></label>}
          </div>

          <div className="fe-form-section">
            <div className="fe-form-section-title"><span>04</span> A note to yourself <small>Optional</small></div>
            <label className="fe-field"><textarea className="fe-textarea" rows={2} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything you'll want to remember later" /></label>
          </div>
          {error && <div role="alert" className="fe-error"><AlertCircle />{error}</div>}
          <DialogFooter className="fe-form-footer">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}><Check />{busy ? 'Saving…' : record ? 'Save changes' : 'Add to my picture'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ActivityEditor({ open, onOpenChange, record, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; record?: FinanceRecord; onSaved?: () => void;
}) {
  const doc = useFinance();
  const [recordId, setRecordId] = useState(record?.id || '');
  const [type, setType] = useState<'contribution' | 'withdrawal' | 'income' | 'repayment' | 'fee' | 'valuation'>('contribution');
  const [date, setDate] = useState(TODAY());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setRecordId(record?.id || doc.records[0]?.id || '');
      setType(record?.category === 'debt' || record?.category === 'lent' ? 'repayment' : 'contribution'); setDate(TODAY()); setAmount(''); setNote(''); setError('');
    }
  }, [open, record, doc.records]);
  const selected = doc.records.find((item) => item.id === recordId);
  const isLiability = selected?.category === 'debt' || selected?.category === 'lent';
  const credit = type === 'income' || (type === 'repayment' && selected?.category === 'lent');
  function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const wasSample = doc.isSample;
      financeStore.addActivity({ recordId, type, date, amount: Number(amount), currency: selected?.currency || doc.baseCurrency, note: note.trim() });
      preserveSampleFlag(wasSample);
      onOpenChange(false); onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this activity.'); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="finance-dialog sm:max-w-[520px]">
    <DialogHeader className="finance-dialog-header"><div className="fe-dialog-eyebrow">KEEP A SIMPLE RECORD</div><DialogTitle>Record an activity</DialogTitle><DialogDescription>Track money moving in or out, or record a fresh value for an item.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="fe-form">
      <label className="fe-field"><span>Related to</span><select className="fe-select" required value={recordId} onChange={(e) => { const nextId = e.target.value; setRecordId(nextId); const target = doc.records.find((item) => item.id === nextId); setType(target?.category === 'debt' || target?.category === 'lent' ? 'repayment' : 'contribution'); }}>{doc.records.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currency}</option>)}</select></label>
      <div className="fe-form-grid">
        <label className="fe-field"><span>What happened?</span><select className="fe-select" value={type} onChange={(e) => setType(e.target.value as typeof type)}>{isLiability ? <><option value="repayment">{selected?.category === 'debt' ? 'Debt payment made' : 'Repayment received'}</option><option value="valuation">Update current balance</option></> : <><option value="contribution">Added money</option><option value="withdrawal">Took money out</option><option value="income">Distribution received</option><option value="fee">Fee paid</option><option value="valuation">Update current value</option></>}</select></label>
        <label className="fe-field"><span>Amount ({selected?.currency || doc.baseCurrency})</span><input className="fe-input" type="number" min={type === 'valuation' ? 0 : 10 ** -currencyMinorUnits(selected?.currency || doc.baseCurrency)} step="any" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
        <label className="fe-field"><span>Date</span><input className="fe-input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="fe-field"><span>Short note <em>Optional</em></span><input className="fe-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={credit ? 'e.g. Interest payment' : 'e.g. Monthly deposit'} /></label>
      </div>
      <div className="fe-activity-explain">{type === 'valuation' ? <Check /> : credit ? <ArrowDownLeft /> : <ArrowUpRight />}<span>{type === 'repayment' ? 'This repayment lowers the outstanding balance (or the amount owed to you) when that value is known. Enter no more than the balance shown.' : type === 'valuation' ? 'This sets the record’s current value to the amount entered and uses the event date as its value date.' : type === 'income' ? 'This records a distribution received. It is not treated as reinvested or added to the investment’s current value.' : 'This appears in your activity history and updates the saved value when one is already known. It never fetches a live price.'}</span></div>
      {error && <div role="alert" className="fe-error"><AlertCircle />{error}</div>}
      <DialogFooter className="fe-form-footer"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving || !doc.records.length}><Plus />{saving ? 'Saving…' : 'Save activity'}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
