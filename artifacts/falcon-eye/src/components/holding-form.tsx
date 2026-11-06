import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ASSET_TYPES, ASSET_COLORS, type FieldErrors, type Holding, type HoldingInput, money, validateHolding } from '@/lib/portfolio';

type Raw = Record<keyof HoldingInput, string>;
const empty: Raw = { name: '', symbol: '', assetType: 'Stocks', quantity: '', purchasePrice: '', currentPrice: '', source: '' };
const toRaw = (h: Holding): Raw => ({ name: h.name, symbol: h.symbol, assetType: h.assetType, quantity: String(h.quantity), purchasePrice: String(h.purchasePrice), currentPrice: String(h.currentPrice), source: h.source });

export function HoldingFields({ initial, onSubmit, submitLabel, onCancel, resetOnSubmit }: { initial?: Holding; onSubmit: (h: HoldingInput) => void; submitLabel: string; onCancel?: () => void; resetOnSubmit?: boolean }) {
  const [raw, setRaw] = useState<Raw>(initial ? toRaw(initial) : empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    setRaw(initial ? toRaw(initial) : empty);
    setErrors({});
  }, [initial]);
  const set = (k: keyof Raw) => (v: string) => {
    setRaw((r) => ({ ...r, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const q = Number(raw.quantity), p = Number(raw.currentPrice), c = Number(raw.purchasePrice);
  const preview = Number.isFinite(q * p) && q > 0 ? q * p : null;
  const field = (k: keyof Raw, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${k}`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input id={`f-${k}`} value={raw[k]} onChange={(e) => set(k)(e.target.value)} aria-invalid={!!errors[k]} className={errors[k] ? 'border-destructive' : ''} data-testid={`input-${k}`} {...props} />
      {errors[k] && <p className="text-xs text-destructive" data-testid={`error-${k}`}>{errors[k]}</p>}
    </div>
  );
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const r = validateHolding(raw);
        if (!r.ok) return setErrors(r.errors);
        onSubmit(r.value);
        if (resetOnSubmit) setRaw(empty);
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
        {field('name', 'Name', { placeholder: 'Vanguard Total Stock Market ETF' })}
        {field('symbol', 'Symbol', { placeholder: 'VTI', className: `uppercase font-mono ${errors.symbol ? 'border-destructive' : ''}` })}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asset type</Label>
        <Select value={raw.assetType} onValueChange={set('assetType')}>
          <SelectTrigger data-testid="select-assetType"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ASSET_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ASSET_COLORS[t] }} />{t}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field('quantity', 'Quantity', { inputMode: 'decimal', placeholder: '10', className: 'font-mono' })}
        {field('purchasePrice', 'Buy price (USD)', { inputMode: 'decimal', placeholder: '201.10', className: 'font-mono' })}
        {field('currentPrice', 'Current price (USD)', { inputMode: 'decimal', placeholder: '268.90', className: 'font-mono' })}
      </div>
      {field('source', 'Source (optional)', { placeholder: 'Retirement account' })}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-sm text-muted-foreground">
          {preview !== null ? (
            <>Market value <span className="num font-semibold text-foreground">{money(preview)}</span>{Number.isFinite(c) && c >= 0 && raw.purchasePrice !== '' && <> · gain <span className={`num ${preview - q * c >= 0 ? 'text-[hsl(152_50%_32%)]' : 'text-destructive'}`}>{money(preview - q * c)}</span></>}</>
          ) : 'Enter a quantity and price to preview value'}
        </div>
        <div className="flex gap-2">
          {onCancel && <Button type="button" variant="ghost" onClick={onCancel} data-testid="button-cancel-holding">Cancel</Button>}
          <Button type="submit" data-testid="button-save-holding">{submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}

export function HoldingDialog({ open, onOpenChange, holding, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; holding?: Holding; onSave: (h: HoldingInput) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold">{holding ? `Edit ${holding.symbol}` : 'Add a holding'}</DialogTitle>
          <DialogDescription>All amounts in USD. Prices are entered by you; Falcon Eye does not fetch quotes.</DialogDescription>
        </DialogHeader>
        <HoldingFields initial={holding} submitLabel={holding ? 'Save changes' : 'Add holding'} onCancel={() => onOpenChange(false)} onSubmit={(h) => { onSave(h); onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}
