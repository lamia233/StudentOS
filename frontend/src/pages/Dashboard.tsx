import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Briefcase, CalendarClock, CheckCircle2, Circle, Clock, Flame, GraduationCap, Lightbulb, MapPin, Plus, Radar, Sparkles, Target, Timer, TrendingUp } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useApiMutation, useApiQuery } from '../hooks/queries';
import { api } from '../lib/api';
import { cn, formatMinutes, formatTime, LEVEL_STYLES } from '../lib/format';
import type { Dashboard as DashboardData } from '../lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageLoader, Progress, ProgressRing } from '../components/ui';
import { PriorityBadge, RadarRow, RecommendationCard } from '../components/shared';

const HEALTH = {
  'on-track': { label: 'On track', cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
  'at-risk': { label: 'At risk', cls: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400' },
  behind: { label: 'Behind', cls: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400' },
};

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useApiQuery<DashboardData>(['dashboard'], '/dashboard');
  const navigate = useNavigate();
  const toggle = useApiMutation((id: string) => api.post(`/tasks/${id}/toggle`), { invalidate: [['tasks']] });

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error?.message ?? 'No data'} onRetry={() => refetch()} />;

  const firstName = data.user.name.split(' ')[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const studyPct = data.study.goalMinutes ? Math.round((data.study.minutesThisWeek / data.study.goalMinutes) * 100) : 0;
  const score = data.productivity.score.score;
  const taskDelta = data.productivity.tasksCompleted - data.productivity.lastWeekTasksCompleted;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600 to-violet-600 p-6 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-brand-100">{today}</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{data.greeting}, {firstName}</h1>
            <p className="mt-2 max-w-xl text-sm text-brand-100">
              {data.nextDeadline ? (
                <>Next important deadline: <strong className="text-white">{data.nextDeadline.title}</strong> — {data.nextDeadline.label}.</>
              ) : (
                'No upcoming deadlines. A great day to get ahead.'
              )}{' '}
              You have about <strong className="text-white">{formatMinutes(data.availableMinutes)}</strong> of study time planned today.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" className="ring-0" onClick={() => navigate('/app/planner')} icon={<Sparkles className="h-4 w-4" />}>Plan my week</Button>
              <Button className="bg-white/15 hover:bg-white/25" onClick={() => navigate('/app/focus')} icon={<Timer className="h-4 w-4" />}>Start focus</Button>
              <Button className="bg-white/15 hover:bg-white/25" onClick={() => navigate('/app/tasks?new=1')} icon={<Plus className="h-4 w-4" />}>Add task</Button>
            </div>
          </div>
          {data.semester.progress !== null && (
            <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur">
              <ProgressRing value={data.semester.progress} size={84} stroke={8} color="#fff" label={`Semester ${data.semester.progress}% complete`}>
                <span className="text-lg font-bold">{data.semester.progress}%</span>
              </ProgressRing>
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-100">{data.user.semester ?? 'Semester'}</p>
                <p className="text-lg font-semibold">Week {data.semester.week} of {data.semester.weeks}</p>
                <p className="text-xs text-brand-100">{data.user.university}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/app/productivity" className="block"><Card className="h-full p-4 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">Productivity score</p><TrendingUp className="h-4 w-4 text-brand-500" /></div>
          <p className="mt-2 text-2xl font-bold">{score}<span className="text-sm font-medium text-slate-400">/100</span></p>
          <Progress value={score} className="mt-2" label="Productivity score" />
        </Card></Link>
        <Link to="/app/productivity" className="block"><Card className="h-full p-4 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">Study this week</p><Clock className="h-4 w-4 text-emerald-500" /></div>
          <p className="mt-2 text-2xl font-bold">{formatMinutes(data.study.minutesThisWeek)}</p>
          <p className="text-xs text-slate-500">{studyPct}% of your {Math.round(data.study.goalMinutes / 60)}h goal</p>
        </Card></Link>
        <Card className="p-4">
          <div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">Tasks completed</p><CheckCircle2 className="h-4 w-4 text-sky-500" /></div>
          <p className="mt-2 text-2xl font-bold">{data.productivity.tasksCompleted}</p>
          <p className={cn('text-xs', taskDelta >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{taskDelta >= 0 ? '+' : ''}{taskDelta} vs last week</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">Study streak</p><Flame className="h-4 w-4 text-orange-500" /></div>
          <p className="mt-2 text-2xl font-bold">{data.productivity.streak} {data.productivity.streak === 1 ? 'day' : 'days'}</p>
          <p className="text-xs text-slate-500">Keep it going today</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Today's priorities" subtitle="Ranked by the StudentOS priority score" icon={<Target className="h-4 w-4" />} action={<Link to="/app/planner" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Why this order?</Link>} />
          <div className="p-3">
            {data.focus.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />} title="Nothing urgent today" message="Add assignments, exams or tasks and StudentOS will rank them for you." />
            ) : (
              <ol className="space-y-2">
                {data.focus.map((f, i) => (
                  <li key={f.id + i} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{i + 1}</span>
                    <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: f.color ?? '#94a3b8' }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.title}</p>
                      <p className="truncate text-xs text-slate-500">{f.reason}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <PriorityBadge priority={f.priority} />
                      <p className="mt-1 text-xs text-slate-500">{formatMinutes(f.minutes)}</p>
                    </div>
                    <Button size="sm" variant="ghost" aria-label={`Focus on ${f.title}`} onClick={() => navigate(`/app/focus?title=${encodeURIComponent(f.title)}&minutes=${Math.min(f.minutes, 50)}&kind=${f.kind}&id=${f.id}`)}>
                      <Timer className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Deadline Radar" subtitle="Next 10 days" icon={<Radar className="h-4 w-4" />} action={<Link to="/app/radar" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Open</Link>} />
          <div className="grid grid-cols-4 gap-2 px-5 pt-4">
            {(Object.keys(LEVEL_STYLES) as (keyof typeof LEVEL_STYLES)[]).map((k) => (
              <div key={k} className={cn('rounded-xl p-2 text-center', LEVEL_STYLES[k].bg)}>
                <p className={cn('text-lg font-bold', LEVEL_STYLES[k].text)}>{data.radar.counts[k]}</p>
                <p className="text-[10px] font-medium text-slate-500">{LEVEL_STYLES[k].label}</p>
              </div>
            ))}
          </div>
          <div className="p-2">
            {data.radar.items.length ? data.radar.items.slice(0, 5).map((r) => <RadarRow key={r.kind + r.id} item={r} />) : <EmptyState title="No deadlines ahead" />}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Today's schedule" icon={<CalendarClock className="h-4 w-4" />} action={<Link to="/app/calendar" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Calendar</Link>} />
          <div className="p-3">
            {data.schedule.length === 0 ? (
              <EmptyState title="No classes or events today" message="Use the planner to schedule study blocks." />
            ) : (
              <ul className="space-y-1">
                {data.schedule.map((s) => (
                  <li key={s.id} className="flex gap-3 rounded-lg px-2 py-2">
                    <div className="w-16 shrink-0 text-right text-xs font-medium text-slate-500">{formatTime(s.start)}</div>
                    <span className="w-1 shrink-0 rounded-full" style={{ background: s.color ?? '#6366f1' }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.title}</p>
                      <p className="flex items-center gap-1 text-xs capitalize text-slate-500">{s.type}{s.location && <><MapPin className="ml-1 h-3 w-3" />{s.location}</>}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Due today" icon={<CheckCircle2 className="h-4 w-4" />} action={<Link to="/app/tasks" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">All tasks</Link>} />
          <div className="p-3">
            {data.todayTasks.length === 0 ? (
              <EmptyState title="No tasks due today" />
            ) : (
              <ul className="space-y-1">
                {data.todayTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <button type="button" onClick={() => toggle.mutate(t.id)} aria-label={t.status === 'done' ? `Mark ${t.title} as not done` : `Complete ${t.title}`} className="shrink-0 text-slate-400 hover:text-brand-600">
                      {t.status === 'done' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <span className={cn('min-w-0 flex-1 truncate text-sm', t.status === 'done' && 'text-slate-400 line-through')}>{t.title}</span>
                    {t.course && <Badge color={t.course.color}>{t.course.code}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Upcoming exams" icon={<GraduationCap className="h-4 w-4" />} action={<Link to="/app/academics?tab=exams" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">All</Link>} />
          <div className="space-y-3 p-5 pt-4">
            {data.exams.length === 0 && <EmptyState title="No upcoming exams" />}
            {data.exams.map((e) => (
              <div key={e.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <span className="shrink-0 text-xs font-semibold capitalize text-rose-600 dark:text-rose-400">{e.label}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Progress value={e.preparation} color={e.color} label={`${e.name} preparation`} />
                  <span className="w-9 text-right text-xs text-slate-500">{e.preparation}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Study hours this week" subtitle={`${formatMinutes(data.study.minutesThisWeek)} of ${formatMinutes(data.study.goalMinutes)} goal`} icon={<Clock className="h-4 w-4" />} />
          <div className="h-56 px-2 pb-3 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.study.week.map((d) => ({ ...d, hours: +(d.studyMinutes / 60).toFixed(1) }))}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
                <Tooltip cursor={{ fill: 'rgba(99,102,241,0.08)' }} formatter={(v) => [`${v} h`, 'Study']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="hours" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Recommendations" subtitle="Based on your data" icon={<Lightbulb className="h-4 w-4" />} />
          <div className="space-y-2 p-4">
            {data.recommendations.length === 0 ? <EmptyState title="You're on track" message="No issues detected right now." /> : data.recommendations.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Course health" icon={<BookOpen className="h-4 w-4" />} action={<Link to="/app/academics" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Courses</Link>} />
          <ul className="space-y-3 p-5 pt-4">
            {data.courseHealth.length === 0 && <EmptyState title="No courses yet" action={<Button size="sm" onClick={() => navigate('/app/academics')}>Add a course</Button>} />}
            {data.courseHealth.map((c) => (
              <li key={c.id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} /><span className="truncate font-medium">{c.code}</span><span className="hidden truncate text-xs text-slate-500 sm:inline">{c.name}</span></span>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', HEALTH[c.status].cls)}>{HEALTH[c.status].label}</span>
                </div>
                <Progress value={c.progress} color={c.color} className="mt-1.5 h-1.5" label={`${c.code} progress`} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Career progress" icon={<Briefcase className="h-4 w-4" />} action={<Link to="/app/career" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Career</Link>} />
          <div className="p-5 pt-4">
            {data.career.goals.length === 0 ? (
              <EmptyState title="No career goals yet" action={<Button size="sm" onClick={() => navigate('/app/career')}>Set a goal</Button>} />
            ) : (
              <div className="space-y-4">
                {data.career.goals.slice(0, 3).map((g) => (
                  <div key={g.id}>
                    <div className="flex justify-between text-sm"><span className="truncate font-medium">{g.title}</span><span className="text-slate-500">{g.progress}%</span></div>
                    <Progress value={g.progress} color="#8b5cf6" className="mt-1.5" label={`${g.title} progress`} />
                    {g.nextMilestone && <p className="mt-1 truncate text-xs text-slate-500">Next: {g.nextMilestone}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Skills" icon={<Sparkles className="h-4 w-4" />} action={<Link to="/app/skills" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Skills</Link>} />
          <ul className="space-y-3 p-5 pt-4">
            {data.skills.length === 0 && <EmptyState title="No skills tracked" />}
            {data.skills.map((s) => (
              <li key={s.id}>
                <div className="flex justify-between text-sm"><span className="font-medium">{s.name}</span><span className="text-xs text-slate-500">Lv {s.currentLevel}/{s.targetLevel}</span></div>
                <Progress value={s.progress} color="#10b981" className="mt-1.5 h-1.5" label={`${s.name} progress`} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {data.notion && (
        <Link to="/app/notion" className="flex items-center justify-between rounded-2xl border border-dashed border-slate-300 px-5 py-3 text-sm text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-400">
          <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Notion: <strong className="font-medium text-slate-900 dark:text-white">{data.notion.mode === 'live' ? 'Live connection' : 'Demo mode (simulated)'}</strong></span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
