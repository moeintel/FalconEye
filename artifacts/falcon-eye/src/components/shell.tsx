import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutGrid, ListTree, Upload, Radar, Download, Compass, RotateCcw, Megaphone, BarChart3, Menu, X, HardDrive } from 'lucide-react';
import { usePortfolio } from '@/lib/portfolio';
import { DataControls } from '@/components/data-controls';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutGrid },
  { href: '/holdings', label: 'Holdings', icon: ListTree },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/insights', label: 'Insights', icon: Radar },
  { href: '/export', label: 'Export', icon: Download },
  { href: '/onboarding', label: 'Get started', icon: Compass },
  { href: '/welcome', label: 'Early access', icon: Megaphone },
  { href: '/outreach', label: 'Outreach', icon: BarChart3 },
];

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M4 20 C 12 8, 28 8, 36 20 C 28 32, 12 32, 4 20 Z" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="20" cy="20" r="7.5" fill="hsl(39 95% 55%)" />
      <circle cx="20" cy="20" r="3.2" fill="hsl(212 48% 11%)" />
      <path d="M20 4 L22 9 L18 9 Z" fill="currentColor" />
    </svg>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [loc] = useLocation();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? loc === '/' : loc.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            data-testid={`link-nav-${href.slice(1) || 'overview'}`}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
            )}
          >
            <span className={cn('absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-sidebar-primary transition-transform origin-left', active ? 'scale-x-100' : 'scale-x-0')} />
            <Icon className={cn('h-4 w-4 transition-transform group-hover:scale-110', active && 'text-sidebar-primary')} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { isDemo, holdings } = usePortfolio();
  const [open, setOpen] = useState(false);
  return (
    <div className="grain min-h-[100dvh] bg-background lg:pl-64">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarBody />
      </aside>

      <header className="no-print sticky top-0 z-40 flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-bold" data-testid="link-home-mobile">
          <Logo className="h-7 w-7" /> Falcon Eye
        </Link>
        <button onClick={() => setOpen(!open)} className="rounded-md p-2 hover:bg-sidebar-accent" data-testid="button-menu" aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open && (
        <div className="no-print fixed inset-x-0 top-[56px] bottom-0 z-40 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground lg:hidden">
          <NavLinks onNavigate={() => setOpen(false)} />
          <div className="mt-6"><DataControls dark /></div>
        </div>
      )}

      <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-secondary/70 px-5 py-2 text-[12px] text-muted-foreground md:px-10">
        <span className="rounded-sm bg-primary px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">Prototype</span>
        {isDemo ? (
          <span data-testid="status-demo">Showing <b className="text-foreground">sample data</b>. Prices are illustrative and not live.</span>
        ) : (
          <span data-testid="status-own">Your {holdings.length} holding{holdings.length === 1 ? '' : 's'}. Prices are whatever you entered, not live quotes.</span>
        )}
        <span className="inline-flex items-center gap-1"><HardDrive className="h-3 w-3" /> Saved only in this browser</span>
        <span>Not investment advice.</span>
        <Link href="/welcome" className="ml-auto font-semibold text-foreground underline-offset-4 hover:underline" data-testid="link-banner-welcome">Get early access</Link>
      </div>

      <main className="print-area mx-auto max-w-[1280px] px-5 py-8 md:px-10 md:py-10">{children}</main>

      <footer className="no-print mx-auto max-w-[1280px] px-5 pb-10 text-xs text-muted-foreground md:px-10">
        Falcon Eye is a class demo prototype. It does not connect to brokers or wallets, execute trades, or fetch market prices. Data lives in your browser's local storage.
      </footer>
    </div>
  );
}

function SidebarBody() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden px-4 py-6">
      <div className="contour pointer-events-none absolute inset-0 opacity-60" />
      <Link href="/" className="relative mb-8 flex items-center gap-2.5 px-2" data-testid="link-home">
        <Logo className="h-9 w-9 text-sidebar-foreground" />
        <div>
          <div className="text-lg font-extrabold leading-none tracking-tight">Falcon Eye</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50">one clear view</div>
        </div>
      </Link>
      <div className="relative"><NavLinks /></div>
      <div className="relative mt-auto space-y-3">
        <div className="flex items-center gap-2 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/40">
          <RotateCcw className="h-3 w-3" /> Presentation tools
        </div>
        <DataControls dark />
      </div>
    </div>
  );
}

export function PageHeader({ kicker, title, children, actions }: { kicker: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rise mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{kicker}</div>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-[44px] md:leading-[1.05]">{title}</h1>
        {children && <p className="mt-3 max-w-2xl text-muted-foreground">{children}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
