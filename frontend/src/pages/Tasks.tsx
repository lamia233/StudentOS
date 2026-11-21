import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, Columns3, List, Pencil, Plus, Repeat, Search, Trash2 } from 'lucide-react';
import { useApiMutation, useApiQuery, useCourses } from '../hooks/queries';
import { api } from '../lib/api';
import { cn, daysFromToday, formatMinutes, fromLocalInput, relativeDay, splitTags, toLocalInput } from '../lib/format';
import type { Task, TaskStatus } from '../lib/types';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, Modal, PageHeader, PageLoader, Select, Tabs, Textarea } from '../components/ui';
import { PriorityBadge } from '../components/shared';

type View = 'today' | 'upcoming' | 'all' | 'completed' | 'board';
const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
];

const empty = { title: '', description: '', priority: 'medium', status: 'todo', category: 'academic', dueDate: '', estimatedMinutes: 30, tags: '', recurrence: 'none', courseId: '' };

export function TaskForm({ open, onClose, task }: { open: boolean; onClose: () => void; task?: Task | null }) {
  const { data: courses } = useCourses();
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (open) setF(task ? { title: task.title, description: task.description ?? '', priority: task.priority, status: task.status, category: task.category, dueDate: toLocalInput(task.dueDate), estimatedMinutes: task.estimatedMinutes, tags: task.tags, recurrence: task.recurrence, courseId: task.courseId ?? '' } : empty);
  }, [open, task]);
  const save = useApiMutation(
    (body: Record<string, unknown>) => (task ? api.patch(`/tasks/${task.id}`, body) : api.post('/tasks', body)),
    { invalidate: [['tasks']], success: task ? 'Task updated' : 'Task created', onSuccess: onClose },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ ...f, description: f.description || null, dueDate: fromLocalInput(f.dueDate), courseId: f.courseId || null, estimatedMinutes: Number(f.estimatedMinutes) });
  };
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} onClose={onClose} title={task ? 'Edit task' : 'New task'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="task-form" loading={save.isPending}>{task ? 'Save changes' : 'Create task'}</Button></>}>
      <form id="task-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">{(id) => <Input id={id} required value={f.title} onChange={set('title')} placeholder="e.g. Read chapter 5" />}</Field>
        <Field label="Due">{(id) => <Input id={id} type="datetime-local" value={f.dueDate} onChange={set('dueDate')} />}</Field>
        <Field label="Estimated minutes">{(id) => <Input id={id} type="number" min={5} max={1440} value={f.estimatedMinutes} onChange={set('estimatedMinutes')} />}</Field>
        <Field label="Priority">{(id) => <Select id={id} value={f.priority} onChange={set('priority')}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</Select>}</Field>
        <Field label="Status">{(id) => <Select id={id} value={f.status} onChange={set('status')}>{COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}</Select>}</Field>
        <Field label="Category">{(id) => <Select id={id} value={f.category} onChange={set('category')}>{['academic', 'career', 'personal', 'organization'].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</Select>}</Field>
        <Field label="Course">{(id) => <Select id={id} value={f.courseId} onChange={set('courseId')}><option value="">None</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Select>}</Field>
        <Field label="Repeat">{(id) => <Select id={id} value={f.recurrence} onChange={set('recurrence')}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option></Select>}</Field>
        <Field label="Tags" hint="Comma separated">{(id) => <Input id={id} value={f.tags} onChange={set('tags')} placeholder="reading, exam" />}</Field>
        <Field label="Notes" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.description} onChange={set('description')} />}</Field>
      </form>
    </Modal>
  );
}

