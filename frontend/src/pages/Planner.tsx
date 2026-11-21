import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarPlus, ChevronDown, Info, Sparkles, Wand2 } from 'lucide-react';
import { useApiMutation, useApiQuery, useCourses } from '../hooks/queries';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn, formatMinutes, formatTime, relativeDay } from '../lib/format';
import type { ScoredItem, StudyTime, WeekPlan } from '../lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, PageLoader, Select } from '../components/ui';
import { CourseTag } from '../components/shared';

const PARTS = [
  { key: 'urgency', label: 'Urgency', max: 35, color: '#f43f5e' },
  { key: 'priority', label: 'Priority', max: 25, color: '#f59e0b' },
  { key: 'effort', label: 'Effort', max: 15, color: '#6366f1' },
  { key: 'exam', label: 'Exam', max: 15, color: '#0ea5e9' },
  { key: 'completion', label: 'Remaining', max: 10, color: '#10b981' },
] as const;

function ScoreBar({ item }: { item: ScoredItem }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={`Score ${item.score}: ${PARTS.map((p) => `${p.label} ${Math.round(item.breakdown[p.key])}`).join(', ')}`}>
      {PARTS.map((p) => <span key={p.key} style={{ width: `${item.breakdown[p.key]}%`, background: p.color }} />)}
    </div>
  );
}

