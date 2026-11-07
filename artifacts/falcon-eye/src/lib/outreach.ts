export const CHANNELS = ['whatsapp', 'linkedin', 'email', 'direct'] as const;

export function sanitizeChannel(raw: string | null | undefined): string {
  const c = (raw ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  return c || 'direct';
}

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
  let data: { success?: boolean; error?: string } = {};
  try { data = await res.json(); } catch { /* non-json */ }
  if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const postInterest = (email: string, channel: string) => post('/api/interest', { email, channel });

export function recordVisitOnce(channel: string) {
  const key = `falcon-eye:visit:${channel}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch { /* storage unavailable */ }
  post('/api/visit', { channel }).catch(() => {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  });
}

export interface ChannelStat { channel: string; opened: number; signedUp: number }
export async function getOutreach(): Promise<ChannelStat[]> {
  const res = await fetch('/api/outreach', { credentials: 'include' });
  if (!res.ok) throw new Error(`Could not load stats (${res.status})`);
  const d = await res.json();
  return Array.isArray(d?.channels) ? d.channels : [];
}

export const landingLink = (channel: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/?$/, '/')}welcome?channel=${channel}`;
