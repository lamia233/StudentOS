import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, RotateCcw, Search, Sun, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api, errorMessage } from '../lib/api';
import { applyTheme } from '../lib/theme';
import { cn } from '../lib/format';
import { MOBILE_NAV, NAV_GROUPS } from './nav';
import { Logo } from './Logo';
import { NotificationBell } from './Notifications';
import { IconButton } from './ui';
import type { User } from '../lib/types';

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link to="/app" onClick={onNavigate} aria-label="StudentOS dashboard">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 scrollbar-thin" aria-label="Main">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
                      )
                    }
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-violet-500 text-sm font-semibold text-white" aria-hidden>
            {user?.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.university ?? user?.email}</p>
          </div>
          <IconButton
            label="Log out"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            <LogOut className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { user, setUser } = useAuth();
  const isDark = document.documentElement.classList.contains('dark');
  const [, force] = useState(0);
  return (
    <IconButton
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="h-9 w-9"
      onClick={async () => {
        const theme = isDark ? 'light' : 'dark';
        applyTheme(theme);
        force((n) => n + 1);
        if (user) {
          const r = await api.patch<{ user: User }>('/users/me', { theme }).catch(() => null);
          if (r) setUser(r.user);
        }
      }}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </IconButton>
  );
}

function DemoBanner() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-1.5 text-center text-xs text-white">
      <span>
        <strong className="font-semibold">Demo workspace</strong> — realistic sample data for a CSE student. Changes are yours to play with.
      </span>
      <button
        type="button"
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 font-medium hover:bg-white/25 disabled:opacity-60"
        onClick={async () => {
          setBusy(true);
          try {
            await api.post('/users/me/reset-demo');
            await qc.invalidateQueries();
            toast.success('Demo data restored');
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <RotateCcw className={cn('h-3 w-3', busy && 'animate-spin')} /> Reset demo
      </button>
    </div>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setDrawer(false);
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/app/knowledge');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
        <SidebarContent />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-in bg-white shadow-xl dark:bg-slate-900">
            <IconButton label="Close navigation" className="absolute right-3 top-4" onClick={() => setDrawer(false)}>
              <X className="h-5 w-5" />
            </IconButton>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {user?.isDemo && <DemoBanner />}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 sm:px-6">
          <IconButton label="Open navigation" className="h-9 w-9 lg:hidden" onClick={() => setDrawer(true)}>
            <Menu className="h-5 w-5" />
          </IconButton>
          <Link to="/app" className="lg:hidden" aria-label="StudentOS dashboard">
            <Logo withText={false} />
          </Link>
          <button
            type="button"
            onClick={() => navigate('/app/knowledge')}
            className="hidden h-9 max-w-sm flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm text-slate-500 transition-colors hover:bg-slate-200/70 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:bg-slate-800 sm:flex"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search notes, tasks, exams…</span>
            <kbd className="rounded border border-slate-300 px-1.5 text-[10px] font-medium dark:border-slate-600">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 pb-24 pt-6 outline-none sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden" aria-label="Quick">
        {MOBILE_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500')}>
            <item.icon className="h-5 w-5" aria-hidden />
            {item.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
          <Menu className="h-5 w-5" aria-hidden />
          More
        </button>
      </nav>
    </div>
  );
}
