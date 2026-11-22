import { recordBaseValue, STALE_AFTER_DAYS, type FinanceDocument, type FinanceRecord } from './finance-model.ts';

export type ReviewReason = 'missingValue' | 'missingRate' | 'stale';

export function valuationAge(record: FinanceRecord, now = Date.now()) {
  if (record.value === null || record.valuationDate === '1970-01-01') return null;
  const elapsed = now - Date.parse(`${record.valuationDate}T00:00:00.000Z`);
  return { days: Math.floor(elapsed / 86_400_000), stale: elapsed > STALE_AFTER_DAYS * 86_400_000 };
}

export function reviewFinance(document: FinanceDocument, now = Date.now()) {
  return document.records.flatMap((record) => {
    if (record.category === 'private' && record.details.agreementType === 'gift') return [];
    const reason: ReviewReason | null = record.value === null ? 'missingValue'
      : recordBaseValue(record, document) === null ? 'missingRate'
      : now - Date.parse(`${record.valuationDate}T00:00:00.000Z`) > STALE_AFTER_DAYS * 86_400_000 ? 'stale' : null;
    return reason ? [{ record, reason }] : [];
  });
}
