import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { FileUp, FileDown, PenLine, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell';
import { HoldingFields } from '@/components/holding-form';
import { TypeChip } from '@/components/allocation';
import { CSV_COLUMNS, type CsvResult, TEMPLATE_CSV, download, importCsv, money, qty, store } from '@/lib/portfolio';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ImportPage() {
  const [tab, setTab] = useState<'csv' | 'manual'>('csv');
  const [result, setResult] = useState<CsvResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const readFile = (f: File) => {
    if (!/\.csv$/i.test(f.name) && f.type !== 'text/csv') {
      setFileName(f.name);
      setResult({ headerError: 'That file is not a .csv file.', valid: [], errors: [] });
      return;
    }
    const r = new FileReader();
    r.onload = () => { setFileName(f.name); setResult(importCsv(String(r.result ?? ''))); };
    r.onerror = () => setResult({ headerError: 'The file could not be read.', valid: [], errors: [] });
    r.readAsText(f);
  };
  const clear = () => { setResult(null); setFileName(''); if (input.current) input.current.value = ''; };
  const blocked = !!result && (!!result.headerError || result.errors.length > 0 || result.valid.length === 0);

  return (
    <>
      <PageHeader kicker="Import" title="Bring it all in." actions={<Button variant="outline" onClick={() => download('falcon-eye-template.csv', TEMPLATE_CSV)} data-testid="button-download-template"><FileDown className="mr-1 h-4 w-4" />CSV template</Button>}>
        Upload a CSV exported from anywhere, or enter positions by hand. Nothing is sent anywhere; imports append to the holdings stored in this browser.
      </PageHeader>

      <div className="rise mb-6 inline-flex rounded-xl border border-border bg-card p-1">
        {([['csv', 'CSV upload', FileUp], ['manual', 'Manual entry', PenLine]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`tab-${k}`} className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all', tab === k ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <I className="h-4 w-4" />{l}
          </button>
        ))}
      </div>

      {tab === 'manual' ? (
        <div className="rise grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-5 text-lg font-bold">New holding</h2>
            <HoldingFields submitLabel="Add to portfolio" resetOnSubmit onSubmit={(h) => { store.add(h); toast({ title: `${h.symbol} added`, description: 'Form cleared for the next one.' }); }} />
          </div>
          <Tips />
        </div>
      ) : (
        <div className="rise grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <label
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
              className={cn('relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-card px-6 py-14 text-center transition-all', drag ? 'scale-[1.01] border-accent bg-accent/5' : 'border-input hover:border-primary/40')}
              data-testid="dropzone-csv"
            >
              <div className="contour absolute inset-0 opacity-70" />
              {drag && <div className="scanline absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-accent/20 to-transparent" />}
              <FileUp className="relative mb-3 h-9 w-9 text-primary" />
              <div className="relative font-bold">Drop a .csv here or click to browse</div>
              <div className="relative mt-1 text-sm text-muted-foreground">You'll preview every row before anything is saved.</div>
              <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }} data-testid="input-csv-file" />
            </label>

            {result && (
              <div className="rounded-2xl border border-card-border bg-card" data-testid="panel-preview">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm">{fileName}</div>
                    {!result.headerError && <div className="text-xs text-muted-foreground"><span className="text-[hsl(152_50%_30%)]">{result.valid.length} valid</span> · <span className={result.errors.length ? 'text-destructive' : ''}>{result.errors.length} with errors</span></div>}
                  </div>
                  <button onClick={clear} className="rounded-md p-1.5 hover:bg-secondary" aria-label="Clear file" data-testid="button-clear-file"><X className="h-4 w-4" /></button>
                </div>
                {result.headerError ? (
                  <div className="flex gap-3 p-5 text-sm text-destructive" data-testid="text-header-error"><AlertTriangle className="h-5 w-5 shrink-0" />{result.headerError}</div>
                ) : (
                  <>
                    {result.errors.length > 0 && (
                      <div className="border-b border-border bg-destructive/5 p-5">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />Fix these rows and re-upload. Nothing is imported while errors remain.</div>
                        <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
                          {result.errors.map((e) => (
                            <li key={e.line} data-testid={`error-row-${e.line}`}><span className="num mr-2 rounded bg-destructive/10 px-1.5 text-xs text-destructive">Row {e.line}</span>{e.messages.join('; ')}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.valid.length > 0 && (
                      <div className="max-h-72 overflow-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {result.valid.map(({ line, value: h }) => (
                              <tr key={line} className="border-b border-border/60 last:border-0">
                                <td className="num w-14 px-5 py-2 text-xs text-muted-foreground">{line}</td>
                                <td className="py-2"><span className="font-mono font-semibold">{h.symbol}</span> <span className="text-xs text-muted-foreground">{h.name}</span></td>
                                <td className="px-2 py-2"><TypeChip type={h.assetType} /></td>
                                <td className="num px-5 py-2 text-right">{qty(h.quantity)} x {money(h.currentPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 border-t border-border p-4">
                      <span className="text-sm text-muted-foreground">{blocked ? 'Import disabled until every row is valid.' : `Adds ${money(result.valid.reduce((a, r) => a + r.value.quantity * r.value.currentPrice, 0))} of value.`}</span>
                      <Button disabled={blocked} data-testid="button-confirm-import" onClick={() => {
                        store.addMany(result.valid.map((r) => r.value));
                        toast({ title: `Imported ${result.valid.length} holding${result.valid.length > 1 ? 's' : ''}`, description: 'Appended to your portfolio.' });
                        clear();
                        navigate('/holdings');
                      }}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />Import {result.valid.length} row{result.valid.length === 1 ? '' : 's'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <Tips />
        </div>
      )}
    </>
  );
}

function Tips() {
  return (
    <aside className="rounded-2xl bg-sidebar p-6 text-sidebar-foreground">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-primary">CSV schema</div>
      <code className="mt-3 block break-all rounded-lg bg-sidebar-accent p-3 font-mono text-xs leading-relaxed">{CSV_COLUMNS.join(',')}</code>
      <dl className="mt-5 space-y-3 text-sm">
        {[
          ['name, symbol', 'Required text. Wrap values containing commas in double quotes.'],
          ['assetType', 'One of Stocks, Crypto, Funds, Bonds, Cash.'],
          ['quantity', 'Required, finite, greater than 0.'],
          ['purchasePrice, currentPrice', 'USD per unit, 0 or more. $ and thousands commas are tolerated inside quotes.'],
          ['source', 'Optional label, e.g. which account it lives in.'],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="font-mono text-xs text-sidebar-primary">{k}</dt>
            <dd className="text-sidebar-foreground/75">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 border-t border-sidebar-border pt-4 text-xs text-sidebar-foreground/55">Imports are all-or-nothing: if any row fails validation, nothing is added. Rows append to existing holdings; nothing is overwritten.</p>
    </aside>
  );
}
