import { type FormEvent, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Check, CircleHelp, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CATEGORIES, SUPPORTED_CURRENCIES, currencyMinorUnits, type FinanceRecord } from '@/lib/finance-model';
import { financeStore, useFinance } from '@/lib/finance-store';
import { localizedError } from '@/lib/i18n';
import { formatMoney } from '@/lib/locale';
import { FinanceAssetIcon } from './finance-asset-icon';
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
  const { t } = useTranslation('editor');
  const { t: tCommon } = useTranslation('common');
  const { t: ux } = useTranslation('ux');
  const doc = useFinance();
  const [draft, setDraft] = useState<RecordDraft>(() => blankRecord(initialCategory || 'cash', doc.baseCurrency));
  const [unknownValue, setUnknownValue] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [personalCurrency, setPersonalCurrency] = useState(doc.baseCurrency);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(record ? { ...record, details: { ...record.details } } : blankRecord(initialCategory || 'cash', doc.baseCurrency));
    setUnknownValue(record?.value === null);
    setError('');
    setStep(record ? 1 : 0);
    setPersonalCurrency(doc.baseCurrency);
  }, [open, record, initialCategory, doc.baseCurrency]);
  useEffect(() => { if (open) heading.current?.focus(); }, [open, step]);

  const set = <K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) => setDraft((old) => ({ ...old, [key]: value, ...(key === 'category' ? { details: {} } : {}) }));
  const setDetail = (key: string, value: string) => setDraft((old) => ({ ...old, details: { ...old.details, [key]: value } }));
  const selectedCategory = CATEGORIES.find((category) => category.id === draft.category);
  const isDebt = draft.category === 'debt';
  const goldPurity = draft.details.purity == null ? '' : String(draft.details.purity);
  const purityOptions = [24, 22, 18, 14].map((karat) => ({ value: String(karat / 24), label: t('record.karatLabel', { karat }) }));
  const hasStandardPurity = purityOptions.some((option) => option.value === goldPurity);
  const requiredDetails = ['gold', 'private', 'ipo'].includes(draft.category);
  const DetailSection = requiredDetails ? 'section' : 'details';
  const DetailHeading = requiredDetails ? 'div' : 'summary';

  function save(event: FormEvent) {
    event.preventDefault();
    if (step !== 2) { setStep(step + 1); return; }
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
          <div className="fe-dialog-eyebrow">{record ? t('record.editEyebrow') : t('record.addEyebrow')}</div>
          <DialogTitle ref={heading} tabIndex={-1}>{record ? t('record.updateTitle') : t('record.addTitle')}</DialogTitle>
          <DialogDescription>{t('record.description')} {t('record.numericEntryHelp')}</DialogDescription>
        </DialogHeader>
        {doc.isSample && !record ? <div className="fe-sample-gate">
          <h3>{ux('sampleTitle')}</h3><p>{ux('sampleHelp')}</p>
          <label className="fe-field"><span>{ux('personalCurrency')}</span><select className="fe-select" value={personalCurrency} onChange={(e) => setPersonalCurrency(e.target.value)}>{CURRENCY_CHOICES.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
          {error && <p role="alert">{localizedError(error)}</p>}
          <Button onClick={() => {
            if (!window.confirm(ux('sampleConfirm'))) return;
            try { financeStore.startEmpty(); financeStore.setBaseCurrency(personalCurrency); }
            catch (reason) { setError(reason instanceof Error ? reason.message : t('record.saveError')); }
          }}>{ux('startOwn')}</Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{ux('keepExploring')}</Button>
        </div> : <form onSubmit={save} className="fe-form">
          <div className="fe-step-heading" aria-live="polite"><span>{ux('step', { current: step + 1, total: 3 })}</span><b>{ux(step === 0 ? 'chooseType' : step === 1 ? 'detailsStep' : 'reviewStep')}</b></div>
          {doc.isSample && <p className="fe-sample-inline">{ux('sampleEdit')}</p>}
          {step === 0 && <><p className="fe-entry-help">{ux('chooseHelp')}</p><div className="fe-category-choices" role="group" aria-label={ux('chooseType')}>
            {CATEGORIES.map((category) => <button type="button" key={category.id} aria-pressed={draft.category === category.id} onClick={() => set('category', category.id)}>
              <FinanceAssetIcon record={{ ...draft, category: category.id, id: 'choice', details: {} }} /><b>{tCommon(`categories.${category.id}`)}</b><small>{tCommon(`categoryDescriptions.${category.id}`)}</small>
            </button>)}
          </div></>}
          {step === 1 && <><div className="fe-form-section">
            <div className="fe-form-section-title"><span>01</span> {t('record.whatIsIt')}</div>
            <div className="fe-form-grid">
              <p className="fe-entry-help fe-field-wide">{selectedCategory && tCommon(`categories.${selectedCategory.id}`)} · {selectedCategory && tCommon(`categoryDescriptions.${selectedCategory.id}`)}</p>
              <label className="fe-field fe-field-wide"><span>{isDebt ? t('record.owe') : t('record.name')} <em>{ux('required')}</em></span>
                <input className="fe-input" required autoFocus placeholder={isDebt ? t('record.debtExample') : t('record.assetExample')} value={draft.name} onChange={(e) => set('name', e.target.value)} />
              </label>
              <label className="fe-field fe-field-wide"><span>{t('record.currency')} <em>{ux('required')}</em></span>
                <select className="fe-select" value={draft.currency} onChange={(e) => set('currency', e.target.value)}>
                  {Array.from(new Set([doc.baseCurrency, ...CURRENCY_CHOICES])).map((currency) => <option key={currency}>{currency}</option>)}
                </select>
              </label>
            </div>
          </div>

          {draft.category === 'private' && draft.details.agreementType === 'gift' && <div className="fe-activity-explain"><CircleHelp /><span>{t('record.giftNote')}</span></div>}
          {(draft.category === 'cash' || draft.category === 'gold' || draft.category === 'stocks' || draft.category === 'funds' || draft.category === 'crypto' || draft.category === 'bonds' || draft.category === 'lent' || draft.category === 'private' || draft.category === 'ipo' || draft.category === 'property' || draft.category === 'debt') && (
            <DetailSection className="fe-form-section fe-entry-details">
              <DetailHeading className="fe-form-section-title"><span>02</span> {t('record.detailsTitle')} <small>{requiredDetails ? ux('required') : t('record.optional')}</small></DetailHeading>
              <div className="fe-form-grid">
                {draft.category === 'cash' && <label className="fe-field fe-field-wide"><span>{t('record.accountType')}</span><input className="fe-input" value={String(draft.details.accountType ?? '')} onChange={(e) => setDetail('accountType', e.target.value)} placeholder={t('record.accountTypePlaceholder')} /></label>}
                {draft.category === 'stocks' && <>
                  <label className="fe-field"><span>{t('record.symbol')} <em>{t('record.optional')}</em></span><input className="fe-input" value={String(draft.details.symbol ?? '')} onChange={(e) => setDetail('symbol', e.target.value)} placeholder={t('record.symbolExample')} /></label>
                  <label className="fe-field"><span>{t('record.shares')} <em>{t('record.optional')}</em></span><input className="fe-input" type="number" min="0" step="any" value={String(draft.details.stockunits ?? '')} onChange={(e) => setDetail('stockunits', e.target.value)} placeholder={t('record.optionalPlaceholder')} /></label>
                </>}
                {draft.category === 'funds' && <>
                  <label className="fe-field"><span>{t('record.fundName')} <em>{t('record.optional')}</em></span><input className="fe-input" value={String(draft.details.symbol ?? '')} onChange={(e) => setDetail('symbol', e.target.value)} placeholder={t('record.fundPlaceholder')} /></label>
                  <label className="fe-field"><span>{t('record.units')} <em>{t('record.optional')}</em></span><input className="fe-input" type="number" min="0" step="any" value={String(draft.details.units ?? '')} onChange={(e) => setDetail('units', e.target.value)} placeholder={t('record.optionalPlaceholder')} /></label>
                </>}
                {draft.category === 'crypto' && <>
                  <label className="fe-field"><span>{t('record.token')} <em>{t('record.optional')}</em></span><input className="fe-input" value={String(draft.details.symbol ?? '')} onChange={(e) => setDetail('symbol', e.target.value)} placeholder={t('record.tokenExample')} /></label>
                  <label className="fe-field"><span>{t('record.units')} <em>{t('record.optional')}</em></span><input className="fe-input" type="number" min="0" step="any" value={String(draft.details.units ?? '')} onChange={(e) => setDetail('units', e.target.value)} placeholder={t('record.optionalPlaceholder')} /></label>
                  <label className="fe-field fe-field-wide"><span>{t('record.network')} <em>{t('record.optional')}</em></span><input className="fe-input" value={String(draft.details.network ?? '')} onChange={(e) => setDetail('network', e.target.value)} placeholder={t('record.networkPlaceholder')} /></label>
                </>}
                {draft.category === 'gold' && <>
                  <label className="fe-field"><span>{t('record.weight')} <em>{ux('required')}</em></span><input className="fe-input" required inputMode="decimal" type="number" min="0" step="any" value={String(draft.details.weightGrams ?? '')} onChange={(e) => setDetail('weightGrams', e.target.value)} placeholder={t('record.weightExample')} /></label>
                  <label className="fe-field"><span>{t('record.purity')} <em>{ux('required')}</em></span><select className="fe-select" required value={goldPurity} onChange={(e) => setDetail('purity', e.target.value)}><option value="">{t('record.chooseKarat')}</option>{!hasStandardPurity && goldPurity && <option value={goldPurity}>{t('record.customPurity', { percent: Number(goldPurity) * 100 })}</option>}{purityOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><small>{t('record.purityHelp')}</small></label>
                </>}
                {draft.category === 'bonds' && <>
                  <label className="fe-field"><span>{t('record.issuer')} <em>{t('record.optional')}</em></span><input className="fe-input" value={String(draft.details.issuer ?? '')} onChange={(e) => setDetail('issuer', e.target.value)} placeholder={t('record.issuerPlaceholder')} /></label>
                  <label className="fe-field"><span>{t('record.maturity')} <em>{t('record.optional')}</em></span><input className="fe-input" type="date" value={String(draft.details.maturityDate ?? '')} onChange={(e) => setDetail('maturityDate', e.target.value)} /></label>
                  <label className="fe-field"><span>{t('record.coupon')} <em>{t('record.optional')}</em></span><input className="fe-input" type="number" min="0" max="100" step="any" value={String(draft.details.couponRate ?? '')} onChange={(e) => setDetail('couponRate', e.target.value)} placeholder={t('record.optionalPlaceholder')} /></label>
                  <label className="fe-field"><span>{t('record.units')} <em>{t('record.optional')}</em></span><input className="fe-input" type="number" min="0" step="any" value={String(draft.details.units ?? '')} onChange={(e) => setDetail('units', e.target.value)} placeholder={t('record.optionalPlaceholder')} /></label>
                </>}
                {draft.category === 'lent' && <>
                  <label className="fe-field"><span>{t('record.borrower')} <em>{t('record.optional')}</em></span><input className="fe-input" value={String(draft.details.borrower ?? '')} onChange={(e) => setDetail('borrower', e.target.value)} placeholder={t('record.personOrganization')} /></label>
                  <label className="fe-field"><span>{t('record.repayment')} <em>{t('record.optional')}</em></span><input className="fe-input" type="date" value={String(draft.details.dueDate ?? '')} onChange={(e) => setDetail('dueDate', e.target.value)} /></label>
                </>}
                {draft.category === 'private' && <><label className="fe-field"><span>{ux('agreement')} <em>{ux('required')}</em></span><select className="fe-select" required value={String(draft.details.agreementType ?? '')} onChange={(e) => setDetail('agreementType', e.target.value)}><option value="">{t('record.chooseOne')}</option><option value="equity">{ux('equity')}</option><option value="loan">{ux('loan')}</option><option value="gift">{ux('gift')}</option></select></label><label className="fe-field"><span>{t('record.ownership')} <em>{t('record.optional')}</em></span><input className="fe-input" type="number" min="0" max="100" step="any" value={String(draft.details.ownershipPct ?? '')} onChange={(e) => setDetail('ownershipPct', e.target.value)} placeholder={t('record.optionalPlaceholder')} /></label></>}
                {draft.category === 'ipo' && <>
                  <label className="fe-field"><span>{ux('ipoQuestion')} <em>{ux('required')}</em></span><select className="fe-select" required value={String(draft.details.status ?? '')} onChange={(e) => setDetail('status', e.target.value)}><option value="">{t('record.chooseStatus')}</option><option value="applied">{ux('ipoPending')}</option><option value="allocated">{ux('ipoAllocated')}</option></select></label>
                  <label className="fe-field"><span>{t('record.refunded')} <em>{t('record.optional')}</em></span><input className="fe-input" type="number" min="0" step="any" value={String(draft.details.refundedAmount ?? '')} onChange={(e) => setDetail('refundedAmount', e.target.value)} placeholder="0" /><small>{t('record.refundHelp')}</small></label>
                </>}
                {draft.category === 'property' && <>
                  <label className="fe-field"><span>{t('record.yourOwnership')}</span><input className="fe-input" type="number" min="0" max="100" step="any" value={String(draft.details.ownershipPct ?? '')} onChange={(e) => setDetail('ownershipPct', e.target.value)} placeholder={t('record.ownershipExample')} /></label>
                  <label className="fe-field"><span>{t('record.address')} <em>{t('record.optional')}</em></span><input className="fe-input" value={String(draft.details.address ?? '')} onChange={(e) => setDetail('address', e.target.value)} placeholder={t('record.optionalPlaceholder')} /></label>
                  <p className="fe-detail-note fe-field-wide">{t('record.propertyShareHelp')}</p>
                </>}
                {draft.category === 'debt' && <>
                  <label className="fe-field"><span>{t('record.creditor')} <em>{t('record.optional')}</em></span><input className="fe-input" value={String(draft.details.creditor ?? '')} onChange={(e) => setDetail('creditor', e.target.value)} placeholder={t('record.lenderCompany')} /></label>
                  <label className="fe-field"><span>{t('record.paymentDue')} <em>{t('record.optional')}</em></span><input className="fe-input" type="date" value={String(draft.details.dueDate ?? '')} onChange={(e) => setDetail('dueDate', e.target.value)} /></label>
                  <label className="fe-field fe-field-wide"><span>{t('record.interestRate')} <em>{t('record.optional')}</em></span><input className="fe-input" type="number" min="0" max="100" step="any" value={String(draft.details.interestRate ?? '')} onChange={(e) => setDetail('interestRate', e.target.value)} placeholder={t('record.optionalPlaceholder')} /></label>
                </>}
              </div>
            </DetailSection>
          )}

          <div className="fe-form-section">
              <div className="fe-form-section-title"><span>03</span> {t('record.valueToday')} <CircleHelp className="fe-help-icon" /></div>
            <div className="fe-form-grid">
              <label className="fe-field"><span>{isDebt ? t('record.outstanding') : t('record.worthNow')}</span>
                <input className="fe-input" inputMode="decimal" type="number" min="0" step="any" disabled={unknownValue} value={draft.value ?? ''} onChange={(e) => set('value', e.target.value === '' ? null : Number(e.target.value))} placeholder={t('record.optionalPlaceholder')} />
                <small>{isDebt ? t('record.debtValueHelp') : draft.category === 'ipo' ? t('record.ipoValueHelp') : ['stocks', 'funds', 'crypto', 'bonds'].includes(draft.category) ? t('record.unitsValueHelp') : draft.category === 'gold' ? t('record.goldValueHelp') : t('record.estimateHelp')}</small>
              </label>
              <label className="fe-field"><span>{t('record.asOf')} <em>{ux('required')}</em></span><input className="fe-input" type="date" required value={draft.valuationDate} onChange={(e) => set('valuationDate', e.target.value)} /><small>{ux('entryDateHelp')}</small></label>
            </div>
            <label className="fe-checkbox"><input type="checkbox" checked={unknownValue} onChange={(e) => { setUnknownValue(e.target.checked); if (e.target.checked) set('value', null); }} /><span>{t('record.unknownValue')}</span></label>
          </div>

          <details className="fe-form-section fe-entry-details">
            <summary className="fe-form-section-title">{ux('optionalDetails')}</summary>
            <div className="fe-form-grid">
              <label className="fe-field"><span>{t('record.valueSource')}</span><select className="fe-select" value={draft.valuationSource} onChange={(e) => set('valuationSource', e.target.value as FinanceRecord['valuationSource'])}><option value="manual">{t('record.manual')}</option><option value="statement">{t('record.statement')}</option><option value="estimate">{t('record.estimate')}</option></select></label>
              <label className="fe-field"><span>{isDebt ? t('record.originalAmount') : t('record.invested')}</span><input className="fe-input" type="number" min="0" step="any" inputMode="decimal" value={draft.cost ?? ''} onChange={(e) => set('cost', e.target.value === '' ? null : Number(e.target.value))} /></label>
              <label className="fe-field fe-field-wide"><span>{t('record.location')}</span><input className="fe-input" value={draft.location} onChange={(e) => set('location', e.target.value)} /></label>
              {draft.category !== 'debt' && <label className="fe-field fe-field-wide"><span>{t('record.access')}</span><select className="fe-select" value={draft.access} onChange={(e) => set('access', e.target.value as FinanceRecord['access'])}><option value="unknown">{t('record.unsure')}</option><option value="available">{t('record.available')}</option><option value="restricted">{t('record.restricted')}</option></select><small>{ux('accessibleHelp')}</small></label>}
            </div>
            <h3 className="fe-entry-help">{t('record.noteTitle')}</h3>
            <label className="fe-field"><textarea className="fe-textarea" rows={2} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t('record.notePlaceholder')} /></label>
          </details></>}
          {step === 2 && <div className="fe-entry-review">
            <p>{ux('reviewHelp')}</p><dl>
              <dt>{t('record.type')}</dt><dd>{tCommon(`categories.${draft.category}`)}</dd>
              <dt>{t('record.name')}</dt><dd><bdi>{draft.name}</bdi></dd>
              <dt>{t('record.currency')}</dt><dd><bdi>{draft.currency}</bdi></dd>
              <dt>{isDebt ? t('record.outstanding') : t('record.worthNow')}</dt><dd>{unknownValue || draft.value === null ? ux('noValue') : formatMoney(draft.value, draft.currency)}</dd>
              <dt>{t('record.asOf')}</dt><dd><bdi>{draft.valuationDate === '1970-01-01' ? ux('notEntered') : draft.valuationDate}</bdi></dd>
              <dt>{t('record.invested')}</dt><dd>{draft.cost === null ? ux('notEntered') : formatMoney(draft.cost, draft.currency)}</dd>
              <dt>{t('record.valueSource')}</dt><dd>{t(`record.${draft.valuationSource}`)}</dd>
              {draft.category !== 'debt' && <><dt>{t('record.access')}</dt><dd>{t(`record.${draft.access === 'unknown' ? 'unsure' : draft.access}`)}</dd></>}
              {Object.entries(draft.details).filter(([, value]) => value !== '' && value !== null).map(([key, value]) => {
                const labels: Record<string, string> = { weightGrams: 'weight', purity: 'purity', agreementType: 'investmentType', ownershipPct: 'ownership', status: 'applicationStatus', refundedAmount: 'refunded', symbol: 'symbol', stockunits: 'shares', units: 'units', network: 'network', accountType: 'accountType', institution: 'location', issuer: 'issuer', maturityDate: 'maturity', couponRate: 'coupon', borrower: 'borrower', dueDate: 'repayment', creditor: 'creditor', interestRate: 'interestRate', address: 'address' };
                const display = key === 'agreementType' ? ux(value === 'equity' ? 'equity' : value === 'loan' ? 'loan' : 'gift') : key === 'status' ? ux(value === 'applied' ? 'ipoPending' : 'ipoAllocated') : key === 'purity' ? t('record.customPurity', { percent: Number(value) * 100 }) : String(value);
                return <div className="fe-review-detail" key={key}><dt>{t(`record.${labels[key]}`)}</dt><dd><bdi>{display}</bdi></dd></div>;
              })}
              {draft.location && <><dt>{t('record.location')}</dt><dd><bdi>{draft.location}</bdi></dd></>}
              {draft.notes && <><dt>{t('record.noteTitle')}</dt><dd><bdi>{draft.notes}</bdi></dd></>}
            </dl>
          </div>}
          {error && <div role="alert" className="fe-error"><AlertCircle />{localizedError(error)}</div>}
          <DialogFooter className="fe-form-footer">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('record.cancel')}</Button>
            {step > (record ? 1 : 0) && <Button type="button" variant="outline" onClick={() => { setError(''); setStep(step - 1); }}>{ux('back')}</Button>}
            <Button type="submit" disabled={busy}>{step === 2 && <Check />}{busy ? t('record.saving') : step === 0 ? ux('next') : step === 1 ? ux('reviewEntry') : record ? doc.isSample ? ux('sampleSave') : t('record.saveChanges') : t('record.addButton')}</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  );
}

