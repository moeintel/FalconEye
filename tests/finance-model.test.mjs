import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  addMoney,
  appendActivity,
  currencyMinorUnits,
  emptyDocument,
  formatMoney,
  goldFineWeightGrams,
  importLegacyPortfolio,
  recordBaseValue,
  sampleDocument,
  SUPPORTED_CURRENCIES,
  summarizeFinance,
  validateDocument,
} from '../artifacts/falcon-eye/src/lib/finance-model.ts';

const date = () => new Date().toISOString().slice(0, 10);
function makeRecord(overrides = {}) {
  return {
    id: 'r1',
    category: 'stocks',
    name: 'Example holding',
    currency: 'USD',
    cost: 60,
    value: 100,
    valuationDate: date(),
    valuationSource: 'manual',
    access: 'available',
    location: '',
    notes: '',
    details: {},
    ...overrides,
  };
}
function doc(records, extra = {}) {
  return validateDocument({ ...emptyDocument(), records, ...extra });
}
function activity(recordId, type, amount, overrides = {}) {
  return { recordId, type, date: date(), amount, currency: 'USD', note: '', ...overrides };
}

test('exports stable category metadata and sample records from the legacy 11 holdings', () => {
  assert.deepEqual(CATEGORIES.map(({ id }) => id), [
    'cash', 'gold', 'stocks', 'funds', 'crypto', 'ipo', 'private', 'lent', 'bonds', 'property', 'debt',
  ]);
  const sample = sampleDocument();
  assert.equal(sample.isSample, true);
  assert.equal(sample.records.length, 14);
  assert.equal(sample.records.filter(({ category }) => ['stocks', 'funds', 'crypto', 'bonds', 'cash'].includes(category)).length, 11);
  assert.equal(sample.records.find(({ category }) => category === 'debt').value, 148000);
  assert.equal(sample.records.find(({ category }) => category === 'private').details.agreementType, 'equity');
  assert.equal(sample.records.find(({ category }) => category === 'gold').details.weightGrams, 100);
});

test('summary converts FX, separates liabilities, tracks available/missing/stale values, and does not value unknowns at zero', () => {
  const data = doc([
    makeRecord({ id: 'eur', currency: 'EUR', value: 100, cost: null, access: 'restricted' }),
    makeRecord({ id: 'gbp', currency: 'GBP', value: 20 }),
    makeRecord({ id: 'cash', category: 'cash', value: 50, cost: 50 }),
    makeRecord({ id: 'unknown', category: 'gold', value: null, cost: null, details: { weightGrams: 10, purity: 0.999 } }),
    makeRecord({ id: 'debt', category: 'debt', value: 30, cost: null }),
  ], { rates: { EUR: { rate: 1.1, date: '2025-01-01' } } });
  const summary = summarizeFinance(data);
  assert.equal(summary.assets, 160);
  assert.equal(summary.debts, 30);
  assert.equal(summary.netWorth, 130);
  assert.equal(summary.available, 50);
  assert.equal(summary.missingValues, 1);
  assert.equal(summary.missingRates, 1);
  assert.equal(summary.byCategory.find(({ category }) => category === 'debt').value, -30);
});

test('old valuations are flagged stale while rates remain usable with their entered dates', () => {
  const data = doc([
    makeRecord({ id: 'old', value: 10, valuationDate: '2000-01-01' }),
    makeRecord({ id: 'new', value: 5, currency: 'EUR' }),
  ], { rates: { EUR: { rate: 1.1, date: '2000-01-01' } } });
  const summary = summarizeFinance(data);
  assert.equal(summary.staleValues, 1);
  assert.equal(summary.assets, 15.5, 'dated exchange rates are used rather than silently discarded or refreshed');
});

test('ownership is applied once and private gifts are excluded from all aggregates', () => {
  const property = makeRecord({ id: 'home', category: 'property', value: 50000, details: { ownershipPct: 25 } });
  const gift = makeRecord({ id: 'gift', category: 'private', value: 80000, cost: 0, details: { agreementType: 'gift' } });
  const data = doc([property, gift]);
  assert.equal(recordBaseValue(data.records[0], data), 50000);
  assert.equal(recordBaseValue(data.records[1], data), null);
  assert.equal(summarizeFinance(data).assets, 50000);
  assert.equal(summarizeFinance(data).byCategory.some(({ category }) => category === 'private'), false);
});

