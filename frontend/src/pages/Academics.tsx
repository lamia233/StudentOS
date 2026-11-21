import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, ClipboardList, GraduationCap, MapPin, Pencil, Plus, Trash2, User } from 'lucide-react';
import { useApiMutation, useApiQuery, useCourses } from '../hooks/queries';
import { api } from '../lib/api';
import { cn, formatDateTime, fromLocalInput, relativeDay, toLocalInput } from '../lib/format';
import type { Assignment, ClassMeeting, Course, Exam } from '../lib/types';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, Modal, PageHeader, PageLoader, Progress, Select, Tabs, Textarea } from '../components/ui';
import { CourseTag, PriorityBadge } from '../components/shared';

type Tab = 'courses' | 'assignments' | 'exams';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
const STATUS: Record<Assignment['status'], string> = { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed' };
type Del = { kind: 'courses' | 'assignments' | 'exams'; id: string; name: string } | null;

export default function Academics() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'courses';
  const { data: courses, isLoading, error, refetch } = useCourses();
  const { data: assignments } = useApiQuery<Assignment[]>(['assignments'], '/assignments');
  const { data: exams } = useApiQuery<Exam[]>(['exams'], '/exams');
  const [form, setForm] = useState<{ kind: Tab; item?: Course | Assignment | Exam } | null>(null);
  const [del, setDel] = useState<Del>(null);
  const remove = useApiMutation((d: NonNullable<Del>) => api.del(`/${d.kind}/${d.id}`), { invalidate: [['assignments'], ['exams'], ['tasks']], success: 'Deleted', onSuccess: () => setDel(null) });
  const patchA = useApiMutation((v: { id: string } & Partial<Assignment>) => api.patch(`/assignments/${v.id}`, v), { invalidate: [['assignments']] });
  const patchE = useApiMutation((v: { id: string; preparation: number }) => api.patch(`/exams/${v.id}`, { preparation: v.preparation }), { invalidate: [['exams']] });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  const noCourses = !courses?.length;
  const label = { courses: 'course', assignments: 'assignment', exams: 'exam' }[tab];

  return (
    <div>
      <PageHeader title="Courses & Exams" icon={<GraduationCap className="h-5 w-5" />} description="Your courses, assignments and exam preparation." actions={<Button icon={<Plus className="h-4 w-4" />} disabled={tab !== 'courses' && noCourses} onClick={() => setForm({ kind: tab })}>New {label}</Button>} />
      <Tabs<Tab> className="mb-5" value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ value: 'courses', label: 'Courses', count: courses?.length, icon: <BookOpen className="h-3.5 w-3.5" /> }, { value: 'assignments', label: 'Assignments', count: assignments?.filter((a) => a.status !== 'completed').length, icon: <ClipboardList className="h-3.5 w-3.5" /> }, { value: 'exams', label: 'Exams', count: exams?.filter((e) => new Date(e.date) > new Date()).length, icon: <GraduationCap className="h-3.5 w-3.5" /> }]} />

      {tab === 'courses' && (noCourses ? <Card><EmptyState icon={<BookOpen className="h-6 w-6" />} title="No courses yet" message="Add your courses to start tracking assignments and exams." action={<Button onClick={() => setForm({ kind: 'courses' })}>Add a course</Button>} /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses!.map((c) => {
            const open = c.assignments.filter((a) => a.status !== 'completed');
            const next = c.exams.filter((e) => new Date(e.date) > new Date()).sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];
            const prog = c.assignments.length ? Math.round(c.assignments.reduce((s, a) => s + (a.status === 'completed' ? 100 : a.progress), 0) / c.assignments.length) : 0;
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="h-1.5" style={{ background: c.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="text-xs font-semibold" style={{ color: c.color }}>{c.code} · {c.credits} cr</p><h2 className="truncate font-semibold">{c.name}</h2></div>
                    <div className="flex"><IconButton label={`Edit ${c.name}`} onClick={() => setForm({ kind: 'courses', item: c })}><Pencil className="h-4 w-4" /></IconButton><IconButton label={`Delete ${c.name}`} onClick={() => setDel({ kind: 'courses', id: c.id, name: c.name })}><Trash2 className="h-4 w-4" /></IconButton></div>
                  </div>
                  {c.instructor && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><User className="h-3 w-3" />{c.instructor}</p>}
                  <div className="mt-3 flex flex-wrap gap-1">{c.schedule.map((m, i) => <Badge key={i}>{DAYS[m.day]} {m.start}{m.room && ` · ${m.room}`}</Badge>)}</div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60"><p className="text-base font-bold">{open.length}</p><p className="text-slate-500">open</p></div>
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60"><p className="text-base font-bold">{c.exams.length}</p><p className="text-slate-500">exams</p></div>
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60"><p className="text-base font-bold">{c._count.notesList}</p><p className="text-slate-500">notes</p></div>
                  </div>
                  <div className="mt-4"><div className="flex justify-between text-xs text-slate-500"><span>Coursework progress</span><span>{prog}%</span></div><Progress value={prog} color={c.color} className="mt-1 h-1.5" label={`${c.code} coursework progress`} /></div>
                  {next && <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">Next exam <strong>{relativeDay(next.date)}</strong> · {next.preparation}% prepared</p>}
                </div>
              </Card>
            );
          })}
        </div>
      ))}

      {tab === 'assignments' && (!assignments?.length ? <Card><EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No assignments" message={noCourses ? 'Add a course first.' : 'Add your first assignment.'} /></Card> : (
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...assignments].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || +new Date(a.deadline) - +new Date(b.deadline)).map((a) => (
            <div key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className={cn('font-medium', a.status === 'completed' && 'text-slate-400 line-through')}>{a.title}</p><CourseTag code={a.course.code} color={a.course.color} /><PriorityBadge priority={a.priority} /><Badge className="capitalize">{a.difficulty}</Badge></div>
                <p className={cn('mt-1 text-xs', a.status !== 'completed' && new Date(a.deadline) < new Date() ? 'font-medium text-rose-600' : 'text-slate-500')}>Due {relativeDay(a.deadline)} · {formatDateTime(a.deadline)} · ~{a.estimatedHours}h</p>
              </div>
              <div className="flex items-center gap-3 sm:w-72">
                <input type="range" min={0} max={100} step={5} value={a.status === 'completed' ? 100 : a.progress} onChange={(e) => patchA.mutate({ id: a.id, progress: Number(e.target.value), status: Number(e.target.value) === 100 ? 'completed' : Number(e.target.value) > 0 ? 'in_progress' : 'not_started' })} className="flex-1 accent-brand-600" aria-label={`${a.title} progress`} />
                <span className="w-10 text-right text-xs tabular-nums">{a.status === 'completed' ? 100 : a.progress}%</span>
                <Select aria-label={`${a.title} status`} value={a.status} onChange={(e) => patchA.mutate({ id: a.id, status: e.target.value as Assignment['status'], ...(e.target.value === 'completed' ? { progress: 100 } : {}) })} className="h-8 w-32 py-0 text-xs">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
              </div>
              <div className="flex"><IconButton label={`Edit ${a.title}`} onClick={() => setForm({ kind: 'assignments', item: a })}><Pencil className="h-4 w-4" /></IconButton><IconButton label={`Delete ${a.title}`} onClick={() => setDel({ kind: 'assignments', id: a.id, name: a.title })}><Trash2 className="h-4 w-4" /></IconButton></div>
            </div>
          ))}
        </Card>
      ))}

      {tab === 'exams' && (!exams?.length ? <Card><EmptyState icon={<GraduationCap className="h-6 w-6" />} title="No exams scheduled" message={noCourses ? 'Add a course first.' : 'Add an exam to track preparation.'} /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...exams].sort((a, b) => +new Date(a.date) - +new Date(b.date)).map((e) => {
            const past = new Date(e.date) < new Date();
            return (
              <Card key={e.id} className={cn('p-5', past && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <div><CourseTag code={e.course.code} color={e.course.color} /><h2 className="mt-1.5 font-semibold">{e.name}</h2><p className="text-xs text-slate-500">{formatDateTime(e.date)}{e.location && <> · <MapPin className="inline h-3 w-3" /> {e.location}</>}</p></div>
                  <div className="text-right"><p className={cn('text-sm font-bold capitalize', !past && 'text-rose-600 dark:text-rose-400')}>{past ? 'Done' : relativeDay(e.date)}</p><div className="flex"><IconButton label={`Edit ${e.name}`} onClick={() => setForm({ kind: 'exams', item: e })}><Pencil className="h-4 w-4" /></IconButton><IconButton label={`Delete ${e.name}`} onClick={() => setDel({ kind: 'exams', id: e.id, name: e.name })}><Trash2 className="h-4 w-4" /></IconButton></div></div>
                </div>
                {e.topics && <p className="mt-2 whitespace-pre-line text-xs text-slate-600 dark:text-slate-400">{e.topics}</p>}
                <div className="mt-3 flex items-center gap-3"><span className="text-xs text-slate-500">Prepared</span><input type="range" min={0} max={100} step={5} value={e.preparation} onChange={(ev) => patchE.mutate({ id: e.id, preparation: Number(ev.target.value) })} className="flex-1 accent-brand-600" aria-label={`${e.name} preparation`} /><span className="w-10 text-right text-xs font-semibold tabular-nums">{e.preparation}%</span></div>
              </Card>
            );
          })}
        </div>
      ))}

      <AcademicForm state={form} courses={courses ?? []} onClose={() => setForm(null)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del)} loading={remove.isPending} title="Delete?" message={del?.kind === 'courses' ? `“${del.name}” and all its assignments, exams and classes will be deleted.` : `“${del?.name}” will be deleted.`} />
    </div>
  );
}

