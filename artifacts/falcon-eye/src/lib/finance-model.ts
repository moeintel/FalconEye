export const CATEGORIES = [
  { id: 'cash', label: 'Cash', description: 'Cash, savings, and deposit accounts.' },
  { id: 'gold', label: 'Gold', description: 'Physical or allocated gold holdings.' },
  { id: 'stocks', label: 'Stocks', description: 'Publicly traded shares.' },
  { id: 'funds', label: 'Funds', description: 'Mutual funds and exchange-traded funds.' },
  { id: 'crypto', label: 'Crypto', description: 'Cryptocurrency and digital assets.' },
  { id: 'ipo', label: 'IPO', description: 'IPO applications or allocated shares; record one exposure only.' },
  { id: 'private', label: 'Private investment', description: 'Private equity, loans, or gifts.' },
  { id: 'lent', label: 'Money lent', description: 'Outstanding principal owed to you.' },
  { id: 'bonds', label: 'Bonds', description: 'Government and corporate bonds.' },
  { id: 'property', label: 'Property', description: 'Your ownership share of real estate.' },
  { id: 'debt', label: 'Debt', description: 'Outstanding liabilities, stored as a positive balance.' },
] as const;

export type Category = (typeof CATEGORIES)[number]['id'];
export type ValuationSource = 'manual' | 'statement' | 'estimate';
export type Access = 'available' | 'restricted' | 'unknown';
export type FinanceRecord = {
  id: string;
  category: Category;
  name: string;
  currency: string;
  cost: number | null;
  value: number | null;
  valuationDate: string;
  valuationSource: ValuationSource;
  access: Access;
  location: string;
  notes: string;
  details: Record<string, string | number | null>;
};
export type FinanceActivity = {
  id: string;
  recordId: string;
  type: 'contribution' | 'withdrawal' | 'income' | 'repayment' | 'fee' | 'valuation';
  date: string;
  amount: number;
  currency: string;
  note: string;
};
export type FinanceDocument = {
  schemaVersion: 1;
  records: FinanceRecord[];
  activities: FinanceActivity[];
  baseCurrency: string;
  rates: Record<string, { rate: number; date: string }>;
  isSample: boolean;
  legacyImported: boolean;
};
export type FinanceRecordInput = Omit<FinanceRecord, 'id'>;
export type FinanceActivityInput = Omit<FinanceActivity, 'id'>;
export type FinanceSummary = {
  assets: number;
  debts: number;
  netWorth: number;
  available: number;
  missingValues: number;
  missingRates: number;
  staleValues: number;
  byCategory: { category: Category; label: string; value: number; count: number }[];
};

export const SUPPORTED_CURRENCIES = Array.from(new Set([
  ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : ['USD', 'EUR', 'GBP', 'AED', 'SAR']),
  'AED',
  'SAR',
])).sort();

const MAX_AMOUNT = 1_000_000_000_000;
const MAX_TEXT = 500;
const DAY = 86_400_000;
const STALE_AFTER_DAYS = 90;
const DETAIL_KEYS: Record<Category, readonly string[]> = {
  cash: ['institution', 'accountType'],
  gold: ['weightGrams', 'purity'],
  stocks: ['symbol', 'stockunits'],
  funds: ['symbol', 'units'],
  crypto: ['symbol', 'units', 'network'],
  ipo: ['status', 'refundedAmount'],
  private: ['agreementType', 'ownershipPct'],
  lent: ['borrower', 'dueDate'],
  bonds: ['symbol', 'issuer', 'maturityDate', 'couponRate', 'units'],
  property: ['ownershipPct', 'address'],
  debt: ['creditor', 'dueDate', 'interestRate'],
};