test('gold fine weight uses declared weight and purity without inventing a market valuation', () => {
  const gold = makeRecord({
    category: 'gold', value: null, cost: null, details: { weightGrams: 25, purity: 0.999 },
  });
  assert.equal(goldFineWeightGrams(gold), 24.975);
  const precise = doc([makeRecord({ category: 'gold', value: null, cost: null, details: { weightGrams: 25.0001, purity: 0.999 } })]);
  assert.equal(precise.records[0].details.purity, 0.999);
  assert.equal(goldFineWeightGrams(precise.records[0]), 24.9751);
  assert.equal(recordBaseValue(gold, doc([gold])), null);
});

test('IPO application refunds reduce pending exposure but allocated share value is not counted twice', () => {
  const applied = makeRecord({ category: 'ipo', value: 1000, details: { status: 'applied', refundedAmount: 250 } });
  const allocated = makeRecord({ id: 'allocated', category: 'ipo', value: 900, details: { status: 'allocated', refundedAmount: 250 } });
  assert.equal(summarizeFinance(doc([applied])).assets, 750);
  assert.equal(summarizeFinance(doc([allocated])).assets, 900);
  assert.throws(() => doc([makeRecord({ category: 'ipo', value: 100, details: { status: 'applied', refundedAmount: 101 } })]), /cannot exceed/);
});

test('activities change balances transactionally with proportional withdrawals and no implied performance', () => {
  let data = doc([
    makeRecord({ id: 'investment', cost: 60, value: 100 }),
    makeRecord({ id: 'loan', category: 'debt', cost: null, value: 100 }),
    makeRecord({ id: 'unknown', category: 'cash', cost: null, value: null }),
  ]);
  const originalValue = summarizeFinance(data).assets;
  data = appendActivity(data, activity('investment', 'contribution', 20));
  assert.equal(data.records.find(({ id }) => id === 'investment').cost, 80);
  assert.equal(data.records.find(({ id }) => id === 'investment').value, 120);
  data = appendActivity(data, activity('investment', 'withdrawal', 30));
  assert.equal(data.records.find(({ id }) => id === 'investment').cost, 60);
  assert.equal(data.records.find(({ id }) => id === 'investment').value, 90);
  data = appendActivity(data, activity('loan', 'repayment', 25));
  assert.equal(data.records.find(({ id }) => id === 'loan').value, 75);
  data = appendActivity(data, activity('unknown', 'contribution', 10));
  assert.equal(data.records.find(({ id }) => id === 'unknown').cost, null);
  assert.equal(data.records.find(({ id }) => id === 'unknown').value, null);
  assert.equal(data.activities.length, 4);
  assert.equal(originalValue, 100);
  assert.equal(summarizeFinance(data).assets, 90);
  assert.throws(() => appendActivity(data, activity('investment', 'repayment', 10)), /debt, lent-money, or private-loan/);
  assert.throws(() => appendActivity(data, activity('loan', 'repayment', 76)), /cannot exceed/);
  assert.throws(() => appendActivity(data, activity('loan', 'contribution', 10)), /cannot be applied to a debt/);
  assert.throws(() => appendActivity(data, activity('loan', 'withdrawal', 10)), /cannot be applied to a debt/);
  assert.equal(data.activities.length, 4, 'a failed activity must not partially modify the original document');
});

test('repayments reduce private loans and reject repayments beyond known balances', () => {
  const loan = makeRecord({ category: 'private', value: 50, details: { agreementType: 'loan' } });
  const initial = doc([loan]);
  const updated = appendActivity(initial, activity('r1', 'repayment', 15));
  assert.equal(updated.records[0].value, 35);
  assert.throws(() => appendActivity(updated, activity('r1', 'repayment', 36)), /cannot exceed/);
  assert.equal(updated.activities.length, 1);
});

