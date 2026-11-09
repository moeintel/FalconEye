import { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shell';
import { type ChannelStat, getOutreach, landingLink } from '@/lib/outreach';
import { useToast } from '@/hooks/use-toast';

const SHARE = ['whatsapp', 'linkedin', 'email'];
const RKEY = 'falcon-eye:reached';

function readReached(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RKEY) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string' && /^\d*$/.test(v)));
  } catch { return {}; }
}

export default function AdminOutreach() {
  const [stats, setStats] = useState<ChannelStat[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<string | null>(null);
  const [reached, setReached] = useState(readReached);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setStats(await getOutreach()); setUpdated(new Date().toLocaleTimeString()); }
    catch { setError('Could not load recorded outreach data. Please refresh or try again later.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setR = (channel: string, value: string) => {
    const next = { ...reached, [channel]: value.replace(/[^0-9]/g, '') };
    setReached(next);
    try { localStorage.setItem(RKEY, JSON.stringify(next)); }
    catch { toast({ title: 'Could not save reached counts', description: 'Browser storage is unavailable. Keep a separate record.' }); }
  };
  const channels = Array.from(new Set([...SHARE, 'direct', ...(stats ?? []).map((s) => s.channel), ...Object.keys(reached)]));
  const totals = (stats ?? []).reduce((a, s) => ({ opened: a.opened + s.opened, signedUp: a.signedUp + s.signedUp }), { opened: 0, signedUp: 0 });
  const recordedReached = channels.filter((channel) => reached[channel]?.length);
  const totalReached = recordedReached.reduce((total, channel) => total + Number(reached[channel]), 0);
  const partialReached = recordedReached.length < channels.length;

  return (
    <>
      <PageHeader kicker="Admin view (prototype)" title="Outreach by channel" actions={
        <Button variant="outline" onClick={load} disabled={loading} data-testid="button-refresh-outreach">
          <RefreshCw className="mr-1 h-4 w-4" />Refresh
        </Button>
      }>
        Real recorded visits and sign-ups from Supabase. Enter your actual outreach reach per channel; no sample results are generated.
      </PageHeader>

      <div className="mb-6 flex gap-3 rounded-xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p><b className="text-foreground">Team reporting only.</b> This is a prototype admin view, not a protected admin area. Anyone with the link can see aggregate counts. Email addresses are never displayed.</p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {SHARE.map((channel) => (
          <div key={channel} className="rounded-xl border border-card-border bg-card p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{channel} link</div>
            <div className="mt-2 flex gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs" data-testid={`text-link-${channel}`}>{landingLink(channel)}</code>
              <button className="rounded-md border border-border p-1.5 hover:bg-secondary" aria-label={`Copy ${channel} link`}
                onClick={() => navigator.clipboard.writeText(landingLink(channel)).then(
                  () => toast({ title: `${channel} link copied` }),
                  () => toast({ title: 'Copy failed', description: 'Select the link and copy manually.' }),
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
            <AlertTriangle className="h-7 w-7 text-destructive" /><p role="alert">{error}</p><Button onClick={load}>Retry</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Recorded outreach results by channel</caption>
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th scope="col" className="px-5 py-3">Channel</th><th scope="col" className="px-3 py-3 text-right">Reached (manual)</th>
                  <th scope="col" className="px-3 py-3 text-right">Visits</th><th scope="col" className="px-3 py-3 text-right">Sign-ups</th>
                  <th scope="col" className="px-5 py-3 text-right">Sign-ups / visits</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((channel) => {
                  const row = stats?.find((s) => s.channel === channel) ?? { opened: 0, signedUp: 0 };
                  return (
                    <tr key={channel} className="border-b border-border/70" data-testid={`row-channel-${channel}`}>
                      <th scope="row" className="px-5 py-3 text-left font-semibold capitalize">{channel}</th>
                      <td className="px-3 py-2 text-right"><Input value={reached[channel] ?? ''} onChange={(e) => setR(channel, e.target.value)}
                        placeholder="Not entered" inputMode="numeric" aria-label={`${channel} people reached`}
                        className="ml-auto h-8 w-28 text-right font-mono" data-testid={`input-reached-${channel}`} /></td>
                      <td className="num px-3 py-3 text-right">{row.opened}</td>
                      <td className="num px-3 py-3 text-right font-semibold">{row.signedUp}</td>
                      <td className="num px-5 py-3 text-right text-muted-foreground">{row.opened ? `${((row.signedUp / row.opened) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  );
                })}
                <tr className="bg-secondary/50 font-semibold">
                  <th scope="row" className="px-5 py-3 text-left">Total</th>
                  <td className="num px-3 py-3 text-right">{recordedReached.length ? `${totalReached}${partialReached ? ' (partial)' : ''}` : 'Not entered'}</td>
                  <td className="num px-3 py-3 text-right" data-testid="text-total-opened">{totals.opened}</td>
                  <td className="num px-3 py-3 text-right" data-testid="text-total-signups">{totals.signedUp}</td>
                  <td className="num px-5 py-3 text-right">{totals.opened ? `${((totals.signedUp / totals.opened) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              </tbody>
            </table>
            {updated && <p className="px-5 py-3 text-xs text-muted-foreground" aria-live="polite">Recorded totals refreshed at {updated}.</p>}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
        <p><b className="text-foreground">Reached:</b> enter only people your team actually contacted. These entries stay in this browser, not Supabase. Blank means unknown, not zero; a partial total excludes missing entries.</p>
        <p><b className="text-foreground">Visits:</b> recorded landing-page opens, once per channel per browser tab session, not unique people. Test or repeat sessions may be included.</p>
        <p><b className="text-foreground">Sign-ups:</b> unique saved interest emails, attributed to their first registration channel. Use the channel links above for future outreach; untagged links are counted as direct. Past direct traffic cannot be reliably reassigned.</p>
      </div>
    </>
  );
}
