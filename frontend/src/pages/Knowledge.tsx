import { useEffect, useState, type FormEvent } from 'react';
import { BookMarked, ExternalLink, FileText, FlaskConical, FolderKanban, GraduationCap, Library, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useApiMutation, useApiQuery, useCourses } from '../hooks/queries';
import { api } from '../lib/api';
import { formatDate, relativeDay, splitTags } from '../lib/format';
import type { Assignment, Exam, Note, Task } from '../lib/types';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, Modal, PageHeader, PageLoader, Select, Tabs, Textarea } from '../components/ui';
import { CourseTag } from '../components/shared';

type NType = Note['type'];
const TYPES: { value: NType; label: string; icon: typeof FileText }[] = [
  { value: 'note', label: 'Notes', icon: FileText },
  { value: 'lecture', label: 'Lecture summaries', icon: GraduationCap },
  { value: 'resource', label: 'Resources', icon: BookMarked },
  { value: 'link', label: 'Links', icon: Link2 },
  { value: 'project', label: 'Project notes', icon: FolderKanban },
  { value: 'research', label: 'Research', icon: FlaskConical },
];
interface SearchResult { notes: Note[]; tasks: Task[]; assignments: Assignment[]; exams: Exam[] }

export default function Knowledge() {
  const { data, isLoading, error, refetch } = useApiQuery<Note[]>(['notes'], '/notes');
  const { data: courses } = useCourses();
  const [type, setType] = useState<'all' | NType>('all');
  const [course, setCourse] = useState('');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [editing, setEditing] = useState<Note | null | undefined>(undefined);
  const [viewing, setViewing] = useState<Note | null>(null);
  const [del, setDel] = useState<Note | null>(null);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const search = useApiQuery<SearchResult>(['notes', 'search', debounced], `/notes/search?q=${encodeURIComponent(debounced)}`, debounced.length > 1);
  const remove = useApiMutation((id: string) => api.del(`/notes/${id}`), { invalidate: [['notes']], success: 'Note deleted', onSuccess: () => { setDel(null); setViewing(null); } });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  const searching = debounced.length > 1;
  const notes = (searching ? search.data?.notes ?? [] : data ?? []).filter((n) => (type === 'all' || n.type === type) && (!course || n.courseId === course));
  const others = searching && search.data ? [...search.data.tasks.map((t) => ({ id: t.id, kind: 'Task', title: t.title, sub: t.dueDate ? relativeDay(t.dueDate) : '' })), ...search.data.assignments.map((a) => ({ id: a.id, kind: 'Assignment', title: a.title, sub: relativeDay(a.deadline) })), ...search.data.exams.map((e) => ({ id: e.id, kind: 'Exam', title: e.name, sub: relativeDay(e.date) }))] : [];

  return (
    <div>
      <PageHeader title="Knowledge Hub" icon={<Library className="h-5 w-5" />} description="Lecture notes, resources, links and research — searchable alongside your work." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>New note</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input id="knowledge-search" aria-label="Search knowledge" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, tasks, assignments and exams…" className="pl-9" autoFocus /></div>
        <Select aria-label="Filter by course" value={course} onChange={(e) => setCourse(e.target.value)} className="sm:w-48"><option value="">All courses</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</Select>
      </div>
      <Tabs className="mb-5" value={type} onChange={setType} tabs={[{ value: 'all', label: 'All', count: data?.length }, ...TYPES.map((t) => ({ value: t.value, label: t.label }))]} />
      {others.length > 0 && (
        <Card className="mb-5 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Also matching in your work</p>
          <ul className="grid gap-2 sm:grid-cols-2">{others.map((o) => <li key={o.kind + o.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"><span className="truncate"><Badge className="mr-2">{o.kind}</Badge>{o.title}</span><span className="shrink-0 text-xs text-slate-500">{o.sub}</span></li>)}</ul>
        </Card>
      )}
      {!notes.length ? (
        <Card><EmptyState icon={<Library className="h-6 w-6" />} title={searching ? `No notes match “${debounced}”` : 'Nothing here yet'} message={searching ? 'Try a different keyword.' : 'Capture lecture summaries, useful links and project notes.'} action={!searching && <Button onClick={() => setEditing(null)}>New note</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {notes.map((n) => {
            const T = TYPES.find((t) => t.value === n.type) ?? TYPES[0];
            return (
              <Card key={n.id} className="group flex flex-col p-5 transition-shadow hover:shadow-md">
                <button type="button" onClick={() => setViewing(n)} className="flex-1 text-left">
                  <div className="flex items-center gap-2 text-xs text-slate-500"><T.icon className="h-4 w-4" />{T.label.replace(/s$/, '')}{n.course && <CourseTag code={n.course.code} color={n.course.color} />}{n.source === 'notion' && <Badge>Notion</Badge>}</div>
                  <h2 className="mt-2 font-semibold">{n.title}</h2>
                  <p className="mt-1 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{n.content || n.url}</p>
                </button>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">{n.topic && <Badge>{n.topic}</Badge>}{splitTags(n.tags).slice(0, 3).map((t) => <Badge key={t}>#{t}</Badge>)}</div>
                  <div className="flex shrink-0 items-center">{n.url && <a href={n.url} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-slate-400 hover:text-brand-600" aria-label={`Open link for ${n.title}`}><ExternalLink className="h-4 w-4" /></a>}<IconButton label={`Edit ${n.title}`} onClick={() => setEditing(n)}><Pencil className="h-4 w-4" /></IconButton></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? ''} size="lg" footer={<><Button variant="ghost" className="text-rose-600" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDel(viewing)}>Delete</Button><Button variant="secondary" onClick={() => { setEditing(viewing); setViewing(null); }}>Edit</Button></>}>
        {viewing && <div className="space-y-3 text-sm"><p className="text-xs text-slate-500">Updated {formatDate(viewing.updatedAt)}{viewing.semester && ` · ${viewing.semester}`}</p>{viewing.url && <a href={viewing.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-brand-600 hover:underline">{viewing.url}<ExternalLink className="h-3 w-3" /></a>}<div className="whitespace-pre-wrap leading-relaxed">{viewing.content}</div></div>}
      </Modal>
      <NoteForm note={editing} onClose={() => setEditing(undefined)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} title="Delete note?" message={`“${del?.title}” will be deleted.`} />
    </div>
  );
}

function NoteForm({ note, onClose }: { note: Note | null | undefined; onClose: () => void }) {
  const { data: courses } = useCourses();
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => { if (note !== undefined) setF({ title: note?.title ?? '', content: note?.content ?? '', type: note?.type ?? 'note', url: note?.url ?? '', topic: note?.topic ?? '', tags: note?.tags ?? '', courseId: note?.courseId ?? '' }); }, [note]);
  const save = useApiMutation((b: Record<string, unknown>) => (note ? api.patch(`/notes/${note.id}`, b) : api.post('/notes', b)), { invalidate: [['notes']], success: note ? 'Note saved' : 'Note created', onSuccess: onClose });
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate({ ...f, url: f.url || null, topic: f.topic || null, courseId: f.courseId || null }); };
  return (
    <Modal open={note !== undefined} onClose={onClose} title={note ? 'Edit note' : 'New note'} size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="note-form" loading={save.isPending}>Save</Button></>}>
      <form id="note-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <Field label="Title" className="sm:col-span-3">{(id) => <Input id={id} required value={f.title ?? ''} onChange={set('title')} />}</Field>
        <Field label="Type">{(id) => <Select id={id} value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label.replace(/s$/, '')}</option>)}</Select>}</Field>
        <Field label="Course">{(id) => <Select id={id} value={f.courseId} onChange={set('courseId')}><option value="">None</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</Select>}</Field>
        <Field label="Topic">{(id) => <Input id={id} value={f.topic ?? ''} onChange={set('topic')} />}</Field>
        <Field label="URL" className="sm:col-span-2">{(id) => <Input id={id} type="url" value={f.url ?? ''} onChange={set('url')} placeholder="https://" />}</Field>
        <Field label="Tags" hint="Comma separated">{(id) => <Input id={id} value={f.tags ?? ''} onChange={set('tags')} />}</Field>
        <Field label="Content" className="sm:col-span-3">{(id) => <Textarea id={id} rows={10} value={f.content ?? ''} onChange={set('content')} />}</Field>
      </form>
    </Modal>
  );
}