export function newId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function currencyMinorUnits(currency: string): number {
  currencyCode(currency, 'Currency');
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function roundMoney(value: number, precision = 2): number {
  if (!Number.isFinite(value)) throw new Error('Money amount must be finite');
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) throw new Error('Money precision must be an integer from 0 to 6');
  const scale = 10 ** precision;
  // EPSILON corrects common binary representations such as 1.005.
  const adjusted = value + Math.sign(value) * Number.EPSILON * Math.max(1, Math.abs(value));
  return Math.round(adjusted * scale) / scale;
}
export const addMoney = (a: number, b: number, precision = 2) => roundMoney(roundMoney(a, precision) + roundMoney(b, precision), precision);
export const subtractMoney = (a: number, b: number, precision = 2) => roundMoney(roundMoney(a, precision) - roundMoney(b, precision), precision);
export const multiplyMoney = (a: number, b: number, precision = 2) => roundMoney(a * b, precision);

const record = (
  category: Category, name: string, cost: number | null, value: number | null, details: FinanceRecord['details'] = {},
  id?: string,
): FinanceRecord => ({
  id: id ?? newId(), category, name, currency: 'USD', cost, value, valuationDate: '2025-01-15',
  valuationSource: 'estimate', access: 'available', location: 'Sample portfolio', notes: 'Illustrative sample value; not a live quote.',
  details,
});

const legacySamples = [
  ['stocks', 'Apple Inc.', 6228.6, 9555.84, { symbol: 'AAPL', stockunits: 42 }],
  ['stocks', 'Microsoft Corp.', 5629.5, 7508.52, { symbol: 'MSFT', stockunits: 18 }],
  ['stocks', 'NVIDIA Corp.', 2956.8, 7769.6, { symbol: 'NVDA', stockunits: 64 }],
  ['stocks', 'Nike Inc.', 3378, 2350.5, { symbol: 'NKE', stockunits: 30 }],
  ['crypto', 'Bitcoin', 8250.3, 13302.05, { symbol: 'BTC', units: 0.215 }],
  ['crypto', 'Ethereum', 9759.7, 8211.68, { symbol: 'ETH', units: 3.4 }],
  ['funds', 'Vanguard Total Stock Market ETF', 11060.5, 14789.5, { symbol: 'VTI', units: 55 }],
  ['funds', 'Fidelity 500 Index Fund', 5512.08, 7197.74, { symbol: 'FXAIX', units: 38.6 }],
  ['bonds', 'iShares Core US Aggregate Bond ETF', 7343, 6903.4, { symbol: 'AGG', units: 70 }],
  ['bonds', 'US Treasury 2-Year Note', 11820, 11908.8, { symbol: 'UST2Y', units: 12 }],
  ['cash', 'High-yield savings', 8450, 8450, { accountType: 'Savings' }],
] as const;

/** Sample values are explicitly illustrative, denominated in USD, and never persisted to a server. */
export function sampleDocument(): FinanceDocument {
  const records: FinanceRecord[] = legacySamples.map(([category, name, cost, value, details], index) =>
    record(category, name, cost, value, details, `sample_${index + 1}`));
  records.push(
    record('gold', 'Gold bullion', 5760, 6240, { weightGrams: 100, purity: 0.999 }, 'sample_gold'),
    record('private', 'Private company investment', 5000, 6800, { agreementType: 'equity', ownershipPct: 0.5 }, 'sample_private'),
    record('debt', 'Mortgage balance', 160000, 148000, { creditor: 'Sample lender' }, 'sample_debt'),
  );
  return validateDocument({ schemaVersion: 1, records, activities: [], baseCurrency: 'USD', rates: {}, isSample: true, legacyImported: false });
}