test('valuation, income, fees, and FX conversion operate only on known values', () => {
  let data = doc([makeRecord({ id: 'eur', currency: 'EUR', value: 100, cost: 80 })], {
    rates: { EUR: { rate: 1.2, date: '2025-01-01' } },
  });
  data = appendActivity(data, activity('eur', 'income', 10, { currency: 'USD' }));
  assert.equal(data.records[0].value, 100, 'income is logged without assuming it was reinvested in the source holding');
  data = appendActivity(data, activity('eur', 'fee', 2, { currency: 'EUR' }));
  assert.equal(data.records[0].value, 98);
  data = appendActivity(data, activity('eur', 'valuation', 200, { currency: 'EUR', date: '2025-02-01' }));
  assert.equal(data.records[0].value, 200);
  assert.equal(data.records[0].valuationDate, '2025-02-01');
  const noRate = doc([makeRecord({ id: 'foreign', currency: 'CAD', value: 10 })]);
  assert.throws(() => appendActivity(noRate, activity('foreign', 'contribution', 1)), /Missing USD exchange rate/);
  assert.equal(appendActivity(noRate, activity('foreign', 'contribution', 1, { currency: 'CAD' })).records[0].value, 11);
  assert.equal(noRate.activities.length, 0);
});

test('document validation rejects invalid dates, unsafe text, unsupported detail keys, and non-finite money', () => {
  assert.throws(() => doc([makeRecord({ name: '<img src=x>' })]), /plain text/);
  assert.throws(() => doc([makeRecord({ valuationDate: '2025-02-30' })]), /ISO date/);
  assert.throws(() => doc([makeRecord({ details: { arbitrary: 'value' } })]), /unsupported field/);
  assert.throws(() => doc([makeRecord({ value: Number.POSITIVE_INFINITY })]), /finite amount/);
  assert.throws(() => doc([makeRecord({ category: 'gold', details: { weightGrams: 10 } })]), /require weightGrams and purity/);
});

test('currency formatting and decimal-safe cents helpers', () => {
  assert.equal(addMoney(0.1, 0.2), 0.3);
  assert.equal(formatMoney(1234.5, 'USD'), '$1,234.50');
  assert.ok(SUPPORTED_CURRENCIES.includes('AED'));
  assert.ok(SUPPORTED_CURRENCIES.includes('SAR'));
  assert.ok(SUPPORTED_CURRENCIES.includes('INR'));
  assert.throws(() => formatMoney(1, 'NOT'), /currency code/);
});

test('currency money precision follows ISO minor units through validation, FX, formatting, and activities', () => {
  assert.equal(currencyMinorUnits('USD'), 2);
  assert.equal(currencyMinorUnits('KWD'), 3);
  assert.equal(currencyMinorUnits('BHD'), 3);
  assert.equal(currencyMinorUnits('OMR'), 3);
  assert.equal(currencyMinorUnits('JPY'), 0);
  assert.equal(addMoney(0.001, 0.002, 3), 0.003);
  assert.match(formatMoney(1.234, 'KWD'), /1\.234$/);
  assert.match(formatMoney(1234.4, 'JPY'), /1,234$/);

  const kwdDebt = makeRecord({ id: 'kwd-debt', category: 'debt', currency: 'KWD', value: 0.0054, cost: null });
  const kwdRecord = makeRecord({ id: 'kwd-asset', category: 'cash', currency: 'KWD', value: 0.0014, cost: 0.0014 });
  let data = doc([kwdDebt, kwdRecord]);
  assert.equal(data.records[0].value, 0.005);
  assert.equal(data.records[1].value, 0.001);
  const kwdIpo = doc([makeRecord({
    id: 'kwd-ipo', category: 'ipo', currency: 'KWD', value: 0.0054, cost: null,
    details: { status: 'applied', refundedAmount: 0.0014 },
  })], { baseCurrency: 'KWD' });
  assert.equal(kwdIpo.records[0].details.refundedAmount, 0.001);
  assert.equal(summarizeFinance(kwdIpo).assets, 0.004);
  data = appendActivity(data, activity('kwd-debt', 'repayment', 0.001, { currency: 'KWD' }));
  assert.equal(data.records[0].value, 0.004);

  const fxData = doc([makeRecord({ id: 'kwd-target', category: 'cash', currency: 'KWD', value: 0.001, cost: 0.001 })], {
    baseCurrency: 'KWD',
    rates: { USD: { rate: 0.307, date: '2025-01-01' } },
  });
  assert.equal(summarizeFinance(fxData).assets, 0.001);
  const afterFxContribution = appendActivity(fxData, activity('kwd-target', 'contribution', 0.01, { currency: 'USD' }));
  assert.equal(afterFxContribution.records[0].value, 0.004);

  const jpy = doc([makeRecord({ id: 'jpy', category: 'cash', currency: 'JPY', value: 4.4, cost: 3.6 })]);
  assert.equal(jpy.records[0].value, 4);
  const afterJpyContribution = appendActivity(jpy, activity('jpy', 'contribution', 0.6, { currency: 'JPY' }));
  assert.equal(afterJpyContribution.records[0].value, 5);
  assert.equal(afterJpyContribution.records[0].cost, 5);
});

