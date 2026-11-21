import { BarChart3, CalendarCheck, Clock, Flame, Target, Timer, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiQuery } from '../hooks/queries';
import { formatMinutes } from '../lib/format';
import type { Productivity as Data } from '../lib/types';
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, PageLoader, Progress, ProgressRing } from '../components/ui';

const tip = { contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 } };

export default function Productivity() {
  const { data, isLoading, error, refetch } = useApiQuery<Data>(['productivity'], '/productivity');
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error?.message ?? 'No data'} onRetry={() => refetch()} />;
  const t = data.thisWeek;
  const goalPct = t.weeklyGoalMinutes ? Math.round((t.studyMinutes / t.weeklyGoalMinutes) * 100) : 0;
  const stats = [
    { icon: Clock, label: 'Study time', value: formatMinutes(t.studyMinutes), sub: `${goalPct}% of weekly goal`, c: 'text-emerald-500' },
    { icon: CalendarCheck, label: 'Tasks completed', value: t.tasksCompleted, sub: `${t.tasksCompleted - data.lastWeek.tasksCompleted >= 0 ? '+' : ''}${t.tasksCompleted - data.lastWeek.tasksCompleted} vs last week`, c: 'text-sky-500' },
    { icon: Timer, label: 'Focus sessions', value: t.focusSessions, sub: 'this week', c: 'text-brand-500' },
    { icon: Target, label: 'Completion rate', value: t.completionRate === null ? '—' : `${t.completionRate}%`, sub: `${t.overdue} overdue`, c: 'text-amber-500' },
    { icon: Flame, label: 'Study streak', value: `${data.streak}d`, sub: data.mostProductiveDay ? `Best day: ${data.mostProductiveDay}` : 'Log a session to start', c: 'text-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Productivity" icon={<BarChart3 className="h-5 w-5" />} description="Computed from your real study sessions, completed work and deadlines." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">{s.label}</p><s.icon className={`h-4 w-4 ${s.c}`} /></div>
            <p className="mt-2 text-2xl font-bold">{s.value}</p><p className="text-xs text-slate-500">{s.sub}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Productivity score" subtitle="How it's calculated" icon={<TrendingUp className="h-4 w-4" />} />
          <div className="flex flex-col items-center p-5">
            <ProgressRing value={data.score.score} size={140} stroke={12} label={`Productivity score ${data.score.score} of 100`}><span className="text-3xl font-bold">{data.score.score}</span><span className="text-xs text-slate-500">of 100</span></ProgressRing>
            <ul className="mt-5 w-full space-y-3">
              {data.score.components.map((c) => (
                <li key={c.key}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{c.label}</span><span className="tabular-nums text-slate-500">{Math.round(c.points)}/{c.max}</span></div>
                  <Progress value={(c.points / c.max) * 100} className="mt-1 h-1.5" label={c.label} />
                  <p className="mt-0.5 text-xs text-slate-500">{c.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="This week" subtitle="Study hours and tasks completed per day" icon={<Clock className="h-4 w-4" />} />
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.week.map((d) => ({ ...d, hours: +(d.studyMinutes / 60).toFixed(1) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" width={28} />
                <Tooltip {...tip} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="hours" name="Study hours" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="tasksCompleted" name="Tasks done" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Weekly trend" subtitle="Last weeks" icon={<TrendingUp className="h-4 w-4" />} />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weeks}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" width={28} />
                <Tooltip {...tip} />
                <Line type="monotone" dataKey="studyHours" name="Study hours" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="tasksCompleted" name="Tasks done" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Course workload" subtitle="Remaining work vs. hours studied (14 days)" icon={<BarChart3 className="h-4 w-4" />} />
          <ul className="space-y-3 p-5">
            {!data.courseWorkload.length && <EmptyState title="No courses yet" />}
            {data.courseWorkload.map((c) => {
              const max = Math.max(...data.courseWorkload.map((x) => Math.max(x.remainingHours, x.studiedHours14d)), 1);
              return (
                <li key={c.courseId}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{c.code} <span className="text-xs font-normal text-slate-500">{c.name}</span></span><span className="text-xs text-slate-500">{c.remainingHours}h left · {c.studiedHours14d}h studied</span></div>
                  <div className="mt-1 space-y-1"><Progress value={(c.remainingHours / max) * 100} color={c.color} className="h-1.5" label={`${c.code} remaining`} /><Progress value={(c.studiedHours14d / max) * 100} color="#94a3b8" className="h-1.5" label={`${c.code} studied`} /></div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      {data.goals.length > 0 && (
        <Card>
          <CardHeader title="Goal progress" icon={<Target className="h-4 w-4" />} />
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.goals.map((g) => <div key={g.id}><div className="flex justify-between text-sm"><span className="truncate font-medium">{g.title}</span><span className="text-slate-500">{g.done}/{g.total}</span></div><Progress value={g.progress} color="#8b5cf6" className="mt-1.5" label={g.title} /></div>)}
          </div>
        </Card>
      )}
    </div>
  );
}
