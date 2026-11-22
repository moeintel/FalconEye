import type { FinanceDocument } from './finance-model.ts';

export function downloadFinanceBackup(finance: FinanceDocument) {
  const blob = new Blob([JSON.stringify(finance, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'falcon-eye-backup.json';
  anchor.click();
  URL.revokeObjectURL(href);
}
