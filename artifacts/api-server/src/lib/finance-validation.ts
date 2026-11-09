export type FinanceCategory =
  | "cash" | "gold" | "stocks" | "funds" | "crypto" | "ipo"
  | "private" | "lent" | "bonds" | "property" | "debt";
export type FinanceRecord = {
  id: string;
  category: FinanceCategory;
  name: string;
  currency: string;
  cost: number | null;
  value: number | null;
  valuationDate: string;
  valuationSource: "manual" | "statement" | "estimate";
  access: "available" | "restricted" | "unknown";
  location: string;
  notes: string;
  details: Record<string, string | number | null>;
};
export type FinanceDocument = {
  schemaVersion: 1;
  records: FinanceRecord[];
  activities: Array<{
    id: string;
    recordId: string;
    type: "contribution" | "withdrawal" | "income" | "repayment" | "fee" | "valuation";
    date: string;
    amount: number;
    currency: string;
    note: string;
  }>;
  baseCurrency: string;
  rates: Record<string, { rate: number; date: string }>;
  isSample: false;
  legacyImported: boolean;
};

const categories = new Set<FinanceCategory>([
  "cash", "gold", "stocks", "funds", "crypto", "ipo", "private",
  "lent", "bonds", "property", "debt",
]);
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const boundedText = (value: unknown, max: number, optional = false): value is string =>
  (optional && value === undefined) ||
  (typeof value === "string" && value.length <= max && !/<\/?[a-z][^>]*>/i.test(value));
const currencyCodes = (Intl as typeof Intl & {
  supportedValuesOf?: (key: "currency") => string[];
}).supportedValuesOf?.("currency");
const validCurrency = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z]{3}$/.test(value) &&
  (currencyCodes ? currencyCodes.includes(value) : true);
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validAmount = (value: unknown, nullable = false): value is number | null =>
  (nullable && value === null) ||
  (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000);
const detailKeys: Record<FinanceCategory, string[]> = {
  cash: ["institution", "accountType"],
  gold: ["weightGrams", "purity"],
  stocks: ["symbol", "stockunits"],
  funds: ["symbol", "units"],
  crypto: ["symbol", "units", "network"],
  ipo: ["status", "refundedAmount"],
  private: ["agreementType", "ownershipPct"],
  lent: ["borrower", "dueDate"],
  bonds: ["symbol", "issuer", "maturityDate", "couponRate", "units"],
  property: ["ownershipPct", "address"],
  debt: ["creditor", "dueDate", "interestRate"],
};
const numericDetailKeys = new Set([
  "weightGrams", "purity", "ownershipPct", "refundedAmount", "couponRate", "interestRate",
]);
const dateDetailKeys = new Set(["dueDate", "maturityDate"]);
const enumDetailKeys = new Set(["agreementType", "status"]);

function validDetail(category: FinanceCategory, key: string, value: unknown): boolean {
  if (!detailKeys[category].includes(key)) return false;
  if (key === "agreementType") return ["equity", "loan", "gift"].includes(String(value));
  if (key === "status") return ["applied", "allocated"].includes(String(value));
  if (dateDetailKeys.has(key)) return value === null || validDate(value);
  if (numericDetailKeys.has(key)) {
    if (value === null) return true;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) return false;
    if (key === "purity" && value > 1) return false;
    return !["ownershipPct", "couponRate", "interestRate"].includes(key) || value <= 100;
  }
  if (value === null) return true;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000;
  return boundedText(value, 200, true);
}

function validRecord(value: unknown): value is FinanceRecord {
  if (!isObject(value) || !exactKeys(value, [
    "id", "category", "name", "currency", "cost", "value", "valuationDate",
    "valuationSource", "access", "location", "notes", "details",
  ])) return false;
  if (!boundedText(value.id, 100) || !value.id || !categories.has(value.category as FinanceCategory) ||
      !boundedText(value.name, 120) || !value.name || !validCurrency(value.currency) ||
      !validAmount(value.cost, true) || !validAmount(value.value, true) ||
      !validDate(value.valuationDate) ||
      !["manual", "statement", "estimate"].includes(String(value.valuationSource)) ||
      !["available", "restricted", "unknown"].includes(String(value.access)) ||
      !boundedText(value.location, 120) || !boundedText(value.notes, 1000) ||
      !isObject(value.details) || Object.keys(value.details).length > 50) return false;
  const category = value.category as FinanceCategory;
  if (!exactKeys(value.details, detailKeys[category])) return false;
  for (const [key, detail] of Object.entries(value.details)) {
    if (!validDetail(category, key, detail)) return false;
  }
  if (category === "gold" && (!own(value.details, "weightGrams") || !own(value.details, "purity"))) return false;
  if (category === "private" && !own(value.details, "agreementType")) return false;
  if (category === "ipo" && !own(value.details, "status")) return false;
  return true;
}

