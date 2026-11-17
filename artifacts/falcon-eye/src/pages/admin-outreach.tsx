import { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shell';
import { type ChannelStat, getOutreach, landingLink } from '@/lib/outreach';
import { useToast } from '@/hooks/use-toast';
import { Trans, useTranslation } from 'react-i18next';
import { formatNumber, getLocale } from '@/lib/locale';

const SHARE = ['whatsapp', 'linkedin', 'email'];
const KNOWN_CHANNELS = ['direct', ...SHARE] as const;
const RKEY = 'falcon-eye:reached';
const EKEY = 'falcon-eye:outreach-evidence';

type Evidence = { target: string; timing: '' | 'before' | 'after'; lesson: string };
const EMPTY_EVIDENCE: Evidence = { target: '', timing: '', lesson: '' };

function ChannelLabel({ channel }: { channel: string }) {
  const { t } = useTranslation('public');
  return KNOWN_CHANNELS.includes(channel as (typeof KNOWN_CHANNELS)[number])
    ? t(`admin.channels.${channel}`)
    : <bdi>{channel}</bdi>;
}

function channelName(channel: string, t: (key: string) => string) {
  return KNOWN_CHANNELS.includes(channel as (typeof KNOWN_CHANNELS)[number]) ? t(`admin.channels.${channel}`) : channel;
}

function readEvidence(): Evidence {
  try {
    const value = JSON.parse(localStorage.getItem(EKEY) || '{}');
    return {
      target: typeof value?.target === 'string' && /^\d{0,9}$/.test(value.target) ? value.target : '',
      timing: value?.timing === 'before' || value?.timing === 'after' ? value.timing : '',
      lesson: typeof value?.lesson === 'string' ? value.lesson.slice(0, 1200) : '',
    };
  } catch { return EMPTY_EVIDENCE; }
}

function readReached(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RKEY) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string' && /^\d*$/.test(v)));
  } catch { return {}; }
}

