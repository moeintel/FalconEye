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

export default function Outreach() {
  const [stats, setStats] = useState<ChannelStat[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reached, setReached] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(RKEY) || '{}'); } catch { return {}; } });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setStats(await getOutreach()); } catch { setError('Could not load outreach numbers. The API may be offline.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const setR = (c: string, v: string) => { const n = { ...reached, [c]: v }; setReached(n); try { localStorage.setItem(RKEY, JSON.stringify(n)); } catch { /* ignore */ } };

  const channels = Array.from(new Set([...SHARE, ...(stats ?? []).map((s) => s.channel)]));
  const row = (c: string) => stats?.find((s) => s.channel === c) ?? { channel: c, opened: 0, signedUp: 0 };
  const tot = (stats ?? []).reduce((a, s) => ({ opened: a.opened + s.opened, signedUp: a.signedUp + s.signedUp }), { opened: 0, signedUp: 0 });

  return (
    <>
      <PageHeader kicker="Outreach" title="Who saw it, who signed up." actions={<Button variant="outline" onClick={load} data-testid="button-refresh-outreach"><RefreshCw className="mr-1 h-4 w-4" />Refresh</Button>}>
        Aggregate counts recorded by the interest landing page. No email addresses are shown here.
      </PageHeader>

      <div className="rise mb-6 grid gap-3 md:grid-cols-3">
        {SHARE.map((c) => (
          <div key={c} className="rounded-xl border border-card-border bg-card p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{c} link</div>
            <div className="mt-2 flex gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs" data-testid={`text-link-${c}`}>{landingLink(c)}</code>
              <button className="rounded-md border border-border p-1.5 hover:bg-secondary" aria-label={`Copy ${c} link`} data-testid={`button-copy-${c}`}
                onClick={() => navigator.clipboard.writeText(landingLink(c)).then(() => toast({ title: `${c} link copied` }), () => toast({ title: 'Copy failed', description: 'Select the link and copy manually.' }))}>
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rise overflow-hidden rounded-2xl border border-card-border bg-card">
        {loading ? (
          <div className="space-y-3 p-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center"><AlertTriangle className="h-7 w-7 text-destructive" /><p data-testid="text-outreach-error">{error}</p><Button onClick={load} data-testid="button-retry-outreach">Retry</Button></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-5 py-3">Channel</th><th className="px-3 py-3 text-right">Reached (manual)</th><th className="px-3 py-3 text-right">Opened</th><th className="px-3 py-3 text-right">Signed up</th><th className="px-5 py-3 text-right">Signup / open</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => {
                  const r = row(c);
                  return (
                    <tr key={c} className="border-b border-border/70" data-testid={`row-channel-${c}`}>
                      <td className="px-5 py-3 font-semibold capitalize">{c}</td>
                      <td className="px-3 py-2 text-right"><Input value={reached[c] ?? ''} onChange={(e) => setR(c, e.target.value.replace(/[^0-9]/g, ''))} placeholder="enter" inputMode="numeric" className="ml-auto h-8 w-24 text-right font-mono" data-testid={`input-reached-${c}`} /></td>
                      <td className="num px-3 py-3 text-right">{r.opened}</td>
                      <td className="num px-3 py-3 text-right font-semibold">{r.signedUp}</td>
                      <td className="num px-5 py-3 text-right text-muted-foreground">{r.opened ? `${((r.signedUp / r.opened) * 100).toFixed(1)}%` : '-'}</td>
                    </tr>
                  );
                })}
                <tr className="bg-secondary/50 font-semibold"><td className="px-5 py-3">Total</td><td className="num px-3 py-3 text-right">{Object.values(reached).reduce((a, v) => a + (Number(v) || 0), 0) || '-'}</td><td className="num px-3 py-3 text-right" data-testid="text-total-opened">{tot.opened}</td><td className="num px-3 py-3 text-right" data-testid="text-total-signups">{tot.signedUp}</td><td className="num px-5 py-3 text-right">{tot.opened ? `${((tot.signedUp / tot.opened) * 100).toFixed(1)}%` : '-'}</td></tr>
              </tbody>
            </table>
            {!stats?.length && <p className="px-5 py-4 text-sm text-muted-foreground">No visits recorded yet. Share a link above to start measuring.</p>}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-3 rounded-xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p><b className="text-foreground">How to read this.</b> Reached is the number of people your team actually messaged per channel; it is entered manually here, saved only in this browser, and cannot be measured by the app. Opened counts landing-page loads per browser tab session, not unique people. Signed up counts saved interest emails.</p>
      </div>
    </>
  );
}
