import { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shell';
import { type ChannelStat, getOutreach, landingLink } from '@/lib/outreach';
import { useToast } from '@/hooks/use-toast';

const SHARE = ['whatsapp', 'linkedin', 'email'];
const RKEY = 'falcon-eye:reached';
const EKEY = 'falcon-eye:outreach-evidence';

type Evidence = { target: string; timing: '' | 'before' | 'after'; lesson: string };
const EMPTY_EVIDENCE: Evidence = { target: '', timing: '', lesson: '' };

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
  const [stats, setStats] = useState<ChannelStat[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<string | null>(null);
  const [reached, setReached] = useState(readReached);
  const [evidence, setEvidence] = useState(readEvidence);
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
  const setEvidenceField = (patch: Partial<Evidence>) => {
    const next = { ...evidence, ...patch };
    setEvidence(next);
    try { localStorage.setItem(EKEY, JSON.stringify(next)); }
    catch { toast({ title: 'Could not save presentation notes', description: 'Browser storage is unavailable. Keep a separate record.' }); }
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
          <div key={channel} className="min-w-0 rounded-xl border border-card-border bg-card p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{channel} link</div>
            <div className="mt-2 flex min-w-0 gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs" data-testid={`text-link-${channel}`}>{landingLink(channel)}</code>
              <button className="shrink-0 rounded-md border border-border p-1.5 hover:bg-secondary" aria-label={`Copy ${channel} link`}
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
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">Recorded outreach results by channel</caption>
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th scope="col" className="px-5 py-3">Channel</th><th scope="col" className="px-3 py-3 text-right">Reached (manual)</th>
                  <th scope="col" className="px-3 py-3 text-right">Visits</th><th scope="col" className="px-3 py-3 text-right">Sign-ups</th>
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
                    </tr>
                  );
                })}
                <tr className="bg-secondary/50 font-semibold">
                  <th scope="row" className="px-5 py-3 text-left">Total</th>
                  <td className="num px-3 py-3 text-right">{recordedReached.length ? `${totalReached}${partialReached ? ' (partial)' : ''}` : 'Not entered'}</td>
                  <td className="num px-3 py-3 text-right" data-testid="text-total-opened">{totals.opened}</td>
                  <td className="num px-3 py-3 text-right" data-testid="text-total-signups">{totals.signedUp}</td>
                </tr>
              </tbody>
            </table>
            {updated && <p className="px-5 py-3 text-xs text-muted-foreground" aria-live="polite">Recorded totals refreshed at {updated}.</p>}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
        <p><b className="text-foreground">Source:</b> visits are counted from <code>falcon_visits</code> and sign-ups from <code>falcon_interest</code>, grouped by their saved channel. These are all-time recorded totals, not a verified count of unique people reached.</p>
        <p><b className="text-foreground">Reached:</b> enter only people your team actually contacted. These entries stay in this browser, not Supabase. Blank means unknown, not zero; a partial total excludes missing entries.</p>
        <p><b className="text-foreground">Visits:</b> recorded landing-page opens, once per channel per browser tab session, not unique people. Test or repeat sessions may be included.</p>
        <p><b className="text-foreground">Sign-ups:</b> unique saved interest emails, attributed to their first registration channel. Use the channel links above for future outreach; untagged links are counted as direct. Past direct traffic cannot be reliably reassigned.</p>
        <p><b className="text-foreground">Why no conversion percentage?</b> Visits count tab sessions; sign-ups count distinct emails. Several emails can register within one session, or visit tracking can fail. There is no saved link between a sign-up and a visit, so these totals cannot establish a visitor conversion rate. Historical missing visits cannot be reconstructed reliably.</p>
      </div>

      {!loading && !error && moreSignupsThanVisits.length > 0 && (
        <div className="mt-4 flex gap-3 rounded-xl border border-border bg-secondary/50 p-4 text-sm" data-testid="notice-tracking-coverage">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><b>Tracking coverage note.</b> {moreSignupsThanVisits.map((row) => `${row.channel}: ${row.signedUp} sign-ups, ${row.opened} recorded visits`).join('; ')}.
            {' '}The saved counts are shown unchanged. This difference does not prove how many visits or people are missing; do not report it as a conversion percentage.</p>
        </div>
      )}

      <section className="mt-6 space-y-5 rounded-2xl border border-card-border bg-card p-6" aria-labelledby="presentation-evidence-title">
        <div>
          <h2 id="presentation-evidence-title" className="text-xl font-bold">Pass line and lesson</h2>
          <p className="mt-1 text-sm text-muted-foreground">Presentation notes, saved only in this browser—not Supabase. Enter your actual target and what you learned; nothing is prefilled or treated as a passed rubric.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">
            <span>Total sign-up pass line (all-time)</span>
            <Input value={evidence.target} inputMode="numeric" placeholder="Your actual target, at least 1" maxLength={9}
              aria-label="Total sign-up pass line" data-testid="input-pass-line"
              onChange={(e) => setEvidenceField({ target: e.target.value.replace(/[^0-9]/g, '').slice(0, 9) })} />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>When was this target set?</span>
            <select value={evidence.timing} aria-label="When target was set" data-testid="select-target-timing"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              onChange={(e) => setEvidenceField({ timing: e.target.value as Evidence['timing'] })}>
              <option value="">Not specified</option>
              <option value="before">Before reviewing results</option>
              <option value="after">After reviewing results (retrospective)</option>
            </select>
          </label>
        </div>
        <p className="rounded-lg bg-secondary/50 p-3 text-sm" aria-live="polite" data-testid="status-pass-line">
          {loading || error ? 'Comparison unavailable until recorded totals load successfully.'
            : !targetReady ? `Recorded sign-ups: ${totals.signedUp}. Enter a positive target and when it was set to compare; no pass result has been assumed.`
              : `${totals.signedUp} recorded sign-ups / ${target} target: ${totals.signedUp >= target! ? 'target met' : `${target! - totals.signedUp} more needed`}. ${evidence.timing === 'after' ? 'Retrospective target—not a pre-set pass line.' : 'Target marked by you as set before reviewing results.'}`}
        </p>
        <label className="block space-y-2 text-sm font-semibold">
          <span>One lesson learned</span>
          <Textarea value={evidence.lesson} maxLength={1200} rows={3} aria-label="One lesson learned" data-testid="input-lesson"
            placeholder="Write one observation supported by these results and what you will change next."
            onChange={(e) => setEvidenceField({ lesson: e.target.value })} />
        </label>
        <p className="text-xs text-muted-foreground">For green outreach evidence: actual reached counts per channel, recorded visits and sign-ups, your honestly described pass line, and one supported lesson. Unknown values remain unknown.</p>
      </section>
    </>
  );
}
