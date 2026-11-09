import { Banknote, Building2, CircleDollarSign, Landmark, Layers } from 'lucide-react';
import { SiApple, SiBitcoin, SiEthereum, SiGoogle, SiMeta, SiNike, SiNvidia, SiSolana, SiTesla } from 'react-icons/si';
import type { IconType } from 'react-icons';
import type { AssetType } from '@/lib/portfolio';
import { cn } from '@/lib/utils';

const MARKS: Record<string, { icon: IconType; color: string; background: string }> = {
  'Crypto:BTC': { icon: SiBitcoin, color: '#fff', background: '#F7931A' },
  'Crypto:ETH': { icon: SiEthereum, color: '#5365B1', background: '#EDF0FC' },
  'Crypto:SOL': { icon: SiSolana, color: '#7047C6', background: '#F1EBFB' },
  'Stocks:AAPL': { icon: SiApple, color: '#20242A', background: '#EFF0F2' },
  'Stocks:NVDA': { icon: SiNvidia, color: '#548200', background: '#F0F6E6' },
  'Stocks:NKE': { icon: SiNike, color: '#20242A', background: '#EFF0F2' },
  'Stocks:TSLA': { icon: SiTesla, color: '#C72A36', background: '#FBEDEF' },
  'Stocks:GOOG': { icon: SiGoogle, color: '#356CC4', background: '#EEF3FC' },
  'Stocks:GOOGL': { icon: SiGoogle, color: '#356CC4', background: '#EEF3FC' },
  'Stocks:META': { icon: SiMeta, color: '#0967CF', background: '#EAF3FF' },
};
const FALLBACK = { Stocks: Building2, Crypto: CircleDollarSign, Funds: Layers, Bonds: Landmark, Cash: Banknote };

/** Bundled vector marks only: never send private portfolio symbols to an image service. */
export function AssetIcon({ symbol, assetType, className }: { symbol: string; assetType: AssetType; className?: string }) {
  const ticker = symbol.trim().toUpperCase();
  const mark = MARKS[`${assetType}:${ticker}`];
  const Icon = mark?.icon ?? FALLBACK[assetType] ?? Building2;
  const microsoft = assetType === 'Stocks' && ticker === 'MSFT';
  return (
    <span aria-hidden="true" data-asset-icon={ticker} data-asset-kind={mark || microsoft ? 'brand' : 'category'}
      className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-secondary text-primary print:h-6 print:w-6 print:rounded-md', className)}
      style={mark ? { color: mark.color, backgroundColor: mark.background } : undefined}>
      {microsoft ? (
        <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" focusable="false">
          <path fill="#F25022" d="M1 1h10v10H1z" /><path fill="#7FBA00" d="M13 1h10v10H13z" />
          <path fill="#00A4EF" d="M1 13h10v10H1z" /><path fill="#FFB900" d="M13 13h10v10H13z" />
        </svg>
      ) : <Icon className="h-[19px] w-[19px]" focusable="false" />}
    </span>
  );
}
