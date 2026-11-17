import { Coins, HandCoins, HeartHandshake, House, Landmark, Ticket } from 'lucide-react';
import { AssetIcon } from './asset-icon';
import type { FinanceRecord } from '@/lib/finance-model';

export function FinanceAssetIcon({ record }: { record: FinanceRecord }) {
  const legacyTypes = { stocks: 'Stocks', crypto: 'Crypto', cash: 'Cash', funds: 'Funds', bonds: 'Bonds' } as const;
  if (record.category in legacyTypes) return <AssetIcon symbol={String(record.details.symbol ?? record.name)} assetType={legacyTypes[record.category as keyof typeof legacyTypes]} className="h-10 w-10 rounded-xl" />;
  const Icon = { gold: Coins, private: HeartHandshake, lent: HandCoins, property: House, debt: Landmark, ipo: Ticket }[record.category as 'gold' | 'private' | 'lent' | 'property' | 'debt' | 'ipo'] ?? Coins;
  return <span className={`fe-asset-category-icon fe-asset-${record.category}`} data-asset-icon={record.category} data-asset-kind="category"><Icon size={20} aria-hidden="true" /></span>;
}
