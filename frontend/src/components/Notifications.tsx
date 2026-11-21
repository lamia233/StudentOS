import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarClock, CheckCheck, GraduationCap, Target, Timer } from 'lucide-react';
import { useApiMutation, useApiQuery } from '../hooks/queries';
import { api } from '../lib/api';
import { cn, relativeDay } from '../lib/format';
import type { Notification } from '../lib/types';
import { EmptyState, IconButton } from './ui';

const ICONS: Record<string, typeof Bell> = { deadline: CalendarClock, exam: GraduationCap, study: Timer, goal: Target };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data } = useApiQuery<{ items: Notification[]; unread: number }>(['notifications'], '/notifications');
  const markAll = useApiMutation(() => api.post('/notifications/read-all'));
  const markOne = useApiMutation((id: string) => api.patch(`/notifications/${id}/read`, {}));

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = data?.unread ?? 0;
  return (
    <div className="relative" ref={ref}>
      <IconButton label={`Notifications${unread ? ` (${unread} unread)` : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} className="relative h-9 w-9">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </IconButton>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => markAll.mutate(undefined)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[26rem] overflow-y-auto scrollbar-thin">
            {!data?.items.length && <EmptyState title="You're all caught up" message="Deadline and exam alerts will appear here." />}
            {data?.items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) markOne.mutate(n.id);
                      if (n.link) navigate(n.link);
                      setOpen(false);
                    }}
                    className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60', !n.read && 'bg-brand-50/50 dark:bg-brand-500/5')}
                  >
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.read ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' : 'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300')}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm', !n.read ? 'font-semibold' : 'font-medium text-slate-700 dark:text-slate-300')}>{n.title}</span>
                        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{n.message}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{relativeDay(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
