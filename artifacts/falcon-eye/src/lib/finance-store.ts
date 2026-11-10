import { useSyncExternalStore } from 'react';
import {
  appendActivity,
  emptyDocument,
  importLegacyPortfolio,
  newId,
  sampleDocument,
  validateDocument,
  type FinanceActivityInput,
  type FinanceDocument,
  type FinanceRecord,
  type FinanceRecordInput,
} from './finance-model.ts';

const STORAGE_KEY = 'falcon-eye:finance:v2';
const LEGACY_KEY = 'falcon-eye:v1';
const listeners = new Set<() => void>();
let storageError: string | null = null;
let corruptV2 = false;

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function setStorageError(message: string | null): void {
  storageError = message;
}

function persist(document: FinanceDocument, allowCorruptOverwrite = false): void {
  const storage = browserStorage();
  if (!storage) {
    setStorageError('Browser storage is unavailable. Changes are only in memory for this session.');
    return;
  }
  if (corruptV2 && !allowCorruptOverwrite) {
    setStorageError('Saved financial data is corrupt and was preserved. Use an explicit restore or reset action before replacing it.');
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(document));
    corruptV2 = false;
    setStorageError(null);
  } catch (error) {
    setStorageError(`Could not save financial data in this browser: ${error instanceof Error ? error.message : 'storage error'}`);
  }
}

function initialize(): FinanceDocument {
  const storage = browserStorage();
  if (!storage) {
    setStorageError('Browser storage is unavailable. Changes are only in memory for this session.');
    return sampleDocument();
  }

  let savedV2: string | null;
  try {
    savedV2 = storage.getItem(STORAGE_KEY);
  } catch (error) {
    setStorageError(`Could not read financial data from this browser: ${error instanceof Error ? error.message : 'storage error'}`);
    return sampleDocument();
  }
  if (savedV2 !== null) {
    try {
      const document = validateDocument(JSON.parse(savedV2));
      setStorageError(null);
      return document;
    } catch (error) {
      // Do not replace malformed data during module initialization: leave the
      // original string available for recovery and surface a visible warning.
      const warning = `Saved financial data could not be read and was preserved: ${error instanceof Error ? error.message : 'invalid data'}`;
      corruptV2 = true;
      setStorageError(warning);
      try {
        const legacyRaw = storage.getItem(LEGACY_KEY);
        if (legacyRaw !== null) return importLegacyPortfolio(JSON.parse(legacyRaw));
      } catch {
        // Keep the v2 warning and both raw values intact; an empty in-memory
        // document is safer than an unannounced replacement or failed boot.
      }
      return sampleDocument();
    }
  }

  let legacyRaw: string | null;
  try {
    legacyRaw = storage.getItem(LEGACY_KEY);
  } catch (error) {
    setStorageError(`Could not read the older portfolio data: ${error instanceof Error ? error.message : 'storage error'}`);
    return sampleDocument();
  }
  if (legacyRaw === null) {
    const document = sampleDocument();
    persist(document);
    return document;
  }

  try {
    const document = importLegacyPortfolio(JSON.parse(legacyRaw));
    // The legacy value is intentionally never modified or removed. Save the
    // new schema separately so users can recover their original portfolio.
    persist(document);
    return document;
  } catch (error) {
    setStorageError(`Older portfolio data was preserved but could not be imported: ${error instanceof Error ? error.message : 'invalid data'}`);
    return sampleDocument();
  }
}

let snapshot = initialize();

function publish(next: FinanceDocument, allowCorruptOverwrite = false): void {
  snapshot = validateDocument(next);
  persist(snapshot, allowCorruptOverwrite);
  listeners.forEach((listener) => listener());
}

function requiredRecord(id: string): FinanceRecord {
  const found = snapshot.records.find((entry) => entry.id === id);
  if (!found) throw new Error(`Financial record not found: ${id}`);
  return found;
}