export function emptyDocument(): FinanceDocument {
  return { schemaVersion: 1, records: [], activities: [], baseCurrency: 'USD', rates: {}, isSample: false, legacyImported: false };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) throw new Error(`${label} must be an object`);
  return value;
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) throw new Error(`${label} contains unsupported field: ${extra[0]}`);
}
function text(value: unknown, label: string, max = MAX_TEXT, optional = false): string {
  if (typeof value !== 'string') throw new Error(`${label} must be text`);
  const trimmed = value.trim();
  if ((!optional && !trimmed) || trimmed.length > max || /<\/?[a-z][^>]*>/i.test(trimmed)) {
    throw new Error(`${label} must be plain text of ${optional ? 'at most ' : '1 to '}${max} characters`);
  }
  return trimmed;
}
function currencyCode(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) throw new Error(`${label} must be a three-letter uppercase currency code`);
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: value });
    if (!SUPPORTED_CURRENCIES.includes(value)) throw new Error('unknown currency');
  } catch { throw new Error(`${label} is not a supported currency code`); }
  return value;
}
function isoDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a valid ISO date (YYYY-MM-DD)`);
  }
  return value;
}
function amount(value: unknown, label: string, nullable = false, precision = 2): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) {
    throw new Error(`${label} must be a finite amount from 0 to ${MAX_AMOUNT}${nullable ? ' or null' : ''}`);
  }
  return roundMoney(value, precision);
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${label} must be one of ${allowed.join(', ')}`);
  return value as T;
}
function validateDetails(category: Category, input: unknown, moneyPrecision: number): FinanceRecord['details'] {
  const raw = requireObject(input, 'Record details');
  exactKeys(raw, DETAIL_KEYS[category], 'Record details');
  const details: FinanceRecord['details'] = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'agreementType') details[key] = enumValue(value, ['equity', 'loan', 'gift'], key);
    else if (key === 'status') details[key] = enumValue(value, ['applied', 'allocated'], key);
    else if ((key === 'dueDate' || key === 'maturityDate') && value !== null) details[key] = isoDate(value, key);
    else if (['weightGrams', 'purity', 'ownershipPct', 'refundedAmount', 'couponRate', 'interestRate'].includes(key)) {
      if (key === 'refundedAmount') {
        details[key] = amount(value, key, true, moneyPrecision);
        continue;
      }
      let parsed: number | null;
      if (value === null) parsed = null;
      else if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_AMOUNT) parsed = value;
      else throw new Error(`${key} must be a finite non-negative number or null`);
      if (parsed !== null && ((key === 'purity' && parsed > 1) || (key === 'ownershipPct' && parsed > 100) || (key === 'couponRate' && parsed > 100) || (key === 'interestRate' && parsed > 100))) {
        throw new Error(`${key} is outside its allowed range`);
      }
      details[key] = parsed;
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) throw new Error(`${key} must be a finite non-negative number`);
      details[key] = value;
    }
    else if (value === null) details[key] = null;
    else details[key] = text(value, key, 200, true);
  }
  if (category === 'gold') {
    if (details.weightGrams === undefined || details.purity === undefined) throw new Error('Gold details require weightGrams and purity');
  }
  if (category === 'private' && details.agreementType === undefined) throw new Error('Private investment details require agreementType');
  if (category === 'ipo' && details.status === undefined) throw new Error('IPO details require status');
  return details;
}