export default function Planner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: ranked, isLoading, error, refetch } = useApiQuery<ScoredItem[]>(['priorities'], '/planner/priorities');
  const { data: courses } = useCourses();
  const baseDaily = Math.round(((user?.studyHoursPerWeek ?? 14) * 60) / 7 / 15) * 15;
  const [weekday, setWeekday] = useState(baseDaily || 120);
  const [weekend, setWeekend] = useState(Math.round((baseDaily * 1.5) / 15) * 15 || 180);
  const [time, setTime] = useState<StudyTime>(user?.preferredStudyTime ?? 'evening');
  const [block, setBlock] = useState(60);
  const [brk, setBrk] = useState(15);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [nonAcademic, setNonAcademic] = useState(true);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const dailyMinutes = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.getDay() === 0 || d.getDay() === 6 ? weekend : weekday;
  }), [weekday, weekend]);

  const generate = useApiMutation(() => api.post<WeekPlan>('/planner/week', { dailyMinutes, preferredTime: time, blockMinutes: block, breakMinutes: brk, includeNonAcademic: nonAcademic, courseIds: courseIds.length ? courseIds : undefined }), {
    onSuccess: setPlan,
    success: (p) => `Planned ${formatMinutes(p.totalMinutes)} across ${p.days.filter((d) => d.blocks.length).length} days`,
  });
  const save = useApiMutation(() => api.post<{ saved: number }>('/planner/save', { blocks: plan!.days.flatMap((d) => d.blocks.map((b) => ({ title: b.title, start: b.start, end: b.end, courseId: b.courseId }))), replaceExisting: true }), {
    invalidate: [['calendar']],
    success: (r) => `${r.saved} study blocks added to your calendar`,
  });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader title="Smart Study Planner" icon={<Sparkles className="h-5 w-5" />} description="Transparent priority scores turn your deadlines, exams and effort into a realistic weekly plan." />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Plan My Week" subtitle="Set your availability, then generate" icon={<Wand2 className="h-4 w-4" />} />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Weekday study (min)">{(id) => <Input id={id} type="number" min={0} max={720} step={15} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} />}</Field>
              <Field label="Weekend study (min)">{(id) => <Input id={id} type="number" min={0} max={720} step={15} value={weekend} onChange={(e) => setWeekend(Number(e.target.value))} />}</Field>
              <Field label="Preferred time">{(id) => <Select id={id} value={time} onChange={(e) => setTime(e.target.value as StudyTime)}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="night">Night</option></Select>}</Field>
              <Field label="Block / break (min)">{(id) => (
                <div className="flex gap-2"><Input id={id} type="number" min={15} max={180} step={5} value={block} onChange={(e) => setBlock(Number(e.target.value))} aria-label="Block length" /><Input type="number" min={0} max={60} step={5} value={brk} onChange={(e) => setBrk(Number(e.target.value))} aria-label="Break length" /></div>
              )}</Field>
              <fieldset className="sm:col-span-2">
                <legend className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">Courses (none selected = all)</legend>
                <div className="flex flex-wrap gap-2">
                  {courses?.map((c) => {
                    const on = courseIds.includes(c.id);
                    return <button key={c.id} type="button" aria-pressed={on} onClick={() => setCourseIds(on ? courseIds.filter((x) => x !== c.id) : [...courseIds, c.id])} className={cn('rounded-full border px-3 py-1 text-xs font-medium', on ? 'border-transparent text-white' : 'border-slate-200 dark:border-slate-700')} style={on ? { background: c.color } : undefined}>{c.code}</button>;
                  })}
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={nonAcademic} onChange={(e) => setNonAcademic(e.target.checked)} />Include career &amp; personal tasks</label>
              <Button className="sm:col-span-2" size="lg" onClick={() => generate.mutate()} loading={generate.isPending} icon={<Sparkles className="h-4 w-4" />}>Generate weekly plan</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Priority ranking" subtitle={`${ranked?.length ?? 0} open items scored 0–100`} icon={<Info className="h-4 w-4" />} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-5 pt-3 text-[11px] text-slate-500">
              {PARTS.map((p) => <span key={p.key} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.label} ≤{p.max}</span>)}
            </div>
            <ol className="space-y-1 p-3">
              {!ranked?.length && <EmptyState title="Nothing to plan" message="Add assignments, exams or tasks first." />}
              {ranked?.slice(0, 12).map((r, i) => (
                <li key={r.kind + r.id} className="rounded-xl border border-slate-100 dark:border-slate-800">
                  <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="flex w-full items-center gap-3 p-3 text-left">
                    <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.displayTitle}</p>
                      <div className="mt-1.5"><ScoreBar item={r} /></div>
                    </div>
                    <span className="w-9 text-right text-sm font-bold tabular-nums">{Math.round(r.score)}</span>
                    <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', open === r.id && 'rotate-180')} />
                  </button>
                  {open === r.id && (
                    <div className="border-t border-slate-100 px-4 py-3 text-xs dark:border-slate-800">
                      <p className="text-slate-600 dark:text-slate-400">{r.reason}</p>
                      <dl className="mt-2 grid grid-cols-5 gap-2 text-center">
                        {PARTS.map((p) => <div key={p.key}><dt className="text-slate-400">{p.label}</dt><dd className="font-semibold">{Math.round(r.breakdown[p.key] * 10) / 10}</dd></div>)}
                      </dl>
                      <p className="mt-2 text-slate-500">{r.dueDate ? `Due ${relativeDay(r.dueDate)}` : 'No deadline'} · {formatMinutes(r.remainingMinutes)} left · {r.progress}% done</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="min-w-0 xl:col-span-3">
          <Card>
            <CardHeader
              title="Your week"
              subtitle={plan ? `${formatMinutes(plan.totalMinutes)} scheduled from ${plan.considered} items` : 'Generate a plan to see study blocks'}
              icon={<CalendarPlus className="h-4 w-4" />}
              action={plan && plan.totalMinutes > 0 && <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} icon={<CalendarPlus className="h-4 w-4" />}>Add to calendar</Button>}
            />
            {!plan ? (
              <EmptyState icon={<Wand2 className="h-6 w-6" />} title="No plan yet" message="StudentOS schedules the highest-priority work first, finishes it before its deadline and warns you when there isn't enough time." action={<Button onClick={() => generate.mutate()} loading={generate.isPending} icon={<Sparkles className="h-4 w-4" />}>Generate weekly plan</Button>} />
            ) : (
              <div className="p-4">
                {plan.warnings.length > 0 && (
                  <div className="mb-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300" role="alert">
                    {plan.warnings.map((w) => <p key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</p>)}
                  </div>
                )}
                <div className="space-y-4">
                  {plan.days.map((d) => (
                    <section key={d.date} aria-label={new Date(d.date).toDateString()}>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
                        <span className="text-xs text-slate-500">{formatMinutes(d.plannedMinutes)} / {formatMinutes(d.availableMinutes)}</span>
                      </div>
                      {d.blocks.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700">Free — no study blocks</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {d.blocks.map((b, i) => (
                            <li key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5 dark:border-slate-800">
                              <span className="w-24 shrink-0 text-xs font-medium text-slate-500">{formatTime(b.start)}–{formatTime(b.end)}</span>
                              <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: b.color ?? '#94a3b8' }} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{b.title}</p>
                                <p className="truncate text-xs text-slate-500">{b.reason}</p>
                              </div>
                              {b.courseCode && b.color ? <CourseTag code={b.courseCode} color={b.color} /> : <Badge className="capitalize">{b.kind}</Badge>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
                <div className="mt-5 flex justify-end"><Button variant="secondary" onClick={() => navigate('/app/calendar')}>Open calendar</Button></div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
