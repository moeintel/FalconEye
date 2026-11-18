import { recordBaseValue, STALE_AFTER_DAYS, type FinanceDocument } from './finance-model.ts';

export type ReviewReason = 'missingValue' | 'missingRate' | 'stale';

export function reviewFinance(document: FinanceDocument, now = Date.now()) {
  return document.records.flatMap((record) => {
    if (record.category === 'private' && record.details.agreementType === 'gift') return [];
    const reason: ReviewReason | null = record.value === null ? 'missingValue'
      : recordBaseValue(record, document) === null ? 'missingRate'
      : now - Date.parse(`${record.valuationDate}T00:00:00.000Z`) > STALE_AFTER_DAYS * 86_400_000 ? 'stale' : null;
    return reason ? [{ record, reason }] : [];
  });
}