export function ActivityEditor({ open, onOpenChange, record, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; record?: FinanceRecord; onSaved?: () => void;
}) {
  const { t } = useTranslation('editor');
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
    <DialogHeader className="finance-dialog-header"><div className="fe-dialog-eyebrow">{t('activity.eyebrow')}</div><DialogTitle>{t('activity.title')}</DialogTitle><DialogDescription>{t('activity.description')}</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="fe-form">
      <label className="fe-field"><span>{t('activity.relatedTo')}</span><select className="fe-select" required value={recordId} onChange={(e) => { const nextId = e.target.value; setRecordId(nextId); const target = doc.records.find((item) => item.id === nextId); setType(target?.category === 'debt' || target?.category === 'lent' ? 'repayment' : 'contribution'); }}>{doc.records.map((item) => <option dir="auto" key={item.id} value={item.id}>{item.name} · {item.currency}</option>)}</select></label>
      <div className="fe-form-grid">
        <label className="fe-field"><span>{t('activity.whatHappened')}</span><select className="fe-select" value={type} onChange={(e) => setType(e.target.value as typeof type)}>{isLiability ? <><option value="repayment">{selected?.category === 'debt' ? t('activity.debtPayment') : t('activity.repaymentReceived')}</option><option value="valuation">{t('activity.updateBalance')}</option></> : <><option value="contribution">{t('activity.addedMoney')}</option><option value="withdrawal">{t('activity.withdrawal')}</option><option value="income">{t('activity.distribution')}</option><option value="fee">{t('activity.fee')}</option><option value="valuation">{t('activity.updateValue')}</option></>}</select></label>
        <label className="fe-field"><span>{t('activity.amount', { currency: selected?.currency || doc.baseCurrency })}</span><input className="fe-input" type="number" min={type === 'valuation' ? 0 : 10 ** -currencyMinorUnits(selected?.currency || doc.baseCurrency)} step="any" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
        <label className="fe-field"><span>{t('activity.date')}</span><input className="fe-input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="fe-field"><span>{t('activity.shortNote')} <em>{t('record.optional')}</em></span><input className="fe-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={credit ? t('activity.interestExample') : t('activity.depositExample')} /></label>
      </div>
      <div className="fe-activity-explain">{type === 'valuation' ? <Check /> : credit ? <ArrowDownLeft /> : <ArrowUpRight />}<span>{type === 'repayment' ? t('activity.repaymentHelp') : type === 'valuation' ? t('activity.valuationHelp') : type === 'income' ? t('activity.incomeHelp') : t('activity.activityHelp')}</span></div>
      {error && <div role="alert" className="fe-error"><AlertCircle />{localizedError(error)}</div>}
      <DialogFooter className="fe-form-footer"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('record.cancel')}</Button><Button type="submit" disabled={saving || !doc.records.length}><Plus />{saving ? t('record.saving') : t('activity.save')}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