export function validateFinanceDocument(value: unknown): value is FinanceDocument {
  if (!isObject(value) || !exactKeys(value, [
    "schemaVersion", "records", "activities", "baseCurrency", "rates", "isSample", "legacyImported",
  ])) return false;
  if (value.schemaVersion !== 1 || value.isSample !== false ||
      typeof value.legacyImported !== "boolean" || !validCurrency(value.baseCurrency) ||
      !Array.isArray(value.records) || value.records.length > 10_000 ||
      !value.records.every(validRecord) || !Array.isArray(value.activities) ||
      value.activities.length > 50_000 || !isObject(value.rates) ||
      Object.keys(value.rates).length > 100) return false;

  const allIds = new Set<string>();
  const recordIds = new Set<string>();
  for (const record of value.records) {
    if (allIds.has(record.id)) return false;
    allIds.add(record.id);
    recordIds.add(record.id);
  }
  for (const activity of value.activities) {
    if (!isObject(activity) || !exactKeys(activity, [
      "id", "recordId", "type", "date", "amount", "currency", "note",
    ]) || !boundedText(activity.id, 100) || !activity.id || allIds.has(activity.id) ||
        !boundedText(activity.recordId, 100) || !activity.recordId || !recordIds.has(activity.recordId) ||
        !["contribution", "withdrawal", "income", "repayment", "fee", "valuation"].includes(String(activity.type)) ||
        !validDate(activity.date) || !validAmount(activity.amount) ||
        !validCurrency(activity.currency) || !boundedText(activity.note, 500)) return false;
    allIds.add(activity.id);
  }
  for (const [currency, rate] of Object.entries(value.rates)) {
    if (!validCurrency(currency) || !isObject(rate) || !exactKeys(rate, ["rate", "date"]) ||
      typeof rate.rate !== "number" || !Number.isFinite(rate.rate) ||
        rate.rate <= 0 || rate.rate > 1_000_000_000_000 || !validDate(rate.date)) return false;
  }
  return true;
}

export function validateFinanceRecordDraft(value: unknown): Record<string, unknown> | null {
  if (!isObject(value) || !exactKeys(value, [
    "id", "category", "name", "currency", "cost", "value", "valuationDate",
    "valuationSource", "access", "location", "notes", "details",
  ]) || Object.keys(value).length === 0) return null;
  if (own(value, "id") && (!boundedText(value.id, 100) || !value.id)) return null;
  if (own(value, "category") && !categories.has(value.category as FinanceCategory)) return null;
  if (own(value, "name") && (!boundedText(value.name, 120) || !value.name)) return null;
  if (own(value, "currency") && !validCurrency(value.currency)) return null;
  if (own(value, "cost") && !validAmount(value.cost, true)) return null;
  if (own(value, "value") && !validAmount(value.value, true)) return null;
  if (own(value, "valuationDate") && !validDate(value.valuationDate)) return null;
  if (own(value, "valuationSource") && !["manual", "statement", "estimate"].includes(String(value.valuationSource))) return null;
  if (own(value, "access") && !["available", "restricted", "unknown"].includes(String(value.access))) return null;
  if (own(value, "location") && !boundedText(value.location, 120)) return null;
  if (own(value, "notes") && !boundedText(value.notes, 1000)) return null;
  if (own(value, "details")) {
    if (!isObject(value.details) || Object.keys(value.details).length > 50) return null;
    for (const [key, detail] of Object.entries(value.details)) {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(key)) return null;
      const category = value.category as FinanceCategory | undefined;
      if (category && !validDetail(category, key, detail)) return null;
      if (!category && enumDetailKeys.has(key) &&
          !(key === "agreementType" ? ["equity", "loan", "gift"] : ["applied", "allocated"]).includes(String(detail))) return null;
      if (!category && dateDetailKeys.has(key) && detail !== null && !validDate(detail)) return null;
      if (!category && numericDetailKeys.has(key) &&
          !(detail === null || (typeof detail === "number" && Number.isFinite(detail) &&
            detail >= 0 && detail <= 1_000_000_000_000))) return null;
      if (!category && !enumDetailKeys.has(key) && !dateDetailKeys.has(key) &&
          !numericDetailKeys.has(key) && !(detail === null || boundedText(detail, 200, true))) return null;
    }
  }
  return value;
}
