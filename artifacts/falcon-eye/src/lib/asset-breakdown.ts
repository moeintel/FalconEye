import { recordBaseValue, summarizeFinance, type FinanceDocument } from './finance-model.ts';

export function assetBreakdown(document: FinanceDocument) {
  const summary = summarizeFinance(document);
  const groups = summary.byCategory.filter((group) => group.category !== 'debt').map((group) => {
    const valuedCount = document.records.filter((record) =>
      record.category === group.category && recordBaseValue(record, document) !== null).length;
    return {
      ...group,
      valuedCount,
      excludedCount: group.count - valuedCount,
      share: summary.assets > 0 && valuedCount > 0 ? group.value / summary.assets : null,
    };
  });
  return {
    groups,
    total: summary.assets,
    count: groups.reduce((sum, group) => sum + group.count, 0),
    excludedCount: groups.reduce((sum, group) => sum + group.excludedCount, 0),
  };
}
