import { useEffect, useState } from 'react';
import { Cloud, Download, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { financeStore, useFinance } from '@/lib/finance-store';
import { validateDocument } from '@/lib/finance-model';

interface Account { configured: boolean; assistantConfigured?: boolean; user: { id: string; email?: string } | null }
let cachedAccount: Account = { configured: false, user: null };
const subscribers = new Set<() => void>();
function announce(account: Account) { cachedAccount = account; subscribers.forEach((fn) => fn()); }
export async function refreshAccount() {
  const response = await fetch('/api/account', { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error('Account service is unavailable.');
  const result = await response.json();
  announce(result);
  return result as Account;
}
function useAccount() {
  const [account, setAccount] = useState(cachedAccount);
  useEffect(() => {
    const update = () => setAccount(cachedAccount);
    subscribers.add(update);
    void refreshAccount().catch(() => {});
    return () => { subscribers.delete(update); };
  }, []);
  return account;
}
export function AccountStatus() {
  const account = useAccount();
  return <span className="inline-flex items-center gap-2"><LockKeyhole size={13} />{account.user ? 'Signed in · browser records save to cloud on request' : 'Private to this browser · not cloud-saved'}</span>;
}

export function FinanceAccount() {
  const account = useAccount();
  const doc = useFinance();
  const [mode, setMode] = useState<'signin' | 'signup' | 'recover'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [cloud, setCloud] = useState<{ owner: string; revision: number } | null>(null);
  useEffect(() => { setCloud(null); }, [account.user?.id]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete this request.'); }
    finally { setBusy(false); }
  }
  async function request(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(response.status === 409 ? 'Cloud records changed in another session. Download a backup, then load the latest cloud copy before saving again.' : result.error ?? 'Unable to complete this request.');
    return result;
  }
  async function auth() {
    await perform(async () => {
      const result = await request('/api/account', 'POST', { action: mode, email, ...(mode !== 'recover' ? { password } : {}) });
      setPassword('');
      await refreshAccount();
      setNotice(result.message ?? (mode === 'recover' ? 'If recovery is available for this account, check your email.' : mode === 'signup' ? 'Check your email if confirmation is required. You can then sign in.' : 'Signed in. Cloud records are not loaded or overwritten automatically.'));
    });
  }
  async function saveCloud() {
    if (doc.isSample) { setError('Sample records cannot be uploaded as personal finances. Start your own records first.'); return; }
    if (!account.user) return;
    if (!window.confirm('Save this browser’s personal financial records to your account? This does not connect a bank or make a transaction.')) return;
    await perform(async () => {
      let revision = cloud?.owner === account.user!.id ? cloud.revision : 0;
      if (!cloud) {
        const existing = await request('/api/finance');
        if (existing.document) throw new Error('This account already has cloud records. Load the cloud copy first to prevent accidental replacement. Export your browser records before loading.');
        revision = existing.revision;
      }
      const result = await request('/api/finance', 'PUT', { document: doc, revision });
      setCloud({ owner: account.user!.id, revision: result.revision });
      setNotice('Saved to your private account. Later browser changes still require “Save to cloud”.');
    });
  }
  async function loadCloud() {
    if (!window.confirm('Replace the records currently visible in this browser with your cloud copy? Export a browser backup first if you want to keep both.')) return;
    await perform(async () => {
      const result = await request('/api/finance');
      if (!result.document) { setNotice('No cloud records yet. Nothing in this browser was changed.'); setCloud({ owner: account.user!.id, revision: result.revision }); return; }
      financeStore.replace(validateDocument(result.document));
      setCloud({ owner: account.user!.id, revision: result.revision });
      setNotice('Cloud records loaded into this browser.');
    });
  }
  async function deleteCloud() {
    if (window.prompt('This permanently deletes your cloud financial records, not your sign-in account or this browser copy. Type DELETE MY FINANCIAL DATA to confirm.') !== 'DELETE MY FINANCIAL DATA') return;
    await perform(async () => {
      const latest = await request('/api/finance');
      await request('/api/finance', 'DELETE', { confirmation: 'DELETE MY FINANCIAL DATA', revision: latest.revision });
      setCloud({ owner: account.user!.id, revision: 0 });
      setNotice('Cloud financial records deleted. Your browser copy is unchanged. Sign-in account deletion is a separate process.');
    });
  }
  return <section className="rounded-2xl border bg-card p-5 md:p-7">
    <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-900"><ShieldCheck size={23} /></span><div><h2 className="text-xl font-bold">Your private account</h2><p className="text-sm text-muted-foreground">You control when records leave this browser.</p></div></div>
    {!account.configured && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>Cloud sign-in is not configured yet.</b> Browser tracking works, but this is not a production-ready cloud account. Supabase Auth configuration and the reviewed database migration are required. Never put keys or database passwords into this page.</div>}
    {account.user ? <>
      <p className="mb-4 text-sm">Signed in{account.user.email ? ` as ${account.user.email}` : ''}. Your account does not automatically upload or replace browser records.</p>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => void saveCloud()} className="finance-button"><Cloud size={17} />Save to cloud</button>
        <button disabled={busy} onClick={() => void loadCloud()} className="finance-button secondary"><Download size={17} />Load cloud records</button>
        <button disabled={busy} onClick={() => void perform(async () => { await request('/api/account', 'POST', { action: 'signout' }); await refreshAccount(); setNotice('Signed out. Financial records remain in this browser. Clear them in Browser storage before sharing this device.'); })} className="finance-button secondary"><LogOut size={17} />Sign out</button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">On a shared device, sign out and clear the browser records separately. Signing out does not erase your local copy.</p>
      <button className="mt-5 text-sm text-red-700 underline" disabled={busy} onClick={() => void deleteCloud()}>Delete cloud financial records</button>
    </> : <form onSubmit={(e) => { e.preventDefault(); void auth(); }} className="max-w-lg space-y-4">
      <div className="flex flex-wrap gap-2">{(['signin', 'signup', 'recover'] as const).map((item) => <button type="button" key={item} onClick={() => { setMode(item); setError(''); setNotice(''); }} className={`rounded-full px-4 py-2 text-sm ${mode === item ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>{item === 'signin' ? 'Sign in' : item === 'signup' ? 'Create account' : 'Reset password'}</button>)}</div>
      <label className="block text-sm font-medium">Email<input className="mt-2 w-full rounded-xl border bg-background p-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} /></label>
      {mode !== 'recover' && <label className="block text-sm font-medium">Password<input className="mt-2 w-full rounded-xl border bg-background p-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 12 : 1} maxLength={128} required /></label>}
      <button disabled={busy || !account.configured} className="finance-button">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in securely' : mode === 'signup' ? 'Create my account' : 'Send recovery email'}</button>
      <p className="text-xs text-muted-foreground">Interest registration on the welcome page is separate from a personal account. Passwords are never saved in browser storage.</p>
    </form>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{notice}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </section>;
}
