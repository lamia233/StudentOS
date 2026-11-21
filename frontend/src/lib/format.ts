import clsx, { type ClassValue } from 'clsx';

export const cn = (...v: ClassValue[]) => clsx(v);

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function daysFromToday(date: string | Date) {
  return Math.round((startOfDay(new Date(date)).getTime() - startOfDay(new Date()).getTime()) / DAY);
}

export function relativeDay(date: string | Date) {
  const d = daysFromToday(date);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d < 0) return `${-d} days ago`;
  if (d < 7) return `In ${d} days`;
  return formatDate(date);
}

export const formatDate = (date: string | Date, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  new Date(date).toLocaleDateString(undefined, opts);

export const formatTime = (date: string | Date) => new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatDateTime = (date: string | Date) => `${formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(date)}`;

export function formatMinutes(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** Converts an ISO date to the value format of <input type="datetime-local">. */
export function toLocalInput(date: string | Date | null | undefined) {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateInput(date: string | Date | null | undefined) {
  return toLocalInput(date).slice(0, 10);
}

export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const splitTags = (tags: string | null | undefined) => (tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);

export const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
};

export const LEVEL_STYLES = {
  critical: { label: 'Critical', dot: 'bg-rose-500', ring: 'ring-rose-200 dark:ring-rose-500/30', text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' },
  approaching: { label: 'Approaching', dot: 'bg-orange-500', ring: 'ring-orange-200 dark:ring-orange-500/30', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  upcoming: { label: 'Upcoming', dot: 'bg-amber-400', ring: 'ring-amber-200 dark:ring-amber-500/30', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  safe: { label: 'Safe', dot: 'bg-emerald-500', ring: 'ring-emerald-200 dark:ring-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
} as const;

export const EVENT_COLORS: Record<string, string> = {
  class: '#6366f1',
  academic: '#3b82f6',
  study: '#10b981',
  exam: '#ef4444',
  assignment: '#f59e0b',
  career: '#8b5cf6',
  personal: '#64748b',
};

export const greetingFor = (d = new Date()) => {
  const h = d.getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