export function validateDocument(input: unknown): FinanceDocument {
  const raw = requireObject(input, 'Finance document');
  exactKeys(raw, ['schemaVersion', 'records', 'activities', 'baseCurrency', 'rates', 'isSample', 'legacyImported'], 'Finance document');
  if (raw.schemaVersion !== 1) throw new Error('Unsupported finance document schema version');
  if (!Array.isArray(raw.records) || !Array.isArray(raw.activities)) throw new Error('Finance records and activities must be arrays');
  if (raw.records.length > 10000 || raw.activities.length > 50000) throw new Error('Finance document exceeds the supported number of records or activities');
  const baseCurrency = currencyCode(raw.baseCurrency, 'Base currency');
  if (typeof raw.isSample !== 'boolean' || typeof raw.legacyImported !== 'boolean') throw new Error('Sample and legacy import flags must be boolean');

  const ids = new Set<string>();
  const records: FinanceRecord[] = raw.records.map((unknownRecord, index) => {
    const item = requireObject(unknownRecord, `Record ${index + 1}`);
    exactKeys(item, ['id', 'category', 'name', 'currency', 'cost', 'value', 'valuationDate', 'valuationSource', 'access', 'location', 'notes', 'details'], `Record ${index + 1}`);
    const category = enumValue(item.category, CATEGORIES.map(({ id }) => id), 'Category');
    const id = text(item.id, 'Record id', 100);
    if (ids.has(id)) throw new Error(`Duplicate record id: ${id}`);
    ids.add(id);
    const currency = currencyCode(item.currency, 'Record currency');
    const moneyPrecision = currencyMinorUnits(currency);
    const cost = amount(item.cost, 'Record cost', true, moneyPrecision);
    const value = amount(item.value, 'Record value', true, moneyPrecision);
    const details = validateDetails(category, item.details, moneyPrecision);
    if (category === 'ipo' && details.status === 'applied' && typeof details.refundedAmount === 'number' && value !== null && details.refundedAmount > value) {
      throw new Error('IPO refundedAmount cannot exceed the application value');
    }
    return {
      id, category, name: text(item.name, 'Record name', 120), currency,
      cost, value,
      valuationDate: isoDate(item.valuationDate, 'Valuation date'),
      valuationSource: enumValue(item.valuationSource, ['manual', 'statement', 'estimate'], 'Valuation source'),
      access: enumValue(item.access, ['available', 'restricted', 'unknown'], 'Access'),
      location: text(item.location, 'Location', 120, true), notes: text(item.notes, 'Notes', 1000, true), details,
    };
  });
  const activities: FinanceActivity[] = raw.activities.map((unknownActivity, index) => {
    const item = requireObject(unknownActivity, `Activity ${index + 1}`);
    exactKeys(item, ['id', 'recordId', 'type', 'date', 'amount', 'currency', 'note'], `Activity ${index + 1}`);
    const id = text(item.id, 'Activity id', 100);
    if (ids.has(id)) throw new Error(`Duplicate activity id: ${id}`);
    ids.add(id);
    const recordId = text(item.recordId, 'Activity record id', 100);
    if (!records.some((entry) => entry.id === recordId)) throw new Error(`Activity refers to missing record: ${recordId}`);
    const currency = currencyCode(item.currency, 'Activity currency');
    return {
      id, recordId, type: enumValue(item.type, ['contribution', 'withdrawal', 'income', 'repayment', 'fee', 'valuation'], 'Activity type'),
      date: isoDate(item.date, 'Activity date'), amount: amount(item.amount, 'Activity amount', false, currencyMinorUnits(currency))!,
      currency, note: text(item.note, 'Activity note', 500, true),
    };
  });
  const rawRates = requireObject(raw.rates, 'Currency rates');
  const rates: FinanceDocument['rates'] = {};
  for (const [currency, unknownRate] of Object.entries(rawRates)) {
    currencyCode(currency, 'Rate currency');
    const rate = requireObject(unknownRate, `Rate for ${currency}`);
    exactKeys(rate, ['rate', 'date'], `Rate for ${currency}`);
    const parsedRate = rate.rate;
    if (typeof parsedRate !== 'number' || !Number.isFinite(parsedRate) || parsedRate <= 0 || parsedRate > MAX_AMOUNT) {
      throw new Error(`Rate for ${currency} must be finite and greater than zero`);
    }
    rates[currency] = { rate: parsedRate, date: isoDate(rate.date, `Rate date for ${currency}`) };
  }
  return { schemaVersion: 1, records, activities, baseCurrency, rates, isSample: raw.isSample, legacyImported: raw.legacyImported };
}

function asBase(amountValue: number, currency: string, document: FinanceDocument): number | null {
  const precision = currencyMinorUnits(document.baseCurrency);
  if (currency === document.baseCurrency) return roundMoney(amountValue, precision);
  const rate = document.rates[currency];
  // Rates are base-currency units per one unit of foreign currency; date stays
  // attached to the user-entered rate and no quote is silently refreshed.
  return rate ? roundMoney(amountValue * rate.rate, precision) : null;
}
function isExcluded(record: FinanceRecord): boolean {
  return record.category === 'private' && record.details.agreementType === 'gift';
}

/** A record's value is already the user's share; ownershipPct is descriptive and is never multiplied again. */
export function recordBaseValue(entry: FinanceRecord, document: FinanceDocument): number | null {
  if (entry.value === null || isExcluded(entry)) return null;
  let localValue = entry.value;
  // For an IPO application, value is the gross applied amount; subtract cash
  // already refunded. For allocated shares, value is the shares alone and the
  // refund field is informational, avoiding a double count of application cash.
  if (entry.category === 'ipo' && entry.details.status === 'applied') {
    localValue = Math.max(0, subtractMoney(localValue, Number(entry.details.refundedAmount ?? 0), currencyMinorUnits(entry.currency)));
  }
  const converted = asBase(localValue, entry.currency, document);
  return converted === null ? null : entry.category === 'debt' ? -converted : converted;
}

