import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Pencil, Plus, Search, Trash2, ArrowUpDown, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PageHeader } from '@/components/shell';
import { Gain, TypeChip } from '@/components/allocation';
import { HoldingDialog } from '@/components/holding-form';
import { ASSET_COLORS, ASSET_TYPES, type AssetType, type Holding, money, pct, qty, store, summarize, usePortfolio } from '@/lib/portfolio';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type SortKey = 'value' | 'gain' | 'name';

export default function Holdings() {
  const { holdings } = usePortfolio();
  const s = useMemo(() => summarize(holdings), [holdings]);
  const [q, setQ] = useState('');
  const [type, setType] = useState<AssetType | 'All'>('All');
  const [sort, setSort] = useState<SortKey>('value');
  const [editing, setEditing] = useState<Holding | undefined>();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Holding | null>(null);
  const { toast } = useToast();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return s.sorted
      .filter((h) => type === 'All' || h.assetType === type)
      .filter((h) => !term || [h.name, h.symbol, h.source].some((x) => x.toLowerCase().includes(term)))
      .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'gain' ? b.gainPct - a.gainPct : b.value - a.value));
  }, [s, q, type, sort]);
  const shownTotal = rows.reduce((a, h) => a + h.value, 0);

  return (
    <>
      <PageHeader kicker="Holdings" title="Every position, one ledger." actions={<Button onClick={() => { setEditing(undefined); setOpen(true); }} data-testid="button-add-holding"><Plus className="mr-1 h-4 w-4" />Add holding</Button>}>
        Search, filter, edit or remove. Changes save to this browser instantly and flow through to the dashboard and insights.
      </PageHeader>

      <div className="rise mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, symbol or source" className="bg-card pl-9" data-testid="input-search" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['All', ...ASSET_TYPES] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} data-testid={`filter-${t}`}
              className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all active:scale-95', type === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-input')}>
              {t !== 'All' && <span className="h-2 w-2 rounded-full" style={{ background: ASSET_COLORS[t] }} />}{t}
            </button>
          ))}
        </div>
        <button onClick={() => setSort(sort === 'value' ? 'gain' : sort === 'gain' ? 'name' : 'value')} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-input" data-testid="button-sort">
          <ArrowUpDown className="h-3.5 w-3.5" /> Sort: {sort === 'value' ? 'Value' : sort === 'gain' ? 'Return' : 'Name'}
        </button>
      </div>

      <div className="rise overflow-hidden rounded-2xl border border-card-border bg-card" style={{ animationDelay: '80ms' }}>
        {!holdings.length ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <h3 className="text-xl font-bold">No holdings yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Add your first position or import a CSV from your brokerage exports.</p>
            <div className="mt-5 flex gap-2">
              <Button onClick={() => { setEditing(undefined); setOpen(true); }} data-testid="button-empty-add">Add holding</Button>
              <Button variant="outline" asChild><Link href="/import" data-testid="link-empty-import">Import CSV</Link></Button>
            </div>
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <SearchX className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="font-bold">No matches</h3>
            <p className="text-sm text-muted-foreground">Nothing fits "{q}"{type !== 'All' ? ` in ${type}` : ''}.</p>
            <Button variant="ghost" className="mt-3" onClick={() => { setQ(''); setType('All'); }} data-testid="button-clear-filters">Clear filters</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Holding</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 text-right font-medium">Qty</th>
                  <th className="px-3 py-3 text-right font-medium">Buy / Now</th>
                  <th className="px-3 py-3 text-right font-medium">Value</th>
                  <th className="px-3 py-3 text-right font-medium">Gain</th>
                  <th className="px-3 py-3 text-right font-medium">Weight</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="group border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/50" data-testid={`row-holding-${h.id}`}>
                    <td className="px-5 py-3">
                      <div className="font-mono font-semibold">{h.symbol}</div>
                      <div className="max-w-[240px] truncate text-xs text-muted-foreground">{h.name} · {h.source}</div>
                    </td>
                    <td className="px-3 py-3"><TypeChip type={h.assetType} /></td>
                    <td className="num px-3 py-3 text-right">{qty(h.quantity)}</td>
                    <td className="num px-3 py-3 text-right text-xs"><div className="text-muted-foreground">{money(h.purchasePrice)}</div><div>{money(h.currentPrice)}</div></td>
                    <td className="num px-3 py-3 text-right font-semibold">{money(h.value)}</td>
                    <td className="px-3 py-3 text-right text-xs"><Gain v={h.gain} p={h.gainPct} /></td>
                    <td className="num px-3 py-3 text-right">{pct(h.pct)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                        <button onClick={() => { setEditing(h); setOpen(true); }} className="rounded-md p-2 hover:bg-background" aria-label={`Edit ${h.symbol}`} data-testid={`button-edit-${h.id}`}><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleting(h)} className="rounded-md p-2 text-destructive hover:bg-destructive/10" aria-label={`Delete ${h.symbol}`} data-testid={`button-delete-${h.id}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between border-t border-border bg-secondary/40 px-5 py-3 text-sm">
              <span className="text-muted-foreground">{rows.length} of {s.count} shown</span>
              <span className="num font-semibold" data-testid="text-shown-total">{money(shownTotal)}</span>
            </div>
          </div>
        )}
      </div>

      <HoldingDialog open={open} onOpenChange={setOpen} holding={editing} onSave={(h) => {
        if (editing) { store.update(editing.id, h); toast({ title: `${h.symbol} updated` }); }
        else { store.add(h); toast({ title: `${h.symbol} added` }); }
      }} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.symbol}?</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.name} will be removed from this browser's portfolio. Totals and insights recalculate immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete"
              onClick={() => { if (deleting) { store.remove(deleting.id); toast({ title: `${deleting.symbol} deleted` }); } setDeleting(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