test('legacy conversion preserves the old holdings mapping and never includes the old demo as raw modern data', () => {
  const legacy = {
    isDemo: true,
    holdings: [{
      id: 'legacy-1', name: 'Old stock', symbol: 'OLD', assetType: 'Stocks',
      quantity: 2, purchasePrice: 10, currentPrice: 12, source: 'Brokerage',
    }],
  };
  const converted = importLegacyPortfolio(legacy);
  assert.equal(converted.legacyImported, true);
  assert.equal(converted.isSample, true);
  assert.equal(converted.records[0].category, 'stocks');
  assert.equal(converted.records[0].value, 24);
  assert.equal(converted.records[0].cost, 20);
  assert.equal(converted.records[0].details.stockunits, 2);
  assert.equal(converted.records[0].valuationDate, '1970-01-01');
  assert.equal(converted.records[0].valuationSource, 'manual');
  assert.match(converted.records[0].notes, /original valuation date unknown/i);
  assert.deepEqual(legacy.holdings[0], {
    id: 'legacy-1', name: 'Old stock', symbol: 'OLD', assetType: 'Stocks',
    quantity: 2, purchasePrice: 10, currentPrice: 12, source: 'Brokerage',
  });
});

test('browser store migrates legacy data without changing the original and never reseeds a deliberate reset', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const contents = new Map();
  const storage = {
    getItem: (key) => contents.has(key) ? contents.get(key) : null,
    setItem: (key, value) => contents.set(key, String(value)),
    removeItem: (key) => contents.delete(key),
    clear: () => contents.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const legacy = {
    isDemo: true,
    holdings: [{
      id: 'legacy-sample', name: 'Old holding', symbol: 'OLD', assetType: 'Stocks',
      quantity: 1, purchasePrice: 5, currentPrice: 6, source: 'Old broker',
    }],
  };
  const oldRaw = JSON.stringify(legacy);
  contents.set('falcon-eye:v1', oldRaw);
  try {
    const { financeStore } = await import(`../artifacts/falcon-eye/src/lib/finance-store.ts?migration=${Date.now()}`);
    assert.equal(financeStore.getSnapshot().records.length, 1);
    assert.equal(financeStore.getSnapshot().isSample, true);
    assert.equal(contents.get('falcon-eye:v1'), oldRaw);
    assert.ok(contents.has('falcon-eye:finance:v2'));
    financeStore.startEmpty();
    assert.equal(financeStore.getSnapshot().records.length, 0);
    assert.equal(financeStore.getSnapshot().legacyImported, true);
    const freshStore = await import(`../artifacts/falcon-eye/src/lib/finance-store.ts?reset=${Date.now()}`);
    assert.equal(freshStore.financeStore.getSnapshot().records.length, 0);
    assert.equal(freshStore.financeStore.importLegacy(), 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('malformed legacy data is preserved and exposed as a storage warning', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const contents = new Map([['falcon-eye:v1', '{not valid json']]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => contents.has(key) ? contents.get(key) : null,
      setItem: (key, value) => contents.set(key, String(value)),
    },
  });
  try {
    const { financeStore } = await import(`../artifacts/falcon-eye/src/lib/finance-store.ts?corrupt=${Date.now()}`);
    assert.equal(financeStore.getSnapshot().records.length, 14);
    assert.equal(financeStore.getSnapshot().isSample, true);
    assert.equal(contents.get('falcon-eye:v1'), '{not valid json');
    assert.match(financeStore.getStorageError(), /preserved/);
    assert.equal(contents.has('falcon-eye:finance:v2'), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('malformed v2 data is not replaced even when an older portfolio can be read', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const legacy = JSON.stringify({
    isDemo: false,
    holdings: [{
      id: 'legacy-safe', name: 'Older asset', symbol: 'SAFE', assetType: 'Cash',
      quantity: 1, purchasePrice: 20, currentPrice: 20, source: 'Bank',
    }],
  });
  const contents = new Map([
    ['falcon-eye:finance:v2', '{corrupt v2'],
    ['falcon-eye:v1', legacy],
  ]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => contents.has(key) ? contents.get(key) : null,
      setItem: (key, value) => contents.set(key, String(value)),
    },
  });
  try {
    const { financeStore } = await import(`../artifacts/falcon-eye/src/lib/finance-store.ts?corrupt-v2=${Date.now()}`);
    assert.equal(financeStore.getSnapshot().records[0].name, 'Older asset');
    assert.equal(contents.get('falcon-eye:finance:v2'), '{corrupt v2');
    assert.equal(contents.get('falcon-eye:v1'), legacy);
    assert.match(financeStore.getStorageError(), /preserved/);
    financeStore.add(makeRecord({ id: undefined, name: 'Added while sample is shown' }));
    assert.equal(financeStore.getSnapshot().isSample, false);
    assert.equal(contents.get('falcon-eye:finance:v2'), '{corrupt v2', 'ordinary edits must not silently overwrite corrupt storage');
    assert.match(financeStore.getStorageError(), /corrupt and was preserved/);
    financeStore.startEmpty();
    assert.deepEqual(JSON.parse(contents.get('falcon-eye:finance:v2')).records, []);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('fresh browsers show a persisted sample and normal edits never relabel it as personal data', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const contents = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => contents.has(key) ? contents.get(key) : null,
      setItem: (key, value) => contents.set(key, String(value)),
    },
  });
  try {
    const { financeStore } = await import(`../artifacts/falcon-eye/src/lib/finance-store.ts?fresh=${Date.now()}`);
    assert.equal(financeStore.getSnapshot().records.length, 14);
    assert.equal(financeStore.getSnapshot().isSample, true);
    assert.ok(contents.has('falcon-eye:finance:v2'));
    assert.throws(() => financeStore.add(makeRecord({ id: undefined, name: 'Personal item' })), /replace the sample/);
    const sampleRecord = financeStore.getSnapshot().records[0];
    financeStore.update(sampleRecord.id, { ...sampleRecord, name: 'Edited sample item' });
    assert.equal(financeStore.getSnapshot().isSample, true);
    financeStore.addActivity({ recordId: sampleRecord.id, type: 'contribution', date: date(), amount: 10, currency: 'USD', note: '' });
    assert.equal(financeStore.getSnapshot().isSample, true);
    financeStore.remove(sampleRecord.id);
    assert.equal(financeStore.getSnapshot().isSample, true);
    financeStore.startEmpty();
    assert.equal(financeStore.getSnapshot().isSample, false);
    const reopened = await import(`../artifacts/falcon-eye/src/lib/finance-store.ts?fresh-reopen=${Date.now()}`);
    assert.equal(reopened.financeStore.getSnapshot().records.length, 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('base currency accepts AED/SAR and converts dated user rates without inventing quotes', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const contents = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => contents.has(key) ? contents.get(key) : null,
      setItem: (key, value) => contents.set(key, String(value)),
    },
  });
  try {
    const { financeStore } = await import(`../artifacts/falcon-eye/src/lib/finance-store.ts?currency=${Date.now()}`);
    financeStore.replace(doc([makeRecord({ id: 'usd', currency: 'USD', value: 100, cost: 80 })]));
    assert.throws(() => financeStore.setBaseCurrency('AED'), /exchange rate for AED/);
    financeStore.setRate('AED', 0.27, '2025-01-02');
    financeStore.setBaseCurrency('AED');
    assert.equal(financeStore.getSnapshot().baseCurrency, 'AED');
    assert.equal(summarizeFinance(financeStore.getSnapshot()).assets, 370.37);
    financeStore.setRate('SAR', 0.266, '2025-01-03');
    financeStore.setBaseCurrency('SAR');
    assert.equal(financeStore.getSnapshot().baseCurrency, 'SAR');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});