function AcademicForm({ state, courses, onClose }: { state: { kind: Tab; item?: Course | Assignment | Exam } | null; courses: Course[]; onClose: () => void }) {
  const [f, setF] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<ClassMeeting[]>([]);
  const kind = state?.kind;
  const item = state?.item as (Course & Assignment & Exam) | undefined;
  useEffect(() => {
    if (!state) return;
    const first = courses[0]?.id ?? '';
    if (kind === 'courses') { setF({ name: item?.name ?? '', code: item?.code ?? '', instructor: item?.instructor ?? '', credits: String(item?.credits ?? 3), color: item?.color ?? COLORS[courses.length % COLORS.length] }); setSchedule(item?.schedule ?? []); }
    if (kind === 'assignments') setF({ title: item?.title ?? '', courseId: item?.courseId ?? first, deadline: toLocalInput(item?.deadline ?? new Date(Date.now() + 7 * 864e5)), estimatedHours: String(item?.estimatedHours ?? 3), priority: item?.priority ?? 'medium', difficulty: item?.difficulty ?? 'medium', description: item?.description ?? '' });
    if (kind === 'exams') setF({ name: item?.name ?? '', courseId: item?.courseId ?? first, date: toLocalInput(item?.date ?? new Date(Date.now() + 14 * 864e5)), location: item?.location ?? '', topics: item?.topics ?? '', preparation: String(item?.preparation ?? 0) });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useApiMutation((b: Record<string, unknown>) => (item ? api.patch(`/${kind}/${item.id}`, b) : api.post(`/${kind}`, b)), { invalidate: [['assignments'], ['exams']], success: item ? 'Saved' : 'Created', onSuccess: onClose });
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (kind === 'courses') save.mutate({ name: f.name, code: f.code, instructor: f.instructor || null, credits: Number(f.credits), color: f.color, schedule });
    if (kind === 'assignments') save.mutate({ ...f, deadline: fromLocalInput(f.deadline), estimatedHours: Number(f.estimatedHours), description: f.description || null });
    if (kind === 'exams') save.mutate({ ...f, date: fromLocalInput(f.date), preparation: Number(f.preparation), location: f.location || null, topics: f.topics || null });
  };
  const courseSelect = <Field label="Course">{(id) => <Select id={id} value={f.courseId} onChange={set('courseId')}>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Select>}</Field>;
  const noun = { courses: 'course', assignments: 'assignment', exams: 'exam' }[kind ?? 'courses'];
  return (
    <Modal open={!!state} onClose={onClose} title={`${item ? 'Edit' : 'New'} ${noun}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="academic-form" loading={save.isPending}>{item ? 'Save' : 'Create'}</Button></>}>
      <form id="academic-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {kind === 'courses' && <>
          <Field label="Course name" className="sm:col-span-2">{(id) => <Input id={id} required value={f.name ?? ''} onChange={set('name')} />}</Field>
          <Field label="Code">{(id) => <Input id={id} required value={f.code ?? ''} onChange={set('code')} placeholder="CSE 3521" />}</Field>
          <Field label="Credits">{(id) => <Input id={id} type="number" min={0} max={10} step={0.5} value={f.credits ?? ''} onChange={set('credits')} />}</Field>
          <Field label="Instructor">{(id) => <Input id={id} value={f.instructor ?? ''} onChange={set('instructor')} />}</Field>
          <fieldset><legend className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">Color</legend><div className="flex flex-wrap gap-1.5">{COLORS.map((c) => <button key={c} type="button" onClick={() => setF({ ...f, color: c })} aria-label={`Color ${c}`} aria-pressed={f.color === c} className={cn('h-7 w-7 rounded-full ring-offset-2 dark:ring-offset-slate-900', f.color === c && 'ring-2 ring-slate-900 dark:ring-white')} style={{ background: c }} />)}</div></fieldset>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">Class schedule</p>
            <div className="space-y-2">
              {schedule.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Select aria-label="Day" value={m.day} onChange={(e) => setSchedule(schedule.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) } : x)))} className="w-24">{DAYS.map((d, k) => <option key={d} value={k}>{d}</option>)}</Select>
                  <Input aria-label="Start time" type="time" value={m.start} onChange={(e) => setSchedule(schedule.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="w-28" />
                  <Input aria-label="End time" type="time" value={m.end} onChange={(e) => setSchedule(schedule.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="w-28" />
                  <Input aria-label="Room" value={m.room ?? ''} onChange={(e) => setSchedule(schedule.map((x, j) => (j === i ? { ...x, room: e.target.value } : x)))} placeholder="Room" className="w-24 flex-1" />
                  <IconButton label="Remove class" onClick={() => setSchedule(schedule.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              ))}
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setSchedule([...schedule, { day: 1, start: '10:00', end: '11:30', room: '' }])}>Add class time</Button>
            </div>
          </div>
        </>}
        {kind === 'assignments' && <>
          <Field label="Title" className="sm:col-span-2">{(id) => <Input id={id} required value={f.title ?? ''} onChange={set('title')} />}</Field>
          {courseSelect}
          <Field label="Deadline">{(id) => <Input id={id} type="datetime-local" required value={f.deadline ?? ''} onChange={set('deadline')} />}</Field>
          <Field label="Estimated hours">{(id) => <Input id={id} type="number" min={0.25} max={200} step={0.25} value={f.estimatedHours ?? ''} onChange={set('estimatedHours')} />}</Field>
          <Field label="Priority">{(id) => <Select id={id} value={f.priority} onChange={set('priority')}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p}</option>)}</Select>}</Field>
          <Field label="Difficulty">{(id) => <Select id={id} value={f.difficulty} onChange={set('difficulty')}>{['easy', 'medium', 'hard'].map((p) => <option key={p} value={p}>{p}</option>)}</Select>}</Field>
          <Field label="Description" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.description ?? ''} onChange={set('description')} />}</Field>
        </>}
        {kind === 'exams' && <>
          <Field label="Exam name" className="sm:col-span-2">{(id) => <Input id={id} required value={f.name ?? ''} onChange={set('name')} placeholder="Midterm" />}</Field>
          {courseSelect}
          <Field label="Date & time">{(id) => <Input id={id} type="datetime-local" required value={f.date ?? ''} onChange={set('date')} />}</Field>
          <Field label="Location">{(id) => <Input id={id} value={f.location ?? ''} onChange={set('location')} />}</Field>
          <Field label="Preparation %">{(id) => <Input id={id} type="number" min={0} max={100} value={f.preparation ?? ''} onChange={set('preparation')} />}</Field>
          <Field label="Topics" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.topics ?? ''} onChange={set('topics')} />}</Field>
        </>}
      </form>
    </Modal>
  );
}
