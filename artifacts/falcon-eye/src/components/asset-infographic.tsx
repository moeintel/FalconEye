import { useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Banknote, Bitcoin, ChartNoAxesCombined, CircleHelp, Coins, HandCoins, HeartHandshake, House, Landmark, Layers, Ticket, WalletCards } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { useTranslation } from 'react-i18next';
import { assetBreakdown } from '@/lib/asset-breakdown';
import { CATEGORIES, type FinanceDocument } from '@/lib/finance-model';
import { formatMoney, formatNumber } from '@/lib/locale';

const COLORS = ['#61A9BD', '#CED14E', '#71A5D2', '#BFA2E0', '#FAB770', '#DD83C9', '#AD8F80', '#C1C1C1', '#8CCEDE', '#EDED96'];
const colorFor = (category: string) => COLORS[CATEGORIES.findIndex((item) => item.id === category) % COLORS.length];
const ICONS = { cash: Banknote, gold: Coins, stocks: ChartNoAxesCombined, funds: Layers, crypto: Bitcoin, ipo: Ticket, private: HeartHandshake, lent: HandCoins, bonds: Landmark, property: House, debt: Landmark };

function AssetMapTile({ x = 0, y = 0, width = 0, height = 0, depth = 0, name = '', fill = '' }: {
  x?: number; y?: number; width?: number; height?: number; depth?: number; name?: string; fill?: string;
}) {
  if (depth === 0) return <g />;
  const maxCharacters = Math.floor((width - 16) / 7);
  const label = Array.from(name).length > maxCharacters ? `${Array.from(name).slice(0, maxCharacters).join('')}…` : name;
  return <g><rect x={x + 2} y={y + 2} width={Math.max(0, width - 4)} height={Math.max(0, height - 4)} rx={8} fill={fill} />
    {width > 110 && height > 45 && <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#102c40" stroke="none" fontSize={11} fontWeight={600}>{label}</text>}
  </g>;
}

export function AssetInfographic({ document }: { document: FinanceDocument }) {
  const { t } = useTranslation('overview');
  const { t: common } = useTranslation('common');
  const data = useMemo(() => assetBreakdown(document), [document]);
  const chart = data.groups.filter((group) => group.value > 0).map((group) => ({
    ...group, name: common(`categories.${group.category}`), fill: colorFor(group.category),
  }));
  const tooltip = <Tooltip content={({ active, payload }) => {
    const item = payload?.[0]?.payload;
    if (!active || !item) return null;
    return <div className="fe-asset-chart-tooltip"><b>{item.name}</b><span><bdi>{formatMoney(Number(item.value), document.baseCurrency)}</bdi></span></div>;
  }} />;
  return <section className="fe-panel fe-asset-infographic">
    <div className="fe-section-heading">
      <div><div className="fe-eyebrow">{t('breakdown')}</div><h2>{t('assetVisualTitle')}</h2></div>
      <Link href="/assets" className="fe-inline-link">{t('allAssets')} <ArrowRight /></Link>
    </div>
    <div className="fe-asset-visual">
      <div className="fe-asset-visual-summary">
        <span className="fe-asset-total-label">{t('knownAssetValue')}</span>
        <strong><bdi>{data.groups.some((group) => group.valuedCount > 0) ? formatMoney(data.total, document.baseCurrency) : t('assetNotValued')}</bdi></strong>
        <span className="fe-asset-total-context">{t('assetValueBasis')}</span>
        <div className="fe-asset-visual-counts">
          <span><b>{formatNumber(data.count)}</b>{t('assetItems')}</span>
          <span><b>{formatNumber(data.groups.length)}</b>{t('assetTypes')}</span>
        </div>
      </div>
      <div className="fe-asset-chart" aria-hidden="true" dir="ltr">
        {chart.length > 0 ? <ResponsiveContainer width="100%" height="100%">
          {chart.length > 5 ? <Treemap data={chart} dataKey="value" nameKey="name" stroke="#fffefa" fill="#61A9BD" isAnimationActive={false} content={<AssetMapTile />}>{tooltip}</Treemap> :
            <PieChart><Pie data={chart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="90%" paddingAngle={2} stroke="#fffefa" strokeWidth={3} isAnimationActive={false}>
              {chart.map((entry) => <Cell key={entry.category} fill={entry.fill} />)}
            </Pie>{tooltip}</PieChart>}
        </ResponsiveContainer> : <div className="fe-asset-chart-empty"><WalletCards size={36} /><span>{t('noValues')}</span></div>}
      </div>
    </div>
    {data.excludedCount > 0 && <p className="fe-asset-coverage"><CircleHelp size={16} /><span>{t('assetCoverage')}</span></p>}
    <ul className="fe-asset-tiles">
      {data.groups.map((group) => {
        const Icon = ICONS[group.category];
        return <li className="fe-asset-tile" key={group.category}>
          <span className="fe-asset-tile-icon"><Icon size={20} aria-hidden="true" /></span>
          <span className="fe-asset-tile-name"><b>{common(`categories.${group.category}`)}</b><small>{common('records', { count: group.count })}</small></span>
          <strong><bdi>{group.valuedCount > 0 ? formatMoney(group.value, document.baseCurrency) : t('assetNotValued')}</bdi></strong>
          <span className="fe-asset-tile-share"><i style={{ background: colorFor(group.category) }} />{group.valuedCount === 0 ? t('assetExcluded') : group.share === null ? t('assetNoShare') : t('assetShare', { share: formatNumber(group.share, { style: 'percent', maximumFractionDigits: 1 }) })}</span>
          {group.excludedCount > 0 && group.valuedCount > 0 && <small className="fe-asset-tile-partial">{t('assetPartiallyValued')}</small>}
        </li>;
      })}
    </ul>
    <div className="fe-panel-footnote">{t('estimatedFromEntries', { currency: document.baseCurrency })}</div>
  </section>;
}
