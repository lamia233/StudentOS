import { useState, type FormEvent } from 'react';
import { ExternalLink, Minus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useApiMutation, useApiQuery } from '../hooks/queries';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import type { Skill } from '../lib/types';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, Modal, PageHeader, PageLoader, Progress, Select, Tabs, Textarea } from '../components/ui';

const CATS = ['technical', 'soft', 'language', 'domain'] as const;

export default function Skills() {
  const { data, isLoading, error, refetch } = useApiQuery<Skill[]>(['skills'], '/skills');
  const [cat, setCat] = useState<'all' | Skill['category']>('all');
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Skill | null>(null);
  const [f, setF] = useState({ name: '', category: 'technical', currentLevel: 1, targetLevel: 7, resources: '' });
  const inv = { invalidate: [['skills']] };
  const level = useApiMutation((v: { id: string; currentLevel: number }) => api.patch(`/skills/${v.id}`, { currentLevel: v.currentLevel }), inv);
  const create = useApiMutation((b: Record<string, unknown>) => api.post('/skills', b), { ...inv, success: 'Skill added', onSuccess: () => { setOpen(false); setF({ name: '', category: 'technical', currentLevel: 1, targetLevel: 7, resources: '' }); } });
  const remove = useApiMutation((id: string) => api.del(`/skills/${id}`), { ...inv, success: 'Skill removed', onSuccess: () => setDel(null) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const resources = f.resources.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [title, url = ''] = l.split('|').map((x) => x.trim()); return { title, url }; });
    create.mutate({ ...f, currentLevel: Number(f.currentLevel), targetLevel: Number(f.targetLevel), resources });
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  const list = (data ?? []).filter((s) => cat === 'all' || s.category === cat);

  return (
    <div>
      <PageHeader title="Skills" icon={<Sparkles className="h-5 w-5" />} description="Track skill levels against your targets, with resources and linked practice tasks." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add skill</Button>} />
      <Tabs className="mb-5" value={cat} onChange={setCat} tabs={[{ value: 'all', label: 'All', count: data?.length }, ...CATS.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))]} />
      {!list.length ? (
        <Card><EmptyState icon={<Sparkles className="h-6 w-6" />} title="No skills here yet" action={<Button onClick={() => setOpen(true)}>Add a skill</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="font-semibold">{s.name}</h2><Badge className="mt-1 capitalize">{s.category}</Badge></div>
                <IconButton label={`Delete ${s.name}`} onClick={() => setDel(s)}><Trash2 className="h-4 w-4" /></IconButton>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <IconButton label={`Decrease ${s.name} level`} disabled={s.currentLevel <= 0} onClick={() => level.mutate({ id: s.id, currentLevel: s.currentLevel - 1 })} className="border border-slate-200 dark:border-slate-700"><Minus className="h-4 w-4" /></IconButton>
                <div className="flex-1">
                  <div className="flex gap-1" aria-hidden>
                    {Array.from({ length: 10 }, (_, i) => <span key={i} className={cn('h-2 flex-1 rounded-full', i < s.currentLevel ? 'bg-emerald-500' : i < s.targetLevel ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-100 dark:bg-slate-800/60')} />)}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">Level <strong className="text-slate-900 dark:text-white">{s.currentLevel}</strong> of target {s.targetLevel}</p>
                </div>
                <IconButton label={`Increase ${s.name} level`} disabled={s.currentLevel >= 10} onClick={() => level.mutate({ id: s.id, currentLevel: s.currentLevel + 1 })} className="border border-slate-200 dark:border-slate-700"><Plus className="h-4 w-4" /></IconButton>
              </div>
              <Progress value={s.progress} color="#10b981" className="mt-3 h-1.5" label={`${s.name} progress toward target`} />
              {s.resources.length > 0 && (
                <ul className="mt-4 space-y-1 text-sm">
                  {s.resources.map((r) => <li key={r.title}>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400">{r.title}<ExternalLink className="h-3 w-3" /></a> : <span>{r.title}</span>}</li>)}
                </ul>
              )}
              {s.tasks.length > 0 && <p className="mt-3 text-xs text-slate-500">{s.tasks.filter((t) => t.status !== 'done').length} open practice tasks</p>}
            </Card>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add skill" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="skill-form" loading={create.isPending}>Add skill</Button></>}>
        <form id="skill-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Skill" className="sm:col-span-2">{(id) => <Input id={id} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. System Design" />}</Field>
          <Field label="Category">{(id) => <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</Select>}</Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Current (0–10)">{(id) => <Input id={id} type="number" min={0} max={10} value={f.currentLevel} onChange={(e) => setF({ ...f, currentLevel: Number(e.target.value) })} />}</Field>
            <Field label="Target (1–10)">{(id) => <Input id={id} type="number" min={1} max={10} value={f.targetLevel} onChange={(e) => setF({ ...f, targetLevel: Number(e.target.value) })} />}</Field>
          </div>
          <Field label="Resources" hint="One per line: Title | URL" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.resources} onChange={(e) => setF({ ...f, resources: e.target.value })} placeholder="Grokking System Design | https://…" />}</Field>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} title="Remove skill?" message={`“${del?.name}” will be removed.`} />
    </div>
  );
}
