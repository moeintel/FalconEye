import { useEffect, useRef, useState } from 'react';
import { Cloud, Download, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { financeStore, useFinance } from '@/lib/finance-store';
import { validateDocument } from '@/lib/finance-model';
import i18n, { localizedError } from '@/lib/i18n';

interface Account { configured: boolean; assistantConfigured?: boolean; emailFlowsConfigured?: boolean; deletionConfigured?: boolean; user: { id: string; email?: string } | null }
let cachedAccount: Account = { configured: false, user: null };
const subscribers = new Set<() => void>();
function announce(account: Account) { cachedAccount = account; subscribers.forEach((fn) => fn()); }
function isAccountCatalogError(message: string): boolean {
  function includes(value: unknown): boolean {
    if (value === message) return true;
    return !!value && typeof value === 'object' && Object.values(value).some(includes);
  }
  return includes(i18n.getResourceBundle('en', 'account'));
}
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
  const { t } = useTranslation('account');
  const { t: ux } = useTranslation('ux');
  return <span className="inline-flex items-center gap-2 text-xs"><LockKeyhole size={13} />{account.user ? t('statusSignedIn') : ux('localOnly')}</span>;
}

export function FinanceAccount() {
  const { t } = useTranslation('account');
  const { t: ux } = useTranslation('ux');
  const account = useAccount();
  const doc = useFinance();
  const [mode, setMode] = useState<'signin' | 'signup' | 'recover'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [cloud, setCloud] = useState<{ owner: string; revision: number } | null>(null);
  const [callbackStatus] = useState(() => new URLSearchParams(window.location.search).get('account'));
  const [passwordOpen, setPasswordOpen] = useState(callbackStatus === 'recovered');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const callbackHandled = useRef(false);
  useEffect(() => {
    if (!callbackStatus) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('account');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (callbackStatus === 'callback_failed') setError('That email link could not be verified. Start again and open the latest link in the same browser where you requested it.');
  }, [callbackStatus]);
  useEffect(() => {
    setCloud(null); setNewPassword(''); setConfirmPassword(''); setDeletePassword(''); setPasswordOpen(false);
    if (!account.user || callbackHandled.current) return;
    callbackHandled.current = true;
    if (callbackStatus === 'recovered') { setNotice('recoveryVerified'); setPasswordOpen(true); }
    if (callbackStatus === 'confirmed') setNotice('emailConfirmed');
  }, [callbackStatus, account.user?.id]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'This request could not be completed. Check the connection and try again.'); }
    finally { setBusy(false); }
  }
  async function request(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(account.user ? { 'X-Falcon-Account': account.user.id } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (result.accountChanged) {
      await refreshAccount();
      throw new Error('Your signed-in account changed in another session. No cloud operation was performed. Review the current account before trying again.');
    }
    if (!response.ok) {
      const message = response.status === 409 ? 'Cloud records changed in another session. Download a backup, then load the latest cloud copy before saving again.' : result.error;
      throw new Error(typeof message === 'string' && isAccountCatalogError(message) ? message : 'This request could not be completed. Check the connection and try again.');
    }
    return result;
  }
  async function auth() {
    await perform(async () => {
      await request('/api/account', 'POST', { action: mode, email, ...(mode !== 'recover' ? { password } : {}) });
      setPassword('');
      await refreshAccount();
      setNotice(mode === 'recover' ? 'recoveryRequested' : mode === 'signup' ? 'signupRequested' : 'signedIn');
    });
  }
  async function saveCloud() {
    if (doc.isSample) { setError('Sample records cannot be uploaded as personal finances. Start your own records first.'); return; }
    if (!account.user) return;
    if (!window.confirm(t('confirmSaveCloud'))) return;
    await perform(async () => {
      let revision = cloud?.owner === account.user!.id ? cloud.revision : 0;
      if (!cloud) {
        const existing = await request('/api/finance');
        if (existing.document) throw new Error('This account already has cloud records. Load the cloud copy first to prevent accidental replacement. Export your browser records before loading.');
        revision = existing.revision;
      }
      const result = await request('/api/finance', 'PUT', { document: doc, revision });
      setCloud({ owner: account.user!.id, revision: result.revision });
      setNotice('cloudSaved');
    });
  }
  async function loadCloud() {
    if (!window.confirm(t('confirmLoadCloud'))) return;
    await perform(async () => {
      const result = await request('/api/finance');
      if (!result.document) { setNotice('noCloudRecords'); setCloud({ owner: account.user!.id, revision: result.revision }); return; }
      financeStore.replace(validateDocument(result.document));
      setCloud({ owner: account.user!.id, revision: result.revision });
      setNotice('cloudLoaded');
    });
  }
  async function deleteCloud() {
    if (window.prompt(t('confirmDeleteCloud', { token: 'DELETE MY FINANCIAL DATA' })) !== 'DELETE MY FINANCIAL DATA') return;
    await perform(async () => {
      const latest = await request('/api/finance');
      await request('/api/finance', 'DELETE', { confirmation: 'DELETE MY FINANCIAL DATA', revision: latest.revision });
      setCloud({ owner: account.user!.id, revision: 0 });
      setNotice('cloudDeleted');
    });
  }
  async function changePassword() {
    if (newPassword !== confirmPassword) { setError('The new passwords do not match.'); return; }
    await perform(async () => {
      await request('/api/account', 'POST', { action: 'password', password: newPassword });
      setNewPassword(''); setConfirmPassword(''); setPasswordOpen(false);
      await refreshAccount();
      setNotice('passwordUpdated');
    });
  }
  async function deleteAccount() {
    if (window.prompt(t('confirmDeleteAccount', { token: 'DELETE MY ACCOUNT' })) !== 'DELETE MY ACCOUNT') return;
    await perform(async () => {
      try {
        await request('/api/account', 'POST', { action: 'delete', password: deletePassword, confirmation: 'DELETE MY ACCOUNT' });
        await refreshAccount();
        setCloud(null); setNotice('accountDeleted');
      } finally { setDeletePassword(''); }
    });
  }
  return <section className="rounded-2xl border bg-card p-5 md:p-7">
    <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-900"><ShieldCheck size={23} /></span><div><h2 className="text-xl font-bold">{t('title')}</h2><p className="text-sm text-muted-foreground">{t('subtitle')}</p></div></div>
    {!account.configured && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>{ux('localOnly')}</b><p className="mt-2">{ux('accountsUnavailable')}</p><p className="mt-2">{ux('localRisk')}</p></div>}
    {account.user ? <>
      <p className="mb-4 text-sm">{t('signedInPrefix')}{account.user.email && <> <bdi dir="ltr">{account.user.email}</bdi></>}{t('signedInSuffix')}</p>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => void saveCloud()} className="finance-button"><Cloud size={17} />{t('saveCloud')}</button>
        <button disabled={busy} onClick={() => void loadCloud()} className="finance-button secondary"><Download size={17} />{t('loadCloud')}</button>
        <button disabled={busy} onClick={() => void perform(async () => { await request('/api/account', 'POST', { action: 'signout' }); await refreshAccount(); setNotice('signedOut'); })} className="finance-button secondary"><LogOut size={17} />{t('signOut')}</button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t('sharedDevice')}</p>
      <button className="mt-5 text-sm text-red-700 underline" disabled={busy} onClick={() => void deleteCloud()}>{t('deleteCloud')}</button>
      <div className="mt-6 border-t pt-5">
        <button type="button" className="text-sm underline" disabled={busy} onClick={() => setPasswordOpen(!passwordOpen)}>{t('changePassword')}</button>
        {passwordOpen && <form className="mt-4 max-w-lg space-y-3" onSubmit={(e) => { e.preventDefault(); void changePassword(); }}>
          <label className="block text-sm font-medium" htmlFor="account-new-password">{t('newPassword')}<input id="account-new-password" className="mt-2 w-full rounded-xl border bg-background p-3" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
          <label className="block text-sm font-medium" htmlFor="account-confirm-password">{t('confirmPassword')}<input id="account-confirm-password" className="mt-2 w-full rounded-xl border bg-background p-3" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
          <p className="text-xs text-muted-foreground">{t('passwordHelp')}</p>
          <button className="finance-button" disabled={busy}>{t('updatePassword')}</button>
        </form>}
      </div>
      <details className="mt-6 rounded-xl border border-red-200 p-4">
        <summary className="cursor-pointer text-sm font-medium text-red-800">{t('deleteAccountTitle')}</summary>
        <p className="mt-3 text-sm">{t('deleteAccountDescription')}</p>
        {!account.deletionConfigured ? <p className="mt-3 text-sm text-amber-900">{t('deletionUnavailable')}</p> : <form className="mt-4 max-w-lg space-y-3" onSubmit={(e) => { e.preventDefault(); void deleteAccount(); }}>
          <label className="block text-sm font-medium" htmlFor="account-delete-password">{t('currentPassword')}<input id="account-delete-password" className="mt-2 w-full rounded-xl border bg-background p-3" type="password" autoComplete="current-password" required maxLength={128} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} /></label>
          <button className="finance-button" disabled={busy}>{t('deleteAccountButton')}</button>
        </form>}
      </details>
    </> : account.configured && <form onSubmit={(e) => { e.preventDefault(); void auth(); }} className="max-w-lg space-y-4">
      <div className="flex flex-wrap gap-2">{(['signin', 'signup', 'recover'] as const).map((item) => <button type="button" key={item} onClick={() => { setMode(item); setError(''); setNotice(''); }} className={`rounded-full px-4 py-2 text-sm ${mode === item ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>{item === 'signin' ? t('signIn') : item === 'signup' ? t('createAccount') : t('resetPassword')}</button>)}</div>
      {mode !== 'signin' && !account.emailFlowsConfigured && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{t('emailFlowsUnavailable')}</p>}
      <label className="block text-sm font-medium">{t('email')}<input className="mt-2 w-full rounded-xl border bg-background p-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} /></label>
      {mode !== 'recover' && <label className="block text-sm font-medium">{t('password')}<input className="mt-2 w-full rounded-xl border bg-background p-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 12 : 1} maxLength={128} required /></label>}
      <button disabled={busy || !account.configured || (mode !== 'signin' && !account.emailFlowsConfigured)} className="finance-button">{busy ? t('wait') : mode === 'signin' ? t('signInSecure') : mode === 'signup' ? t('createMyAccount') : t('sendRecovery')}</button>
      <p className="text-xs text-muted-foreground">{t('earlyAccessSeparate')}</p>
    </form>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{t(`notices.${notice}`)}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{localizedError(error)}</p>}
  </section>;
}
