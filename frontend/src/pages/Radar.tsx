import { useState } from 'react';
import { Radar as RadarIcon } from 'lucide-react';
import { useApiQuery } from '../hooks/queries';
import { cn, formatDateTime, LEVEL_STYLES } from '../lib/format';
import type { Radar as RadarData, RadarItem } from '../lib/types';
import { Card, EmptyState, ErrorState, PageHeader, PageLoader, Progress, Tabs } from '../components/ui';
import { CourseTag, PriorityBadge } from '../components/shared';
import { Link } from 'react-router-dom';

type Level = RadarItem['level'];
const LEVELS = Object.keys(LEVEL_STYLES) as Level[];
const HINT: Record<Level, string> = { critical: 'Overdue, today or tomorrow', approaching: 'Within 4 days', upcoming: 'Within 10 days', safe: 'Later' };

export default function Radar() {
  const { data, isLoading, error, refetch } = useApiQuery<RadarData>(['radar'], '/radar');
  const [kind, setKind] = useState<'all' | RadarItem['kind']>('all');
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error?.message ?? 'No data'} onRetry={() => refetch()} />;
  const items = data.items.filter((i) => kind === 'all' || i.kind === kind);

  return (
    <div>
      <PageHeader title="Deadline Radar" icon={<RadarIcon className="h-5 w-5" />} description="Every deadline grouped by how soon it needs your attention." />
      <Tabs
        className="mb-5"
        value={kind}
        onChange={setKind}
        tabs={[
          { value: 'all', label: 'Everything', count: data.items.length },
          { value: 'assignment', label: 'Assignments' },
          { value: 'exam', label: 'Exams' },
          { value: 'task', label: 'Tasks' },
          { value: 'registration', label: 'Registrations' },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {LEVELS.map((level) => {
          const s = LEVEL_STYLES[level];
          const group = items.filter((i) => i.level === level);
          return (
            <Card key={level} className={cn('ring-1', s.ring)} aria-labelledby={`radar-${level}`}>
              <div className={cn('flex items-center justify-between rounded-t-2xl px-4 py-3', s.bg)}>
                <div>
                  <h2 id={`radar-${level}`} className={cn('flex items-center gap-2 text-sm font-semibold', s.text)}><span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} />{s.label}</h2>
                  <p className="text-xs text-slate-500">{HINT[level]}</p>
                </div>
                <span className={cn('text-2xl font-bold', s.text)}>{group.length}</span>
              </div>
              <ul className="space-y-2 p-3">
                {group.length === 0 && <EmptyState title="Nothing here" className="py-6" />}
                {group.map((i) => (
                  <li key={i.kind + i.id}>
                    <Link to={i.link} className="block rounded-xl border border-slate-100 p-3 transition-colors hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{i.title}</p>
                        <span className={cn('shrink-0 text-xs font-semibold capitalize', s.text)}>{i.overdue ? 'Overdue' : i.label}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="capitalize">{i.kind}</span>
                        {i.courseCode && i.color && <CourseTag code={i.courseCode} color={i.color} />}
                        {['low', 'medium', 'high', 'critical'].includes(String(i.priority)) && <PriorityBadge priority={String(i.priority)} />}
                        <span>· {formatDateTime(i.due)}</span>
                      </div>
                      {i.progress > 0 && <Progress value={i.progress} color={i.color ?? undefined} className="mt-2 h-1.5" label={`${i.title} progress`} />}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
