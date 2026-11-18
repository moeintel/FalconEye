import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowLeftRight, ChartNoAxesCombined, ChevronRight, CircleHelp, House,
  Landmark, Menu, MessageCircle, Settings2, WalletCards, X,
} from 'lucide-react';
import { Logo } from '@/components/shell';
import { financeStore, useFinance } from '@/lib/finance-store';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { localizedError } from '@/lib/i18n';
import { LanguageSwitcher } from './language-switcher';

const NAV = [
  { href: '/', label: 'navigation.home', icon: House },
  { href: '/assets', label: 'navigation.assets', icon: WalletCards },
  { href: '/debts', label: 'navigation.debts', icon: Landmark },
  { href: '/activity', label: 'navigation.activity', icon: ArrowLeftRight },
  { href: '/reports', label: 'navigation.reports', icon: ChartNoAxesCombined },
];

export function FinanceShell({ children, accountStatus }: { children: ReactNode; accountStatus?: ReactNode }) {
  const { t } = useTranslation('common');
  const [loc] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSample } = useFinance();
  const storageError = financeStore.getStorageError();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    });
    return () => cancelAnimationFrame(frame);
  }, [loc]);
  const nav = (mobile = false) => NAV.map(({ href, label, icon: Icon }) => {
    const active = href === '/' ? loc === '/' : loc.startsWith(href);
    return (
      <Link key={href} href={href} onClick={() => setMenuOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn('fe-nav-link', active && 'is-active', mobile && 'fe-mobile-link')}>
        <Icon aria-hidden="true" /><span>{t(label)}</span>{mobile && active && <ChevronRight className="fe-current-chevron" />}
      </Link>
    );
  });
  return (
    <div className="finance-app">
      <aside className="fe-sidebar">
        <Link href="/" className="fe-brand" aria-label={t('navigation.homeLabel')}>
          <Logo className="fe-brand-mark" />
          <span><b>{t('brand')}</b><small>{t('tagline')}</small></span>
        </Link>
        <div className="fe-nav-label">{t('navigation.yourMoney')}</div>
        <nav aria-label={t('navigation.main')} className="fe-nav">{nav()}</nav>
        <div className="fe-sidebar-bottom">
          <div className="fe-help-card"><CircleHelp /><span><b>{t('help')}</b><small>{t('helpText')}</small></span></div>
          <button className="fe-falc-button" onClick={() => window.dispatchEvent(new CustomEvent('falconeye:open-assistant'))}>
            <span className="fe-falc-dot" aria-hidden="true">F</span> {t('askFalc')} <span className="fe-falc-arrow" aria-hidden="true">↗</span>
          </button>
          <Link href="/settings" className={cn('fe-settings-link', loc.startsWith('/settings') && 'is-active')}><Settings2 />{t('navigation.settings')}</Link>
          {loc !== '/' && <LanguageSwitcher />}
          {accountStatus}
        </div>
      </aside>

      <div className="fe-main-column">
        <header className="fe-mobile-header">
          <Link href="/" className="fe-brand" aria-label={t('navigation.homeLabel')}><Logo className="fe-brand-mark" /><b>{t('brand')}</b></Link>
          {loc !== '/' && <LanguageSwitcher />}
          <button className="fe-menu-button" aria-label={t(menuOpen ? 'navigation.close' : 'navigation.open')} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </header>
        {menuOpen && <div className="fe-mobile-drawer">
          <nav aria-label={t('navigation.main')} className="fe-nav">{nav(true)}</nav>
          <Link href="/settings" onClick={() => setMenuOpen(false)} className="fe-mobile-settings"><Settings2 /> {t('navigation.settings')}</Link>
        </div>}
        {loc !== '/' && <div className="fe-top-note"><span className="fe-note-marker" />{t(isSample ? 'sampleNote' : 'personalNote')}<span className="fe-top-note-right">{t('localNote')}</span></div>}
        <main className="fe-content">{storageError && <div className="fe-data-alert is-error" role="alert"><div><b>{t('storageHeading')}</b><span>{localizedError(storageError)} {t('storageBackup')}</span></div></div>}{children}</main>
        <footer className="fe-footer">{t('footer')}</footer>
      </div>
      <nav className="fe-bottom-nav" aria-label={t('navigation.quick')}>{NAV.filter((item) => item.href !== '/activity').map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? loc === '/' : loc.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('fe-bottom-link', active && 'is-active')}><Icon /><span>{t(label)}</span></Link>;
      })}<button className="fe-bottom-link" onClick={() => window.dispatchEvent(new CustomEvent('falconeye:open-assistant'))}><MessageCircle /><span>{t('askFalc')}</span></button></nav>
    </div>
  );
}
