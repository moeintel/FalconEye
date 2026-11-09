import { useSyncExternalStore } from 'react';

export const ASSET_TYPES = ['Stocks', 'Crypto', 'Funds', 'Bonds', 'Cash'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export interface Holding {
  id: string;
  name: string;
  symbol: string;
  assetType: AssetType;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  source: string;
}

export type HoldingInput = Omit<Holding, 'id'>;

export const ASSET_COLORS: Record<AssetType, string> = {
  Stocks: 'hsl(212 52% 24%)',
  Crypto: 'hsl(39 92% 52%)',
  Funds: 'hsl(176 42% 38%)',
  Bonds: 'hsl(14 72% 56%)',
  Cash: 'hsl(214 20% 64%)',
};

const KEY = 'falcon-eye:v1';
const SAMPLE_SEED_KEY = 'falcon-eye:sample-seed:v1';

interface State {
  holdings: Holding[];
  isDemo: boolean;
  onboarded: boolean;
}

export const newId = () =>
  `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const demo: HoldingInput[] = [
  { name: 'Apple Inc.', symbol: 'AAPL', assetType: 'Stocks', quantity: 42, purchasePrice: 148.3, currentPrice: 227.52, source: 'Brokerage A (sample)' },
  { name: 'Microsoft Corp.', symbol: 'MSFT', assetType: 'Stocks', quantity: 18, purchasePrice: 312.75, currentPrice: 417.14, source: 'Brokerage A (sample)' },
  { name: 'NVIDIA Corp.', symbol: 'NVDA', assetType: 'Stocks', quantity: 64, purchasePrice: 46.2, currentPrice: 121.4, source: 'Brokerage B (sample)' },
  { name: 'Nike Inc.', symbol: 'NKE', assetType: 'Stocks', quantity: 30, purchasePrice: 112.6, currentPrice: 78.35, source: 'Brokerage B (sample)' },
  { name: 'Bitcoin', symbol: 'BTC', assetType: 'Crypto', quantity: 0.215, purchasePrice: 38420, currentPrice: 61870, source: 'Crypto wallet (sample)' },
  { name: 'Ethereum', symbol: 'ETH', assetType: 'Crypto', quantity: 3.4, purchasePrice: 2870.5, currentPrice: 2415.2, source: 'Crypto wallet (sample)' },
  { name: 'Vanguard Total Stock Market ETF', symbol: 'VTI', assetType: 'Funds', quantity: 55, purchasePrice: 201.1, currentPrice: 268.9, source: 'Retirement account (sample)' },
  { name: 'Fidelity 500 Index Fund', symbol: 'FXAIX', assetType: 'Funds', quantity: 38.6, purchasePrice: 142.8, currentPrice: 186.47, source: 'Retirement account (sample)' },
  { name: 'iShares Core US Aggregate Bond ETF', symbol: 'AGG', assetType: 'Bonds', quantity: 70, purchasePrice: 104.9, currentPrice: 98.62, source: 'Retirement account (sample)' },
  { name: 'US Treasury 2-Year Note', symbol: 'UST2Y', assetType: 'Bonds', quantity: 12, purchasePrice: 985, currentPrice: 992.4, source: 'Treasury account (sample)' },
  { name: 'High-yield savings', symbol: 'CASH', assetType: 'Cash', quantity: 1, purchasePrice: 8450, currentPrice: 8450, source: 'Bank (sample)' },
];

export const demoHoldings = (): Holding[] => demo.map((d, i) => ({ ...d, id: `demo_${i}` }));

function load(): State {
  let saved: State | undefined;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.holdings)) saved = { holdings: p.holdings, isDemo: !!p.isDemo, onboarded: !!p.onboarded };
    }
  } catch {
    /* fall through to demo */
  }
  let seededBefore = false;
  try { seededBefore = localStorage.getItem(SAMPLE_SEED_KEY) === '1'; } catch { /* storage unavailable */ }
  // Restore an old empty browser once, without replacing non-empty portfolios
  // or undoing a deliberate Reset to empty after this update.
  const shouldSeed = !saved || (!saved.holdings.length && !seededBefore);
  const initial = shouldSeed ? { holdings: demoHoldings(), isDemo: true, onboarded: true } : saved;
  try {
    localStorage.setItem(SAMPLE_SEED_KEY, '1');
    if (shouldSeed) localStorage.setItem(KEY, JSON.stringify(initial));
  } catch { /* in-memory sample data still works when storage is unavailable */ }
  return initial!;
}

let state: State = load();
const listeners = new Set<() => void>();
function set(next: Partial<State>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export const store = {
  add: (h: HoldingInput) => set({ holdings: [...state.holdings, { ...h, id: newId() }] }),
  addMany: (hs: HoldingInput[]) => set({ holdings: [...state.holdings, ...hs.map((h) => ({ ...h, id: newId() }))] }),
  update: (id: string, h: HoldingInput) => set({ holdings: state.holdings.map((x) => (x.id === id ? { ...h, id } : x)) }),
  remove: (id: string) => set({ holdings: state.holdings.filter((x) => x.id !== id) }),
  loadDemo: () => set({ holdings: demoHoldings(), isDemo: true, onboarded: true }),
  startEmpty: () => set({ holdings: [], isDemo: false, onboarded: true }),
  markOnboarded: () => set({ onboarded: true }),
};

export function usePortfolio() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/* ---------- Calculations ---------- */
export const value = (h: Holding) => h.quantity * h.currentPrice;
export const cost = (h: Holding) => h.quantity * h.purchasePrice;

export interface Summary {
  total: number;
  cost: number;
  gain: number;
  gainPct: number;
  count: number;
  byType: { type: AssetType; value: number; pct: number; count: number; gain: number }[];
  sorted: (Holding & { value: number; pct: number; gain: number; gainPct: number })[];
}

export function summarize(holdings: Holding[]): Summary {
  const total = holdings.reduce((s, h) => s + value(h), 0);
  const c = holdings.reduce((s, h) => s + cost(h), 0);
  const byType = ASSET_TYPES.map((type) => {
    const hs = holdings.filter((h) => h.assetType === type);
    const v = hs.reduce((s, h) => s + value(h), 0);
    return { type, value: v, pct: total ? (v / total) * 100 : 0, count: hs.length, gain: hs.reduce((s, h) => s + value(h) - cost(h), 0) };
  }).filter((t) => t.count > 0);
  const sorted = holdings
    .map((h) => {
      const v = value(h);
      const g = v - cost(h);
      return { ...h, value: v, pct: total ? (v / total) * 100 : 0, gain: g, gainPct: cost(h) ? (g / cost(h)) * 100 : 0 };
    })
    .sort((a, b) => b.value - a.value);
  return { total, cost: c, gain: total - c, gainPct: c ? ((total - c) / c) * 100 : 0, count: holdings.length, byType, sorted };
}

export type Tone = 'good' | 'watch' | 'risk';
export interface Insight {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  metric: string;
}

export function healthScore(s: Summary) {
  if (!s.count) return 0;
  const hhi = s.sorted.reduce((a, h) => a + (h.pct / 100) ** 2, 0);
  const top = s.sorted[0]?.pct ?? 0;
  const crypto = s.byType.find((t) => t.type === 'Crypto')?.pct ?? 0;
  let score = 100;
  score -= Math.max(0, hhi - 0.1) * 160;
  score -= Math.max(0, top - 20) * 0.9;
  score -= Math.max(0, crypto - 15) * 0.8;
  score -= Math.max(0, 4 - s.byType.length) * 6;
  return Math.max(5, Math.min(100, Math.round(score)));
}

export function buildInsights(s: Summary): Insight[] {
  if (!s.count) return [];
  const out: Insight[] = [];
  const top = s.sorted[0];
  const top3 = s.sorted.slice(0, 3).reduce((a, h) => a + h.pct, 0);
  out.push(
    top.pct > 25
      ? { id: 'top', tone: 'risk', title: `${top.symbol} dominates the portfolio`, detail: `A single position holds ${pct(top.pct)} of total value. A sharp move in ${top.name} would swing the whole portfolio.`, metric: pct(top.pct) }
      : top.pct > 15
        ? { id: 'top', tone: 'watch', title: `${top.symbol} is your largest position`, detail: `At ${pct(top.pct)} it is meaningful but not overwhelming. Keep an eye on it if it keeps growing.`, metric: pct(top.pct) }
        : { id: 'top', tone: 'good', title: 'No single position dominates', detail: `Your largest holding, ${top.symbol}, is ${pct(top.pct)} of value.`, metric: pct(top.pct) },
  );
  out.push({
    id: 'top3',
    tone: top3 > 60 ? 'risk' : top3 > 45 ? 'watch' : 'good',
    title: 'Top three concentration',
    detail: `${s.sorted.slice(0, 3).map((h) => h.symbol).join(', ')} together make up ${pct(top3)} of the portfolio.`,
    metric: pct(top3),
  });
  const n = s.byType.length;
  out.push({
    id: 'mix',
    tone: n >= 4 ? 'good' : n >= 2 ? 'watch' : 'risk',
    title: n >= 4 ? 'Broad asset-class mix' : 'Narrow asset-class mix',
    detail: `Holdings span ${n} of 5 tracked asset classes (${s.byType.map((t) => t.type).join(', ')}).`,
    metric: `${n}/5`,
  });
  const crypto = s.byType.find((t) => t.type === 'Crypto');
  if (crypto)
    out.push({
      id: 'crypto',
      tone: crypto.pct > 20 ? 'risk' : crypto.pct > 10 ? 'watch' : 'good',
      title: 'Crypto exposure',
      detail: `Crypto is ${pct(crypto.pct)} of value. It is typically the most volatile slice of a portfolio.`,
      metric: pct(crypto.pct),
    });
  const cash = s.byType.find((t) => t.type === 'Cash')?.pct ?? 0;
  out.push({
    id: 'cash',
    tone: cash < 2 ? 'watch' : cash > 30 ? 'watch' : 'good',
    title: cash < 2 ? 'Thin cash buffer' : cash > 30 ? 'Large idle cash position' : 'Cash buffer in range',
    detail: `Cash is ${pct(cash)} of tracked value.`,
    metric: pct(cash),
  });
  const losers = s.sorted.filter((h) => h.gain < 0);
  if (losers.length) {
    const worst = [...losers].sort((a, b) => a.gainPct - b.gainPct)[0];
    out.push({
      id: 'losers',
      tone: 'watch',
      title: `${losers.length} position${losers.length > 1 ? 's' : ''} below cost`,
      detail: `Largest relative drawdown: ${worst.symbol} at ${signedPct(worst.gainPct)} versus purchase price.`,
      metric: signedPct(worst.gainPct),
    });
  }
  const sources = new Set(s.sorted.map((h) => h.source.trim()).filter(Boolean));
  out.push({
    id: 'sources',
    tone: 'good',
    title: 'Consolidated view',
    detail: `You are seeing ${s.count} holdings from ${sources.size} source${sources.size === 1 ? '' : 's'} in one place.`,
    metric: String(sources.size),
  });
  return out;
}

/* ---------- Formatting ---------- */
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const money = (n: number) => usd.format(n);
export const money0 = (n: number) => usd0.format(n);
export const signedMoney = (n: number) => (n >= 0 ? '+' : '-') + usd.format(Math.abs(n));
export const pct = (n: number) => `${n.toFixed(1)}%`;
export const signedPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
export const qty = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 8 });

/* ---------- Validation ---------- */
export type FieldErrors = Partial<Record<keyof HoldingInput, string>>;
export function validateHolding(raw: Record<string, string>): { ok: true; value: HoldingInput } | { ok: false; errors: FieldErrors } {
  const e: FieldErrors = {};
  const name = (raw.name ?? '').trim();
  const symbol = (raw.symbol ?? '').trim().toUpperCase();
  const typeRaw = (raw.assetType ?? '').trim();
  const assetType = ASSET_TYPES.find((t) => t.toLowerCase() === typeRaw.toLowerCase());
  const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? NaN : Number(s.trim().replace(/[$,]/g, '')));
  const quantity = num(raw.quantity);
  const purchasePrice = num(raw.purchasePrice);
  const currentPrice = num(raw.currentPrice);
  if (!name) e.name = 'Name is required';
  if (!symbol) e.symbol = 'Symbol is required';
  if (!assetType) e.assetType = `Asset type must be one of ${ASSET_TYPES.join(', ')}`;
  if (!Number.isFinite(quantity) || quantity <= 0) e.quantity = 'Quantity must be a finite number above 0';
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) e.purchasePrice = 'Purchase price must be a number of 0 or more';
  if (!Number.isFinite(currentPrice) || currentPrice < 0) e.currentPrice = 'Current price must be a number of 0 or more';
  if (Object.keys(e).length) return { ok: false, errors: e };
  return { ok: true, value: { name, symbol, assetType: assetType!, quantity, purchasePrice, currentPrice, source: (raw.source ?? '').trim() || 'Manual entry' } };
}

/* ---------- CSV ---------- */
export const CSV_COLUMNS = ['name', 'symbol', 'assetType', 'quantity', 'purchasePrice', 'currentPrice', 'source'] as const;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = '';
  let q = false;
  const t = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface CsvResult {
  headerError?: string;
  valid: { line: number; value: HoldingInput }[];
  errors: { line: number; messages: string[] }[];
}

export function importCsv(text: string): CsvResult {
  const rows = parseCsv(text);
  if (!rows.length) return { headerError: 'The file is empty.', valid: [], errors: [] };
  const header = rows[0].map((h) => h.trim());
  const missing = CSV_COLUMNS.filter((c) => c !== 'source' && !header.includes(c));
  if (missing.length) return { headerError: `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Expected header: ${CSV_COLUMNS.join(',')}`, valid: [], errors: [] };
  if (rows.length === 1) return { headerError: 'The file has a header but no data rows.', valid: [], errors: [] };
  const res: CsvResult = { valid: [], errors: [] };
  rows.slice(1).forEach((r, i) => {
    const rec: Record<string, string> = {};
    header.forEach((h, j) => (rec[h] = r[j] ?? ''));
    const v = validateHolding(rec);
    if (v.ok) res.valid.push({ line: i + 2, value: v.value });
    else res.errors.push({ line: i + 2, messages: Object.values(v.errors) as string[] });
  });
  return res;
}

export function csvCell(v: string | number): string {
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(holdings: Holding[], withDerived = false): string {
  const head = [...CSV_COLUMNS, ...(withDerived ? ['marketValue', 'costBasis', 'gain'] : [])];
  const lines = holdings.map((h) =>
    [h.name, h.symbol, h.assetType, h.quantity, h.purchasePrice, h.currentPrice, h.source, ...(withDerived ? [value(h).toFixed(2), cost(h).toFixed(2), (value(h) - cost(h)).toFixed(2)] : [])]
      .map(csvCell)
      .join(','),
  );
  return [head.join(','), ...lines].join('\r\n');
}

export const TEMPLATE_CSV = [
  CSV_COLUMNS.join(','),
  '"Alphabet Inc., Class A",GOOGL,Stocks,12,128.40,163.25,Brokerage A',
  'Solana,SOL,Crypto,25,96.10,142.80,Crypto wallet',
  'Schwab US Dividend Equity ETF,SCHD,Funds,40,71.20,78.95,Retirement account',
].join('\r\n');

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
