import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import { cn, LEVEL_STYLES, PRIORITY_STYLES } from '../lib/format';
import type { Recommendation, RadarItem } from '../lib/types';
import { Badge } from './ui';

export function PriorityBadge({ priority }: { priority: string }) {
  const key = priority.toLowerCase();
  return <Badge className={cn('capitalize', PRIORITY_STYLES[key] ?? PRIORITY_STYLES.low)}>{priority}</Badge>;
}

export function CourseTag({ code, color }: { code: string; color: string }) {
  return (
    <Badge color={color}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {code}
    </Badge>
  );
}

const REC_STYLES = {
  critical: { icon: AlertTriangle, cls: 'border-rose-200 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/5', ic: 'text-rose-500' },
  warning: { icon: AlertTriangle, cls: 'border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/5', ic: 'text-amber-500' },
  info: { icon: Lightbulb, cls: 'border-sky-200 bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-500/5', ic: 'text-sky-500' },
  success: { icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/5', ic: 'text-emerald-500' },
};

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const s = REC_STYLES[rec.severity] ?? { icon: Info, cls: '', ic: '' };
  return (
    <div className={cn('flex gap-3 rounded-xl border p-3', s.cls)}>
      <s.icon className={cn('mt-0.5 h-4 w-4 shrink-0', s.ic)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{rec.title}</p>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{rec.message}</p>
        {rec.action && (
          <Link to={rec.action.link} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
            {rec.action.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function RadarRow({ item }: { item: RadarItem }) {
  const s = LEVEL_STYLES[item.level];
  return (
    <Link to={item.link} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', s.dot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
        <p className="truncate text-xs text-slate-500">
          <span className="capitalize">{item.kind === 'registration' ? 'Registration' : item.kind}</span>
          {item.courseCode && ` · ${item.courseCode}`}
          {item.progress > 0 && ` · ${item.progress}% done`}
        </p>
      </div>
      <span className={cn('shrink-0 text-xs font-semibold capitalize', s.text)}>{item.overdue ? 'Overdue' : item.label}</span>
    </Link>
  );
}
