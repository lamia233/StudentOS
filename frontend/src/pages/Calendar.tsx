import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, Trash2 } from 'lucide-react';
import { useApiMutation, useApiQuery, useCourses } from '../hooks/queries';
import { api } from '../lib/api';
import { cn, EVENT_COLORS, formatTime, fromLocalInput, toLocalInput } from '../lib/format';
import type { CalendarItem } from '../lib/types';
import { Button, Card, ErrorState, Field, IconButton, Input, Modal, PageHeader, Select, Skeleton, Tabs, Textarea } from '../components/ui';

type View = 'month' | 'week' | 'day';
const TYPES = ['class', 'study', 'exam', 'assignment', 'academic', 'career', 'personal'] as const;
const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const startOfWeek = (d: Date) => addDays(sod(d), -((d.getDay() + 6) % 7));
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);
const colorOf = (e: CalendarItem) => e.color ?? EVENT_COLORS[e.type] ?? '#6366f1';

export default function CalendarPage() {
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(sod(new Date()));
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [creating, setCreating] = useState<Date | null>(null);

  const range = useMemo(() => {
    if (view === 'day') return { from: cursor, to: addDays(cursor, 1), days: [cursor] };
    if (view === 'week') { const s = startOfWeek(cursor); return { from: s, to: addDays(s, 7), days: Array.from({ length: 7 }, (_, i) => addDays(s, i)) }; }
    const s = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    return { from: s, to: addDays(s, 42), days: Array.from({ length: 42 }, (_, i) => addDays(s, i)) };
  }, [view, cursor]);

  const { data, isLoading, error, refetch } = useApiQuery<CalendarItem[]>(['calendar', range.from.toISOString(), range.to.toISOString()], `/events/calendar?from=${range.from.toISOString()}&to=${range.to.toISOString()}`);
  const events = (data ?? []).filter((e) => !hidden.includes(e.type));
  const on = (d: Date) => events.filter((e) => sameDay(new Date(e.start), d)).sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const step = (n: number) => setCursor(view === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() + n, 1) : addDays(cursor, n * (view === 'week' ? 7 : 1)));
  const title = view === 'month' ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : view === 'week' ? `${range.days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${range.days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const pill = (e: CalendarItem) => (
    <button key={e.id} type="button" onClick={() => setSelected(e)} className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white" style={{ background: colorOf(e) }} title={e.title}>
      {!e.allDay && e.type !== 'assignment' && <span className="opacity-80">{formatTime(e.start)} </span>}{e.title}
    </button>
  );

  return (
    <div>
      <PageHeader title="Calendar" icon={<CalendarDays className="h-5 w-5" />} description="Classes, study blocks, exams, deadlines and campus events together." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(cursor)}>New event</Button>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <IconButton label="Previous" onClick={() => step(-1)}><ChevronLeft className="h-5 w-5" /></IconButton>
          <IconButton label="Next" onClick={() => step(1)}><ChevronRight className="h-5 w-5" /></IconButton>
          <Button size="sm" variant="secondary" onClick={() => setCursor(sod(new Date()))}>Today</Button>
          <h2 className="ml-2 text-lg font-semibold" aria-live="polite">{title}</h2>
        </div>
        <Tabs<View> value={view} onChange={setView} tabs={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }]} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Event types">
        {TYPES.map((t) => {
          const off = hidden.includes(t);
          return <button key={t} type="button" aria-pressed={!off} onClick={() => setHidden(off ? hidden.filter((x) => x !== t) : [...hidden, t])} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize', off ? 'border-slate-200 text-slate-400 dark:border-slate-700' : 'border-slate-300 dark:border-slate-600')}><span className="h-2 w-2 rounded-full" style={{ background: off ? '#cbd5e1' : EVENT_COLORS[t] }} />{t}</button>;
        })}
      </div>
      {error ? <ErrorState message={error.message} onRetry={() => refetch()} /> : isLoading ? <Skeleton className="h-[560px]" /> : view === 'month' ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100 text-center text-xs font-medium text-slate-500 dark:border-slate-800">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2">{d}</div>)}</div>
          <div className="grid grid-cols-7">
            {range.days.map((d) => {
              const list = on(d);
              const out = d.getMonth() !== cursor.getMonth();
              return (
                <div key={d.toISOString()} className={cn('min-h-[92px] border-b border-r border-slate-100 p-1 dark:border-slate-800 sm:min-h-[112px]', out && 'bg-slate-50/60 dark:bg-slate-900/40')}>
                  <button type="button" onClick={() => { setCursor(d); setView('day'); }} className={cn('mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs', sameDay(d, new Date()) ? 'bg-brand-600 font-bold text-white' : out ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300')} aria-label={d.toDateString()}>{d.getDate()}</button>
                  <div className="space-y-0.5">{list.slice(0, 3).map(pill)}{list.length > 3 && <button type="button" onClick={() => { setCursor(d); setView('day'); }} className="px-1 text-[11px] text-slate-500 hover:underline">+{list.length - 3} more</button>}</div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <div className={cn('grid min-w-[640px]', view === 'week' ? 'grid-cols-[3.5rem_repeat(7,1fr)]' : 'grid-cols-[3.5rem_1fr]')}>
            <div />
            {range.days.map((d) => (
              <div key={d.toISOString()} className="border-b border-l border-slate-100 p-2 text-center dark:border-slate-800">
                <p className="text-xs text-slate-500">{d.toLocaleDateString(undefined, { weekday: 'short' })}</p>
                <p className={cn('mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold', sameDay(d, new Date()) && 'bg-brand-600 text-white')}>{d.getDate()}</p>
                <div className="mt-1 space-y-0.5">{on(d).filter((e) => e.allDay || e.type === 'assignment').map(pill)}</div>
              </div>
            ))}
            {HOURS.map((h) => (
              <div key={h} className="contents">
                <div className="h-14 pr-2 pt-0.5 text-right text-[11px] text-slate-400">{new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })}</div>
                {range.days.map((d) => (
                  <div key={d.toISOString() + h} className="relative h-14 border-l border-t border-slate-100 dark:border-slate-800" onDoubleClick={() => setCreating(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))}>
                    {on(d).filter((e) => !e.allDay && e.type !== 'assignment' && new Date(e.start).getHours() === h).map((e) => {
                      const s = new Date(e.start); const mins = Math.max(20, (+new Date(e.end) - +s) / 60000);
                      return (
                        <button key={e.id} type="button" onClick={() => setSelected(e)} className="absolute inset-x-0.5 z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] text-white shadow-sm" style={{ top: `${(s.getMinutes() / 60) * 56}px`, height: `${(mins / 60) * 56 - 2}px`, background: colorOf(e) }}>
                          <p className="truncate font-semibold">{e.title}</p><p className="truncate opacity-80">{formatTime(e.start)}{e.location && ` · ${e.location}`}</p>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}
      <EventDetail item={selected} onClose={() => setSelected(null)} />
      <EventForm at={creating} onClose={() => setCreating(null)} />
    </div>
  );
}

function EventDetail({ item, onClose }: { item: CalendarItem | null; onClose: () => void }) {
  const del = useApiMutation((id: string) => api.del(`/events/${id}`), { invalidate: [['calendar']], success: 'Event deleted', onSuccess: onClose });
  return (
    <Modal open={!!item} onClose={onClose} title={item?.title ?? ''} footer={item?.editable ? <Button variant="danger" onClick={() => del.mutate(item.id)} loading={del.isPending} icon={<Trash2 className="h-4 w-4" />}>Delete</Button> : <Button variant="secondary" onClick={onClose}>Close</Button>}>
      {item && (
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(item) }} /><span className="capitalize">{item.type}</span>{item.source !== 'event' && <span className="text-slate-500">· from {item.source}</span>}</p>
          <p>{new Date(item.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}{!item.allDay && ` · ${formatTime(item.start)} – ${formatTime(item.end)}`}</p>
          {item.location && <p className="flex items-center gap-1 text-slate-600 dark:text-slate-400"><MapPin className="h-4 w-4" />{item.location}</p>}
          {item.preparation !== undefined && <p>Preparation: <strong>{item.preparation}%</strong></p>}
          {item.description && <p className="whitespace-pre-line text-slate-600 dark:text-slate-400">{item.description}</p>}
        </div>
      )}
    </Modal>
  );
}

function EventForm({ at, onClose }: { at: Date | null; onClose: () => void }) {
  const { data: courses } = useCourses();
  const [f, setF] = useState<Record<string, string>>({});
  const key = at?.toISOString();
  const [lastKey, setLastKey] = useState<string | undefined>();
  if (key !== lastKey) {
    setLastKey(key);
    if (at) { const s = new Date(at); if (s.getHours() === 0) s.setHours(9); setF({ title: '', type: 'personal', start: toLocalInput(s), end: toLocalInput(new Date(+s + 3600000)), location: '', description: '', courseId: '' }); }
  }
  const save = useApiMutation((b: Record<string, unknown>) => api.post('/events', b), { invalidate: [['calendar']], success: 'Event added', onSuccess: onClose });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate({ ...f, start: fromLocalInput(f.start), end: fromLocalInput(f.end), courseId: f.courseId || null, location: f.location || null, description: f.description || null }); };
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={!!at} onClose={onClose} title="New event" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="event-form" loading={save.isPending}>Add event</Button></>}>
      <form id="event-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">{(id) => <Input id={id} required value={f.title ?? ''} onChange={set('title')} />}</Field>
        <Field label="Starts">{(id) => <Input id={id} type="datetime-local" required value={f.start ?? ''} onChange={set('start')} />}</Field>
        <Field label="Ends">{(id) => <Input id={id} type="datetime-local" required value={f.end ?? ''} onChange={set('end')} />}</Field>
        <Field label="Type">{(id) => <Select id={id} value={f.type} onChange={set('type')}>{['personal', 'study', 'academic', 'exam', 'assignment', 'career'].map((t) => <option key={t} value={t}>{t}</option>)}</Select>}</Field>
        <Field label="Course">{(id) => <Select id={id} value={f.courseId} onChange={set('courseId')}><option value="">None</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</Select>}</Field>
        <Field label="Location" className="sm:col-span-2">{(id) => <Input id={id} value={f.location ?? ''} onChange={set('location')} />}</Field>
        <Field label="Description" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.description ?? ''} onChange={set('description')} />}</Field>
      </form>
    </Modal>
  );
}