export function summarizeFinance(document: FinanceDocument): FinanceSummary {
  let assets = 0;
  let debts = 0;
  let available = 0;
  let missingValues = 0;
  let missingRates = 0;
  let staleValues = 0;
  const precision = currencyMinorUnits(document.baseCurrency);
  const byCategory = CATEGORIES.map(({ id, label }) => ({ category: id, label, value: 0, count: 0 }));
  const now = Date.now();
  for (const entry of document.records) {
    if (isExcluded(entry)) continue;
    const group = byCategory.find(({ category }) => category === entry.category)!;
    group.count += 1;
    if (entry.value === null) {
      missingValues += 1;
      continue;
    }
    if (now - Date.parse(`${entry.valuationDate}T00:00:00.000Z`) > STALE_AFTER_DAYS * DAY) staleValues += 1;
    const baseValue = recordBaseValue(entry, document);
    if (baseValue === null) {
      if (entry.currency !== document.baseCurrency) missingRates += 1;
      continue;
    }
    group.value = addMoney(group.value, baseValue, precision);
    if (entry.category === 'debt') debts = addMoney(debts, -baseValue, precision);
    else {
      assets = addMoney(assets, baseValue, precision);
      if (entry.access === 'available') available = addMoney(available, baseValue, precision);
    }
  }
  return {
    assets, debts, netWorth: subtractMoney(assets, debts, precision), available, missingValues, missingRates, staleValues,
    byCategory: byCategory.filter(({ count }) => count > 0),
  };
}

export function formatMoney(value: number, currency: string): string {
  if (!Number.isFinite(value)) throw new Error('Money amount must be finite');
  currencyCode(currency, 'Currency');
  const precision = currencyMinorUnits(currency);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(roundMoney(value, precision));
}

function convertCurrency(value: number, from: string, to: string, document: FinanceDocument): number {
  const precision = currencyMinorUnits(to);
  if (from === to) return roundMoney(value, precision);
  const baseAmount = asBase(value, from, document);
  if (baseAmount === null) throw new Error(`Missing ${document.baseCurrency} exchange rate for ${from}`);
  if (to === document.baseCurrency) return baseAmount;
  const toRate = document.rates[to];
  if (!toRate) throw new Error(`Missing ${document.baseCurrency} exchange rate for ${to}`);
  return roundMoney(baseAmount / toRate.rate, precision);
}

