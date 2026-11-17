import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ASSET_COLORS, type Summary } from '@/lib/portfolio';
import { useTranslation } from 'react-i18next';
import { formatNumber, money, money0, pct } from '@/lib/locale';

const typeMessage = (type: string) => `assetTypes.${type.toLowerCase()}`;

export function AllocationDonut({ s, size = 260 }: { s: Summary; size?: number }) {
  const { t } = useTranslation('legacy');
  const [active, setActive] = useState<number | null>(null);
  const focus = active !== null ? s.byType[active] : null;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} data-testid="chart-allocation">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={s.byType} dataKey="value" nameKey="type" innerRadius="66%" outerRadius="96%" paddingAngle={2} stroke="none" isAnimationActive animationDuration={700} onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)}>
            {s.byType.map((t, i) => (
              <Cell key={t.type} fill={ASSET_COLORS[t.type]} opacity={active === null || active === i ? 1 : 0.35} style={{ transition: 'opacity .2s', cursor: 'pointer' }} />
            ))}
          </Pie>
          <Tooltip content={() => null} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{focus ? t(typeMessage(focus.type)) : t('allocation.total')}</div>
        <div className="num text-xl font-semibold">{focus ? pct(focus.pct) : money0(s.total)}</div>
        {focus && <div className="num text-xs text-muted-foreground">{money(focus.value)}</div>}
      </div>
    </div>
  );
}

export function AllocationLegend({ s }: { s: Summary }) {
  const { t: translate } = useTranslation('legacy');
  return (
    <ul className="space-y-3">
      {[...s.byType].sort((a, b) => b.value - a.value).map((t) => (
        <li key={t.type} data-testid={`legend-${t.type}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: ASSET_COLORS[t.type] }} />{translate(typeMessage(t.type))}<span className="text-xs text-muted-foreground">{formatNumber(t.count)}</span></span>
            <span className="num">{pct(t.pct)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full origin-left rounded-full transition-transform duration-700" style={{ width: '100%', transform: `scaleX(${t.pct / 100})`, background: ASSET_COLORS[t.type] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TypeChip({ type }: { type: keyof typeof ASSET_COLORS }) {
  const { t } = useTranslation('legacy');
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs">
      <span className="h-2 w-2 rounded-full" style={{ background: ASSET_COLORS[type] }} />{t(typeMessage(type))}
    </span>
  );
}

export function Gain({ v, p }: { v: number; p?: number }) {
  const up = v >= 0;
  const percent = p === undefined ? undefined : formatNumber(p, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <span className={`num ${up ? 'text-[hsl(152_50%_30%)]' : 'text-destructive'}`}>
      {up ? '+' : '-'}{money(Math.abs(v))}{percent !== undefined && <span className="ml-1 opacity-75">({up ? '+' : ''}{percent}%)</span>}
    </span>
  );
}
