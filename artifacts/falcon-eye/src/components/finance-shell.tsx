import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowLeftRight, BarChart3, BookOpen, ChartNoAxesCombined, ChevronRight, CircleHelp, Compass, House,
  Landmark, Menu, Settings2, WalletCards, X,
} from 'lucide-react';
import { Logo } from '@/components/shell';
import { financeStore, useFinance } from '@/lib/finance-store';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Home', icon: House },
  { href: '/assets', label: 'Assets', icon: WalletCards },
  { href: '/debts', label: 'Debts', icon: Landmark },
  { href: '/activity', label: 'Activity', icon: ArrowLeftRight },
  { href: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
];

export function FinanceShell({ children, accountStatus }: { children: ReactNode; accountStatus?: ReactNode }) {
  const [loc] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSample } = useFinance();
  const storageError = financeStore.getStorageError();
  const nav = (mobile = false) => NAV.map(({ href, label, icon: Icon }) => {
    const active = href === '/' ? loc === '/' : loc.startsWith(href);
    return (
      <Link key={href} href={href} onClick={() => setMenuOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn('fe-nav-link', active && 'is-active', mobile && 'fe-mobile-link')}>
        <Icon aria-hidden="true" /><span>{label}</span>{mobile && active && <ChevronRight className="fe-current-chevron" />}
      </Link>
    );
  });
  return (
    <div className="finance-app">
      <aside className="fe-sidebar">
        <Link href="/" className="fe-brand" aria-label="Falcon Eye home">
          <Logo className="fe-brand-mark" />
          <span><b>Falcon Eye</b><small>Everyday money, in view</small></span>
        </Link>
        <div className="fe-nav-label">YOUR MONEY</div>
        <nav aria-label="Main navigation" className="fe-nav">{nav()}</nav>
        <div className="fe-sidebar-bottom">
          <div className="fe-help-card"><CircleHelp /><span><b>A little help?</b><small>Ask Falc to explain your view.</small></span></div>
          <button className="fe-falc-button" onClick={() => window.dispatchEvent(new CustomEvent('falconeye:open-assistant'))}>
            <span className="fe-falc-dot">F</span> Ask Falc <span className="fe-falc-arrow">↗</span>
          </button>
          <Link href="/settings" className={cn('fe-settings-link', loc.startsWith('/settings') && 'is-active')}><Settings2 />Settings</Link>
          <div className="fe-secondary-links" aria-label="More links">
            <Link href="/welcome">Early access</Link>
            <Link href="/admin/outreach">Admin view (prototype) <BarChart3 /></Link>
            <Link href="/design-guide">Design guide <BookOpen /></Link>
          </div>
          {accountStatus}
        </div>
      </aside>

      <div className="fe-main-column">
        <header className="fe-mobile-header">
          <Link href="/" className="fe-brand" aria-label="Falcon Eye home"><Logo className="fe-brand-mark" /><b>Falcon Eye</b></Link>
          <button className="fe-menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </header>
        {menuOpen && <div className="fe-mobile-drawer">
          <nav aria-label="Main navigation" className="fe-nav">{nav(true)}</nav>
          <Link href="/settings" onClick={() => setMenuOpen(false)} className="fe-mobile-settings"><Settings2 /> Settings</Link>
          <div className="fe-secondary-links fe-mobile-secondary">
            <Link href="/welcome" onClick={() => setMenuOpen(false)}><Compass />Early access</Link>
            <Link href="/admin/outreach" onClick={() => setMenuOpen(false)}><BarChart3 />Admin view (prototype)</Link>
            <Link href="/design-guide" onClick={() => setMenuOpen(false)}><BookOpen />Design guide</Link>
          </div>
        </div>}
        <div className="fe-top-note"><span className="fe-note-marker" />{isSample ? 'Sample picture · illustrative values, not live' : 'Your financial picture, all in one place'}<span className="fe-top-note-right">Saved in this browser · Not financial advice</span></div>
        <main className="fe-content">{storageError && <div className="fe-data-alert is-error" role="alert"><div><b>Your browser storage needs attention</b><span>{storageError} Download a backup from Reports before closing this page.</span></div></div>}{children}</main>
        <footer className="fe-footer">Falcon Eye keeps your money picture simple. Values are entered by you and may not be current.</footer>
      </div>
      <nav className="fe-bottom-nav" aria-label="Quick navigation">{NAV.slice(0, 4).map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? loc === '/' : loc.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('fe-bottom-link', active && 'is-active')}><Icon /><span>{label}</span></Link>;
      })}</nav>
    </div>
  );
}
