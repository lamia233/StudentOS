import { useState, type FormEvent } from 'react';
import { Briefcase, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { useApiMutation, useApiQuery } from '../hooks/queries';
import { api } from '../lib/api';
import { cn, formatDate, fromLocalInput, relativeDay } from '../lib/format';
import type { Goal } from '../lib/types';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, Modal, PageHeader, PageLoader, ProgressRing, Select, Textarea } from '../components/ui';

const CATS = ['internship', 'job', 'research', 'learning', 'higher-study', 'portfolio', 'career'];

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: () => void }) {
  const [title, setTitle] = useState('');
  const inv = { invalidate: [['goals']] };
  const toggle = useApiMutation((m: { id: string; done: boolean }) => api.patch(`/goals/${goal.id}/milestones/${m.id}`, { done: m.done }), { ...inv, success: (_r, v) => (v.done ? 'Milestone completed 🎯' : null) });
  const add = useApiMutation((t: string) => api.post(`/goals/${goal.id}/milestones`, { title: t }), { ...inv, onSuccess: () => setTitle('') });
  const remove = useApiMutation((id: string) => api.del(`/goals/${goal.id}/milestones/${id}`), inv);
  const done = goal.milestones.filter((m) => m.done).length;
  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-4 p-5">
        <ProgressRing value={goal.progress} size={72} stroke={7} color="#8b5cf6" label={`${goal.title} ${goal.progress}% complete`}><span className="text-sm font-bold">{goal.progress}%</span></ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold">{goal.title}</h2>
            <IconButton label={`Delete ${goal.title}`} onClick={onDelete}><Trash2 className="h-4 w-4" /></IconButton>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
            <Badge className="capitalize">{goal.category.replace('-', ' ')}</Badge>
            {goal.target && <span>{goal.target}</span>}
            {goal.deadline && <span>· by {formatDate(goal.deadline)}</span>}
          </div>
          {goal.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{goal.description}</p>}
        </div>
      </div>
      <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Milestones · {done}/{goal.milestones.length}</p>
        <ul className="space-y-1">
          {goal.milestones.map((m) => (
            <li key={m.id} className="group flex items-center gap-2">
              <button type="button" onClick={() => toggle.mutate({ id: m.id, done: !m.done })} className="flex flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50" aria-pressed={m.done}>
                {m.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-slate-400" />}
                <span className={cn(m.done && 'text-slate-400 line-through')}>{m.title}</span>
              </button>
              <IconButton label={`Remove milestone ${m.title}`} onClick={() => remove.mutate(m.id)} className="opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-3.5 w-3.5" /></IconButton>
            </li>
          ))}
        </ul>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) add.mutate(title.trim()); }}>
          <Input aria-label={`New milestone for ${goal.title}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a milestone" className="h-8 text-sm" />
          <Button type="submit" size="sm" variant="secondary" loading={add.isPending} aria-label="Add milestone"><Plus className="h-4 w-4" /></Button>
        </form>
      </div>
      {goal.tasks.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Linked tasks</p>
          <ul className="space-y-1 text-sm">
            {goal.tasks.map((t) => <li key={t.id} className="flex items-center justify-between gap-2"><span className={cn('truncate', t.status === 'done' && 'text-slate-400 line-through')}>{t.title}</span>{t.dueDate && <span className="shrink-0 text-xs text-slate-500">{relativeDay(t.dueDate)}</span>}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function Career() {
  const { data, isLoading, error, refetch } = useApiQuery<Goal[]>(['goals'], '/goals');
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Goal | null>(null);
  const [f, setF] = useState({ title: '', category: 'internship', target: '', deadline: '', description: '', milestones: '' });
  const create = useApiMutation((b: Record<string, unknown>) => api.post('/goals', b), { invalidate: [['goals']], success: 'Goal created', onSuccess: () => { setOpen(false); setF({ title: '', category: 'internship', target: '', deadline: '', description: '', milestones: '' }); } });
  const remove = useApiMutation((id: string) => api.del(`/goals/${id}`), { invalidate: [['goals']], success: 'Goal deleted', onSuccess: () => setDel(null) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ title: f.title, category: f.category, target: f.target || null, description: f.description || null, deadline: fromLocalInput(f.deadline ? `${f.deadline}T23:59` : ''), milestones: f.milestones.split('\n').map((m) => m.trim()).filter(Boolean).map((title) => ({ title })) });
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  const avg = data?.length ? Math.round(data.reduce((s, g) => s + g.progress, 0) / data.length) : 0;

  return (
    <div>
      <PageHeader title="Career" icon={<Briefcase className="h-5 w-5" />} description={data?.length ? `${data.length} goals · ${avg}% average progress` : 'Turn ambitions into milestones you can track.'} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New goal</Button>} />
      {!data?.length ? (
        <Card><EmptyState icon={<Briefcase className="h-6 w-6" />} title="No career goals yet" message="Add an internship, research or learning goal and break it into milestones." action={<Button onClick={() => setOpen(true)}>Create your first goal</Button>} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">{data.map((g) => <GoalCard key={g.id} goal={g} onDelete={() => setDel(g)} />)}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New career goal" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="goal-form" loading={create.isPending}>Create goal</Button></>}>
        <form id="goal-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Goal" className="sm:col-span-2">{(id) => <Input id={id} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Land a software engineering internship" />}</Field>
          <Field label="Category">{(id) => <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}</Select>}</Field>
          <Field label="Target date">{(id) => <Input id={id} type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />}</Field>
          <Field label="Target / outcome" className="sm:col-span-2">{(id) => <Input id={id} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="Summer 2027 internship offer" />}</Field>
          <Field label="Description" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
          <Field label="Milestones" hint="One per line" className="sm:col-span-2">{(id) => <Textarea id={id} rows={4} value={f.milestones} onChange={(e) => setF({ ...f, milestones: e.target.value })} placeholder={'Update CV\nBuild portfolio project\nApply to 10 companies'} />}</Field>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} title="Delete goal?" message={`“${del?.title}” and its milestones will be deleted.`} />
    </div>
  );
}