export default function AdminOutreach() {
  const { t } = useTranslation('public');
  const [stats, setStats] = useState<ChannelStat[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<number | null>(null);
  const [reached, setReached] = useState(readReached);
  const [evidence, setEvidence] = useState(readEvidence);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try { setStats(await getOutreach()); setUpdated(Date.now()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setR = (channel: string, value: string) => {
    const next = { ...reached, [channel]: value.replace(/[^0-9]/g, '') };
    setReached(next);
    try { localStorage.setItem(RKEY, JSON.stringify(next)); }
    catch { toast({ title: t('admin.errors.saveReached'), description: t('admin.errors.storageUnavailable') }); }
  };
  const setEvidenceField = (patch: Partial<Evidence>) => {
    const next = { ...evidence, ...patch };
    setEvidence(next);
    try { localStorage.setItem(EKEY, JSON.stringify(next)); }
    catch { toast({ title: t('admin.errors.saveNotes'), description: t('admin.errors.storageUnavailable') }); }
  };
  const channels = Array.from(new Set([...SHARE, 'direct', ...(stats ?? []).map((s) => s.channel), ...Object.keys(reached)]));
  const totals = (stats ?? []).reduce((a, s) => ({ opened: a.opened + s.opened, signedUp: a.signedUp + s.signedUp }), { opened: 0, signedUp: 0 });
  const recordedReached = channels.filter((channel) => reached[channel]?.length);
  const totalReached = recordedReached.reduce((total, channel) => total + Number(reached[channel]), 0);
  const partialReached = recordedReached.length < channels.length;
  const target = evidence.target ? Number(evidence.target) : null;
  const targetReady = target !== null && target > 0 && evidence.timing !== '';
  const moreSignupsThanVisits = (stats ?? []).filter((row) => row.signedUp > row.opened);

  return (
    <>
      <PageHeader kicker={t('admin.kicker')} title={t('admin.title')} actions={
        <Button variant="outline" onClick={load} disabled={loading} data-testid="button-refresh-outreach">
          <RefreshCw className="mr-1 h-4 w-4" />{t('admin.refresh')}
        </Button>
      }>
        {t('admin.intro')}
      </PageHeader>

      <div className="mb-6 flex gap-3 rounded-xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p><b className="text-foreground">{t('admin.teamNoticeTitle')}</b> {t('admin.teamNotice')}</p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {SHARE.map((channel) => (
          <div key={channel} className="min-w-0 rounded-xl border border-card-border bg-card p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <Trans ns="public" i18nKey="admin.channelLink" values={{ channel: channelName(channel, t) }} components={{ bdi: <bdi /> }} />
            </div>
            <div className="mt-2 flex min-w-0 gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs" data-testid={`text-link-${channel}`}>{landingLink(channel)}</code>
              <button className="shrink-0 rounded-md border border-border p-1.5 hover:bg-secondary" aria-label={t('admin.copyLink', { channel: channelName(channel, t) })}
                onClick={() => navigator.clipboard.writeText(landingLink(channel)).then(
                  () => toast({ title: t('admin.linkCopied', { channel: channelName(channel, t) }) }),
                  () => toast({ title: t('admin.copyFailed'), description: t('admin.copyManually') }),
                )}><Copy className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
        {loading ? (
          <div className="space-y-3 p-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertTriangle className="h-7 w-7 text-destructive" /><p role="alert">{t('admin.errors.load')}</p><Button onClick={load}>{t('admin.retry')}</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">{t('admin.tableCaption')}</caption>
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th scope="col" className="px-5 py-3">{t('admin.columns.channel')}</th><th scope="col" className="px-3 py-3 text-right">{t('admin.columns.reached')}</th>
                  <th scope="col" className="px-3 py-3 text-right">{t('admin.columns.visits')}</th><th scope="col" className="px-3 py-3 text-right">{t('admin.columns.signups')}</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((channel) => {
                  const row = stats?.find((s) => s.channel === channel) ?? { opened: 0, signedUp: 0 };
                  return (
                    <tr key={channel} className="border-b border-border/70" data-testid={`row-channel-${channel}`}>
                      <th scope="row" className="px-5 py-3 text-left font-semibold"><ChannelLabel channel={channel} /></th>
                      <td className="px-3 py-2 text-right"><Input value={reached[channel] ?? ''} onChange={(e) => setR(channel, e.target.value)}
                        placeholder={t('admin.notEntered')} inputMode="numeric" aria-label={t('admin.reachedLabel', { channel: channelName(channel, t) })}
                        className="ml-auto h-8 w-28 text-right font-mono" data-testid={`input-reached-${channel}`} /></td>
                      <td className="num px-3 py-3 text-right">{formatNumber(row.opened)}</td>
                      <td className="num px-3 py-3 text-right font-semibold">{formatNumber(row.signedUp)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-secondary/50 font-semibold">
                  <th scope="row" className="px-5 py-3 text-left">{t('admin.total')}</th>
                  <td className="num px-3 py-3 text-right">{recordedReached.length ? t('admin.reachedTotal', { total: formatNumber(totalReached), partial: partialReached ? ` (${t('admin.partial')})` : '' }) : t('admin.notEntered')}</td>
                  <td className="num px-3 py-3 text-right" data-testid="text-total-opened">{formatNumber(totals.opened)}</td>
                  <td className="num px-3 py-3 text-right" data-testid="text-total-signups">{formatNumber(totals.signedUp)}</td>
                </tr>
              </tbody>
            </table>
            {updated && <p className="px-5 py-3 text-xs text-muted-foreground" aria-live="polite">{t('admin.refreshedAt', {
              time: new Intl.DateTimeFormat(getLocale(), { hour: 'numeric', minute: '2-digit' }).format(updated),
            })}</p>}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
        <p><b className="text-foreground">{t('admin.sources.title')}</b> <Trans ns="public" i18nKey="admin.sources.description" components={{ visits: <code />, signups: <code /> }} /></p>
        <p><b className="text-foreground">{t('admin.reached.title')}</b> {t('admin.reached.description')}</p>
        <p><b className="text-foreground">{t('admin.visits.title')}</b> {t('admin.visits.description')}</p>
        <p><b className="text-foreground">{t('admin.signups.title')}</b> {t('admin.signups.description')}</p>
        <p><b className="text-foreground">{t('admin.noConversion.title')}</b> {t('admin.noConversion.description')}</p>
      </div>

      {!loading && !error && moreSignupsThanVisits.length > 0 && (
        <div className="mt-4 flex gap-3 rounded-xl border border-border bg-secondary/50 p-4 text-sm" data-testid="notice-tracking-coverage">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><b>{t('admin.coverage.title')}</b> {moreSignupsThanVisits.map((row, index) => <span key={row.channel}>
            {index > 0 ? '; ' : ''}<ChannelLabel channel={row.channel} />: {t('admin.coverage.row', {
              signups: formatNumber(row.signedUp), visits: formatNumber(row.opened),
            })}
          </span>)}. {t('admin.coverage.description')}</p>
        </div>
      )}

      <section className="mt-6 space-y-5 rounded-2xl border border-card-border bg-card p-6" aria-labelledby="presentation-evidence-title">
        <div>
          <h2 id="presentation-evidence-title" className="text-xl font-bold">{t('admin.evidence.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('admin.evidence.description')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">
            <span>{t('admin.evidence.targetLabel')}</span>
            <Input value={evidence.target} inputMode="numeric" placeholder={t('admin.evidence.targetPlaceholder')} maxLength={9}
              aria-label={t('admin.evidence.targetLabel')} data-testid="input-pass-line"
              onChange={(e) => setEvidenceField({ target: e.target.value.replace(/[^0-9]/g, '').slice(0, 9) })} />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>{t('admin.evidence.timingLabel')}</span>
            <select value={evidence.timing} aria-label={t('admin.evidence.timingLabel')} data-testid="select-target-timing"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              onChange={(e) => setEvidenceField({ timing: e.target.value as Evidence['timing'] })}>
               <option value="">{t('admin.evidence.timingUnknown')}</option>
               <option value="before">{t('admin.evidence.timingBefore')}</option>
               <option value="after">{t('admin.evidence.timingAfter')}</option>
            </select>
          </label>
        </div>
        <p className="rounded-lg bg-secondary/50 p-3 text-sm" aria-live="polite" data-testid="status-pass-line">
          {loading || error ? t('admin.evidence.comparisonUnavailable')
            : !targetReady ? t('admin.evidence.enterTarget', { count: totals.signedUp, total: formatNumber(totals.signedUp) })
              : t('admin.evidence.comparison', {
                total: formatNumber(totals.signedUp),
                target: formatNumber(target!),
                result: totals.signedUp >= target! ? t('admin.evidence.targetMet') : t('admin.evidence.moreNeeded', {
                  count: target! - totals.signedUp, number: formatNumber(target! - totals.signedUp),
                }),
                timing: evidence.timing === 'after' ? t('admin.evidence.retrospective') : t('admin.evidence.preSet'),
              })}
        </p>
        <label className="block space-y-2 text-sm font-semibold">
          <span>{t('admin.evidence.lessonLabel')}</span>
          <Textarea value={evidence.lesson} maxLength={1200} rows={3} aria-label={t('admin.evidence.lessonLabel')} data-testid="input-lesson"
            placeholder={t('admin.evidence.lessonPlaceholder')}
            onChange={(e) => setEvidenceField({ lesson: e.target.value })} />
        </label>
        <p className="text-xs text-muted-foreground">{t('admin.evidence.evidenceNote')}</p>
      </section>
    </>
  );
}