export const financeStore = {
  getSnapshot: (): FinanceDocument => snapshot,
  getStorageError: (): string | null => storageError,
  add(input: FinanceRecordInput): string {
    if (snapshot.isSample) throw new Error('Start with an empty picture or replace the sample before adding personal records');
    const id = newId();
    publish({ ...snapshot, records: [...snapshot.records, { ...input, id }] });
    return id;
  },
  update(id: string, input: FinanceRecordInput): void {
    requiredRecord(id);
    publish({ ...snapshot, records: snapshot.records.map((entry) => entry.id === id ? { ...input, id } : entry) });
  },
  remove(id: string): void {
    requiredRecord(id);
    publish({
      ...snapshot,
      records: snapshot.records.filter((entry) => entry.id !== id),
      activities: snapshot.activities.filter((activity) => activity.recordId !== id),
    });
  },
  addActivity(input: FinanceActivityInput): string {
    const updated = appendActivity(snapshot, input);
    const id = updated.activities[updated.activities.length - 1].id;
    publish(updated);
    return id;
  },
  setBaseCurrency(currency: string): void {
    const nextCurrency = currency.toUpperCase();
    const validated = validateDocument({ ...snapshot, baseCurrency: nextCurrency });
    if (nextCurrency === snapshot.baseCurrency) return;
    if (!snapshot.records.length && !snapshot.activities.length) {
      publish({ ...validated, baseCurrency: nextCurrency, rates: {} });
      return;
    }
    const targetRate = snapshot.rates[nextCurrency];
    if (!targetRate) throw new Error(`Set a ${snapshot.baseCurrency} exchange rate for ${nextCurrency} before changing the base currency`);

    const rates: FinanceDocument['rates'] = {};
    for (const [code, quote] of Object.entries(snapshot.rates)) {
      if (code === nextCurrency) continue;
      const sourceRate = quote.rate;
      rates[code] = {
        rate: sourceRate / targetRate.rate,
        // A cross-rate is only as current as its older component.
        date: quote.date < targetRate.date ? quote.date : targetRate.date,
      };
    }
    rates[snapshot.baseCurrency] = { rate: 1 / targetRate.rate, date: targetRate.date };
    publish({ ...validated, rates, baseCurrency: nextCurrency });
  },
  setRate(currency: string, rate: number, date: string): void {
    const code = currency.toUpperCase();
    if (code === snapshot.baseCurrency) {
      if (rate !== 1) throw new Error(`The base currency ${code} always has an exchange rate of 1`);
      const rates = { ...snapshot.rates };
      delete rates[code];
      publish({ ...snapshot, rates });
      return;
    }
    publish({ ...snapshot, rates: { ...snapshot.rates, [code]: { rate, date } } });
  },
  replace(document: FinanceDocument): void {
    publish(validateDocument(document), true);
  },
  startEmpty(): void {
    publish({ ...emptyDocument(), baseCurrency: snapshot.baseCurrency, legacyImported: snapshot.legacyImported }, true);
  },
  importLegacy(): number {
    if (snapshot.legacyImported) return 0;
    const storage = browserStorage();
    if (!storage) throw new Error('Browser storage is unavailable; the older portfolio cannot be imported.');
    let raw: string | null;
    try {
      raw = storage.getItem(LEGACY_KEY);
    } catch (error) {
      throw new Error(`Could not read the older portfolio: ${error instanceof Error ? error.message : 'storage error'}`);
    }
    if (raw === null) return 0;
    let imported: FinanceDocument;
    try {
      imported = importLegacyPortfolio(JSON.parse(raw));
    } catch (error) {
      setStorageError(`Older portfolio data was preserved but could not be imported: ${error instanceof Error ? error.message : 'invalid data'}`);
      throw error;
    }
    // Do not replace current work with a legacy copy. Import only into an empty
    // current document; an existing data set is never silently merged twice.
    if (snapshot.records.length) return 0;
    const count = imported.records.length;
    publish({ ...imported, baseCurrency: snapshot.baseCurrency, rates: snapshot.rates });
    return count;
  },
  loadSample(): void {
    publish(sampleDocument(), true);
  },
};

export function useFinance(): FinanceDocument {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    financeStore.getSnapshot,
    financeStore.getSnapshot,
  );
}
