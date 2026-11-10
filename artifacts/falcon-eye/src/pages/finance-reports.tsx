import { type ReactNode, useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowDownToLine, ArrowUpRight, CircleAlert, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanceShell } from '@/components/finance-shell';
import { CATEGORIES, formatMoney, summarizeFinance } from '@/lib/finance-model';
import { financeStore, useFinance } from '@/lib/finance-store';

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(href);
}
function csvCell(value: unknown) {
  const raw = String(value ?? '');
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}
function exportCsv() {
  const doc = financeStore.getSnapshot();
  const columns = ['Name', 'Category', 'Currency', 'What you paid', 'Recorded value', 'Valuation date', 'Source', 'Access', 'Location', 'Notes'];
  const rows = doc.records.map((item) => [item.name, CATEGORIES.find((cat) => cat.id === item.category)?.label, item.currency, item.cost, item.value, item.valuationDate, item.valuationSource, item.access, item.location, item.notes]);
  download('falcon-eye-financial-records.csv', [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
function exportJson() {
  download('falcon-eye-financial-picture.json', JSON.stringify(financeStore.getSnapshot(), null, 2), 'application/json');
}

export default function FinanceReports({ accountStatus }: { accountStatus?: ReactNode }) {
  const doc = useFinance();
  const summary = useMemo(() => summarizeFinance(doc), [doc]);
  const assets = summary.byCategory.filter((item) => item.category !== 'debt' && item.value > 0).sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...assets.map((item) => item.value));
  const hasMissing = summary.missingValues + summary.missingRates > 0 || summary.staleValues > 0;
  return <FinanceShell accountStatus={accountStatus}>
    <div className="fe-breadcrumb">MY FINANCES <span>/</span> REPORTS</div>
    <div className="fe-assets-title-row fe-report-heading">
      <div><div className="fe-eyebrow">A CLEAR, PRINTABLE SNAPSHOT</div><h1>Your report</h1><p>See the numbers behind your picture. All totals use your base currency, {doc.baseCurrency}.</p></div>
      <div className="fe-report-actions"><Button variant="outline" onClick={() => window.print()}><Printer />Print / Save PDF</Button><Button onClick={exportCsv}><ArrowDownToLine />Download CSV</Button></div>
    </div>
    {doc.isSample && <div className="fe-sample-inline"><span className="fe-sample-dot" />Sample report · values are illustrative and not live market prices.</div>}
    {hasMissing && <div className="fe-data-alert"><CircleAlert /><div><b>This picture has gaps</b><span>{summary.missingValues ? `${summary.missingValues} items without values. ` : ''}{summary.missingRates ? `${summary.missingRates} values missing currency rates. ` : ''}{summary.staleValues ? `${summary.staleValues} values last updated over 90 days ago.` : ''}Incomplete values are not included in totals.</span></div><Link href="/settings">Check settings <ArrowUpRight /></Link></div>}
    <section className="fe-report-kpis">
      <div><span>ASSETS</span><b>{formatMoney(summary.assets, doc.baseCurrency)}</b><small>Known values converted to {doc.baseCurrency}</small></div>
      <div><span>DEBTS</span><b>{formatMoney(summary.debts, doc.baseCurrency)}</b><small>Outstanding balances</small></div>
      <div className="fe-kpi-emphasis"><span>NET WORTH</span><b>{formatMoney(summary.netWorth, doc.baseCurrency)}</b><small>Assets minus debts</small></div>
    </section>
    <div className="fe-report-grid">
      <section className="fe-panel fe-report-allocation">
        <div className="fe-section-heading"><div><div className="fe-eyebrow">ASSETS ONLY</div><h2>By type</h2></div><span className="fe-report-unit">{doc.baseCurrency}</span></div>
        {assets.length ? <div className="fe-report-bars">{assets.map((entry, index) => <div className="fe-report-bar-row" key={entry.category}>
          <div className="fe-report-bar-label"><span><i className={`fe-category-mark tone-${index % 5}`} />{entry.label}</span><b>{formatMoney(entry.value, doc.baseCurrency)}</b></div>
          <div className="fe-report-bar"><i style={{ width: `${entry.value / max * 100}%` }} /></div><small>{summary.assets ? `${(entry.value / summary.assets * 100).toFixed(1)}% of known assets` : 'No known value'}</small>
        </div>)}</div> : <div className="fe-report-empty">Add records with known values to see a breakdown.</div>}
      </section>
      <section className="fe-panel fe-report-notes">
        <div className="fe-section-heading"><div><div className="fe-eyebrow">A NOTE ON THE TOTALS</div><h2>What’s included</h2></div><ShieldCheck /></div>
        <ul className="fe-report-rules">
          <li><span>01</span><p><b>Only known values</b> are added. Unknown values stay unknown—not zero.</p></li>
          <li><span>02</span><p><b>Rates are yours to enter.</b> Foreign currencies need your own conversion rate.</p></li>
          <li><span>03</span><p><b>Dates matter.</b> A value older than 90 days is marked for review.</p></li>
          <li><span>04</span><p><b>Your ownership share only.</b> Property is not multiplied again by its share.</p></li>
        </ul>
        <Link className="fe-inline-link fe-settings-report-link" href="/settings">Currency and storage settings <ArrowUpRight /></Link>
      </section>
    </div>
    <section className="fe-report-export">
      <div><div className="fe-eyebrow">TAKE YOUR DATA WITH YOU</div><h2>Your data is yours</h2><p>Download your full financial picture as JSON, or a spreadsheet-ready CSV of your records.</p></div>
      <div><Button variant="outline" onClick={exportCsv}><ArrowDownToLine />Export CSV</Button><Button variant="outline" onClick={exportJson}><ArrowDownToLine />Export JSON</Button></div>
    </section>
    <p className="fe-report-disclaimer">Falcon Eye is an organizer, not a bank, broker, tax tool, or financial adviser. This report reflects only what you entered.</p>
  </FinanceShell>;
}