/** Apply and append one event as a single validated operation; no activity is replayed by summary. */
export function appendActivity(document: FinanceDocument, input: FinanceActivityInput): FinanceDocument {
  const clean = validateDocument({ ...document, activities: [...document.activities, { ...input, id: newId() }] });
  const event = clean.activities[clean.activities.length - 1];
  const target = clean.records.find((entry) => entry.id === event.recordId)!;
  const amountInRecordCurrency = convertCurrency(event.amount, event.currency, target.currency, clean);
  const precision = currencyMinorUnits(target.currency);
  const nextRecord: FinanceRecord = { ...target };
  const currentValue = target.value;
  switch (event.type) {
    case 'repayment':
      if (target.category !== 'debt' && target.category !== 'lent' && !(target.category === 'private' && target.details.agreementType === 'loan')) {
        throw new Error('Repayment activities require a debt, lent-money, or private-loan record');
      }
      if (currentValue !== null) {
        if (amountInRecordCurrency > currentValue) throw new Error('Repayment cannot exceed the known outstanding balance');
        nextRecord.value = subtractMoney(currentValue, amountInRecordCurrency, precision);
      }
      break;
    case 'contribution':
      if (target.category === 'debt') throw new Error('Contributions cannot be applied to a debt record');
      if (target.cost !== null) nextRecord.cost = addMoney(target.cost, amountInRecordCurrency, precision);
      if (currentValue !== null) nextRecord.value = addMoney(currentValue, amountInRecordCurrency, precision);
      break;
    case 'withdrawal':
      if (target.category === 'debt') throw new Error('Withdrawals cannot be applied to a debt record');
      if (currentValue !== null) {
        if (amountInRecordCurrency > currentValue) throw new Error('Withdrawal cannot exceed the known available value');
        const withdrawn = amountInRecordCurrency;
        // Reduce basis only when both current value and cost are known, using
        // the pre-withdrawal value as a reliable proportional basis.
        if (target.cost !== null && currentValue > 0) {
          const basisReduction = multiplyMoney(target.cost, withdrawn / currentValue, precision);
          nextRecord.cost = Math.max(0, subtractMoney(target.cost, basisReduction, precision));
        }
        nextRecord.value = subtractMoney(currentValue, withdrawn, precision);
      }
      break;
    case 'income':
      // Income (such as a dividend) is logged but may be paid outside the
      // source holding; only a separately modeled reinvestment can change it.
      break;
    case 'fee':
      if (target.category === 'debt') {
        if (currentValue !== null) nextRecord.value = addMoney(currentValue, amountInRecordCurrency, precision);
      } else if (currentValue !== null) {
        if (amountInRecordCurrency > currentValue) throw new Error('Fee cannot exceed the known asset value');
        nextRecord.value = subtractMoney(currentValue, amountInRecordCurrency, precision);
      }
      break;
    case 'valuation':
      nextRecord.value = amountInRecordCurrency;
      nextRecord.valuationDate = event.date;
      nextRecord.valuationSource = 'manual';
      break;
  }
  const result = { ...clean, records: clean.records.map((entry) => entry.id === target.id ? nextRecord : entry) };
  return validateDocument(result);
}

/** Gold fine weight in grams, calculated only when both declared inputs exist. */
export function goldFineWeightGrams(entry: FinanceRecord): number | null {
  if (entry.category !== 'gold' || typeof entry.details.weightGrams !== 'number' || typeof entry.details.purity !== 'number') return null;
  return Math.round(entry.details.weightGrams * entry.details.purity * 10000) / 10000;
}

/** Convert known legacy holdings without modifying their original storage. */
export function importLegacyPortfolio(raw: unknown): FinanceDocument {
  const parsed = requireObject(raw, 'Legacy portfolio');
  if (!Array.isArray(parsed.holdings)) throw new Error('Legacy portfolio has no holdings array');
  const mapping: Record<string, Category> = { Stocks: 'stocks', Crypto: 'crypto', Funds: 'funds', Bonds: 'bonds', Cash: 'cash' };
  const records = parsed.holdings.map((holding, index) => {
    const item = requireObject(holding, `Legacy holding ${index + 1}`);
    const category = mapping[String(item.assetType)];
    if (!category) throw new Error(`Legacy holding ${index + 1} has an unsupported asset type`);
    for (const key of ['name', 'symbol', 'source']) if (typeof item[key] !== 'string') throw new Error(`Legacy holding ${index + 1} is missing ${key}`);
    for (const key of ['quantity', 'purchasePrice', 'currentPrice']) if (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || item[key] < 0) {
      throw new Error(`Legacy holding ${index + 1} has an invalid ${key}`);
    }
    const quantity = item.quantity as number;
    const name = text(item.name, 'Legacy name', 120);
    const details = category === 'cash'
      ? {}
      : { symbol: text(item.symbol, 'Legacy symbol', 40), ...(category === 'stocks' ? { stockunits: quantity } : { units: quantity }) };
    const entry = record(category, name, multiplyMoney(quantity, item.purchasePrice as number), multiplyMoney(quantity, item.currentPrice as number), details, text(item.id, 'Legacy id', 100));
    entry.location = text(item.source, 'Legacy source', 120, true);
    entry.valuationDate = '1970-01-01';
    entry.valuationSource = 'manual';
    entry.notes = parsed.isDemo
      ? 'Legacy sample value; original valuation date unknown.'
      : 'Original valuation date unknown; imported from browser portfolio.';
    return entry;
  });
  return validateDocument({
    ...emptyDocument(), records, isSample: Boolean(parsed.isDemo), legacyImported: true,
  });
}
