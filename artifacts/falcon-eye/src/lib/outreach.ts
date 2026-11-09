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