export default function Tasks() {
  const [params, setParams] = useSearchParams();
  const { data, isLoading, error, refetch } = useApiQuery<Task[]>(['tasks'], '/tasks');
  const { data: courses } = useCourses();
  const [view, setView] = useState<View>('today');
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [course, setCourse] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(params.get('new') === '1');
  const [deleting, setDeleting] = useState<Task | null>(null);
  const toggle = useApiMutation((id: string) => api.post<Task>(`/tasks/${id}/toggle`), { invalidate: [['tasks']], success: (t) => (t.status === 'done' ? 'Nice work — task completed 🎉' : null) });
  const move = useApiMutation((v: { id: string; status: TaskStatus }) => api.patch(`/tasks/${v.id}`, { status: v.status }), { invalidate: [['tasks']] });
  const del = useApiMutation((id: string) => api.del(`/tasks/${id}`), { invalidate: [['tasks']], success: 'Task deleted', onSuccess: () => setDeleting(null) });

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return (data ?? []).filter((t) => (!term || `${t.title} ${t.tags} ${t.description ?? ''}`.toLowerCase().includes(term)) && (!priority || t.priority === priority) && (!category || t.category === category) && (!course || t.courseId === course));
  }, [data, q, priority, category, course]);

  const lists = useMemo(() => {
    const open = filtered.filter((t) => t.status !== 'done');
    const sortDue = (a: Task, b: Task) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
    return {
      today: open.filter((t) => t.dueDate && daysFromToday(t.dueDate) <= 0).sort(sortDue),
      upcoming: open.filter((t) => !t.dueDate || daysFromToday(t.dueDate) > 0).sort(sortDue),
      all: [...open].sort(sortDue),
      completed: filtered.filter((t) => t.status === 'done').sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()),
    };
  }, [filtered]);

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  const openForm = (t: Task | null) => {
    setEditing(t);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    if (params.get('new')) setParams({});
  };

  const row = (t: Task) => (
    <li key={t.id} className="group flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <button type="button" onClick={() => toggle.mutate(t.id)} aria-label={t.status === 'done' ? `Mark ${t.title} as not done` : `Complete ${t.title}`} className="mt-0.5 shrink-0 text-slate-400 hover:text-brand-600">
        {t.status === 'done' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', t.status === 'done' && 'text-slate-400 line-through')}>{t.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {t.dueDate && <span className={cn(t.status !== 'done' && daysFromToday(t.dueDate) < 0 && 'font-medium text-rose-600')}>{relativeDay(t.dueDate)}</span>}
          <span>· {formatMinutes(t.estimatedMinutes)}</span>
          {t.status === 'in_progress' && <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">In progress</Badge>}
          {t.course && <Badge color={t.course.color}>{t.course.code}</Badge>}
          <Badge className="capitalize">{t.category}</Badge>
          {t.recurrence !== 'none' && <Badge><Repeat className="h-3 w-3" />{t.recurrence}</Badge>}
          {splitTags(t.tags).map((tag) => <Badge key={tag}>#{tag}</Badge>)}
        </div>
      </div>
      <PriorityBadge priority={t.priority} />
      <div className="flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <IconButton label={`Edit ${t.title}`} onClick={() => openForm(t)}><Pencil className="h-4 w-4" /></IconButton>
        <IconButton label={`Delete ${t.title}`} onClick={() => setDeleting(t)}><Trash2 className="h-4 w-4" /></IconButton>
      </div>
    </li>
  );

  return (
    <div>
      <PageHeader title="Tasks" description="Everything on your plate — academic, career, personal and clubs." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm(null)}>New task</Button>} />
      <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <Tabs<View>
          value={view}
          onChange={setView}
          tabs={[
            { value: 'today', label: 'Today', count: lists.today.length },
            { value: 'upcoming', label: 'Upcoming', count: lists.upcoming.length },
            { value: 'all', label: 'All open', icon: <List className="h-3.5 w-3.5" /> },
            { value: 'completed', label: 'Completed', count: lists.completed.length },
            { value: 'board', label: 'Board', icon: <Columns3 className="h-3.5 w-3.5" /> },
          ]}
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <div className="relative col-span-2 sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input aria-label="Search tasks" placeholder="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          <Select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">Any priority</option>{['critical', 'high', 'medium', 'low'].map((p) => <option key={p} value={p}>{p}</option>)}</Select>
          <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Any category</option>{['academic', 'career', 'personal', 'organization'].map((p) => <option key={p} value={p}>{p}</option>)}</Select>
          <Select aria-label="Filter by course" value={course} onChange={(e) => setCourse(e.target.value)} className="col-span-2 sm:col-span-1"><option value="">All courses</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</Select>
        </div>
      </div>

      {view === 'board' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = filtered.filter((t) => t.status === col.status);
            return (
              <Card key={col.status} className="flex flex-col bg-slate-50/60 dark:bg-slate-900/60" onDragOver={(e: DragEvent) => e.preventDefault()} onDrop={(e: React.DragEvent) => { const id = e.dataTransfer.getData('text/plain'); if (id) move.mutate({ id, status: col.status }); }}>
                <div className="flex items-center justify-between px-4 pt-4"><h2 className="text-sm font-semibold">{col.label}</h2><Badge>{items.length}</Badge></div>
                <ul className="flex-1 space-y-2 p-3" aria-label={col.label}>
                  {items.length === 0 && <li className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400 dark:border-slate-700">Drop tasks here</li>}
                  {items.map((t) => (
                    <li key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)} className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{t.title}</p><PriorityBadge priority={t.priority} /></div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">{t.dueDate && <span>{relativeDay(t.dueDate)}</span>}{t.course && <Badge color={t.course.color}>{t.course.code}</Badge>}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <Select aria-label={`Move ${t.title}`} value={t.status} onChange={(e) => move.mutate({ id: t.id, status: e.target.value as TaskStatus })} className="h-7 w-auto py-0 text-xs">{COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}</Select>
                        <IconButton label={`Edit ${t.title}`} onClick={() => openForm(t)}><Pencil className="h-3.5 w-3.5" /></IconButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-2">
          {lists[view].length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title={view === 'completed' ? 'No completed tasks yet' : view === 'today' ? 'Nothing due today' : 'No tasks here'} message={view === 'today' ? 'Enjoy the breathing room, or pull something forward from Upcoming.' : 'Create a task to get started.'} action={view !== 'completed' && <Button size="sm" onClick={() => openForm(null)} icon={<Plus className="h-4 w-4" />}>New task</Button>} />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">{lists[view].map(row)}</ul>
          )}
        </Card>
      )}

      <TaskForm open={formOpen} onClose={closeForm} task={editing} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && del.mutate(deleting.id)} loading={del.isPending} title="Delete task?" message={`“${deleting?.title}” will be permanently deleted.`} />
    </div>
  );
}
