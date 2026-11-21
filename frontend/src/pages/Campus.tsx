import { useState, type FormEvent } from 'react';
import { Bookmark, CalendarPlus, Check, MapPin, Plus, Star, Trash2, Users } from 'lucide-react';
import { useApiMutation, useApiQuery } from '../hooks/queries';
import { api } from '../lib/api';
import { cn, formatDateTime, fromLocalInput, relativeDay } from '../lib/format';
import type { OrgEvent, Organization } from '../lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, Field, IconButton, Input, Modal, PageHeader, PageLoader, Select, Tabs, Textarea } from '../components/ui';

const CATS = ['hackathon', 'competition', 'volunteering', 'workshop', 'seminar', 'social', 'career'];
type View = 'discover' | 'mine' | 'orgs';

export default function Campus() {
  const { data: events, isLoading, error, refetch } = useApiQuery<OrgEvent[]>(['org-events'], '/organizations/events');
  const { data: orgs } = useApiQuery<Organization[]>(['organizations'], '/organizations');
  const [view, setView] = useState<View>('discover');
  const [cat, setCat] = useState('');
  const [creating, setCreating] = useState(false);
  const inv = { invalidate: [['org-events'], ['organizations']] };
  const interest = useApiMutation((v: { id: string; status: OrgEvent['myStatus'] }) => (v.status ? api.put(`/organizations/events/${v.id}/interest`, { status: v.status }) : api.del(`/organizations/events/${v.id}/interest`)), { ...inv, success: (_r, v) => (v.status === 'registered' ? 'Registered — added to your radar' : v.status ? `Marked as ${v.status}` : 'Removed') });
  const toCal = useApiMutation((id: string) => api.post(`/organizations/events/${id}/calendar`), { ...inv, success: 'Added to your calendar' });
  const del = useApiMutation((id: string) => api.del(`/organizations/events/${id}`), { ...inv, success: 'Event deleted' });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  const list = (events ?? []).filter((e) => (view !== 'mine' || e.myStatus || e.canEdit) && (!cat || e.category === cat));

  return (
    <div>
      <PageHeader title="Campus Life" icon={<Users className="h-5 w-5" />} description="Clubs, hackathons, workshops and volunteering — saved, registered and on your calendar." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Post event</Button>} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs<View> value={view} onChange={setView} tabs={[{ value: 'discover', label: 'Discover', count: events?.length }, { value: 'mine', label: 'My events', count: events?.filter((e) => e.myStatus).length }, { value: 'orgs', label: 'Organizations', count: orgs?.length }]} />
        {view !== 'orgs' && <Select aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-44"><option value="">All categories</option>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</Select>}
      </div>
      {view === 'orgs' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orgs?.map((o) => <Card key={o.id} className="p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: o.color }}>{o.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span><div><h2 className="font-semibold">{o.name}</h2><p className="text-xs capitalize text-slate-500">{o.category} · {o._count.events} events</p></div></div>{o.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{o.description}</p>}</Card>)}
        </div>
      ) : !list.length ? (
        <Card><EmptyState icon={<Users className="h-6 w-6" />} title={view === 'mine' ? 'No saved events yet' : 'No upcoming events'} message={view === 'mine' ? 'Save, mark interest or register for events in Discover.' : 'Post an event for your club.'} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => {
            const regSoon = e.registrationDeadline && new Date(e.registrationDeadline) > new Date();
            return (
              <Card key={e.id} className="flex flex-col overflow-hidden">
                <div className="h-1.5" style={{ background: e.organization.color }} />
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium" style={{ color: e.organization.color }}>{e.organization.name}</p><Badge className="capitalize">{e.category}</Badge></div>
                  <h2 className="mt-1 font-semibold">{e.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(e.date)}{e.location && <> · <MapPin className="inline h-3 w-3" /> {e.location}</>}</p>
                  {e.description && <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{e.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {regSoon && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Register by {relativeDay(e.registrationDeadline!)}</Badge>}
                    <span className="text-slate-500">{e.interestedCount} interested</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 p-3 dark:border-slate-800">
                  {(['saved', 'interested', 'registered'] as const).map((s) => {
                    const on = e.myStatus === s; const Icon = s === 'saved' ? Bookmark : s === 'interested' ? Star : Check;
                    return <Button key={s} size="sm" variant={on ? 'primary' : 'secondary'} aria-pressed={on} onClick={() => interest.mutate({ id: e.id, status: on ? null : s })} icon={<Icon className="h-3.5 w-3.5" />} className="capitalize">{s === 'registered' ? (on ? 'Registered' : 'Register') : s === 'saved' ? (on ? 'Saved' : 'Save') : 'Interested'}</Button>;
                  })}
                  <IconButton label={e.onCalendar ? 'On your calendar' : `Add ${e.title} to calendar`} disabled={e.onCalendar} onClick={() => toCal.mutate(e.id)} className={cn('ml-auto', e.onCalendar && 'text-emerald-600')}>{e.onCalendar ? <Check className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}</IconButton>
                  {e.canEdit && <IconButton label={`Delete ${e.title}`} onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></IconButton>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <EventForm open={creating} orgs={orgs ?? []} onClose={() => setCreating(false)} />
    </div>
  );
}

function EventForm({ open, orgs, onClose }: { open: boolean; orgs: Organization[]; onClose: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ category: 'workshop' });
  const save = useApiMutation((b: Record<string, string | null>) => api.post(`/organizations/${b.organizationId}/events`, b), { invalidate: [['org-events'], ['organizations']], success: 'Event posted', onSuccess: () => { setF({ category: 'workshop' }); onClose(); } });
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate({ ...f, organizationId: f.organizationId || orgs[0]?.id, date: fromLocalInput(f.date ?? ''), registrationDeadline: fromLocalInput(f.registrationDeadline ?? ''), location: f.location || null, description: f.description || null }); };
  return (
    <Modal open={open} onClose={onClose} title="Post a campus event" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="org-event-form" loading={save.isPending}>Post event</Button></>}>
      <form id="org-event-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">{(id) => <Input id={id} required value={f.title ?? ''} onChange={set('title')} />}</Field>
        <Field label="Organization">{(id) => <Select id={id} value={f.organizationId ?? orgs[0]?.id ?? ''} onChange={set('organizationId')}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>}</Field>
        <Field label="Category">{(id) => <Select id={id} value={f.category} onChange={set('category')}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</Select>}</Field>
        <Field label="Date & time">{(id) => <Input id={id} type="datetime-local" required value={f.date ?? ''} onChange={set('date')} />}</Field>
        <Field label="Registration deadline">{(id) => <Input id={id} type="datetime-local" value={f.registrationDeadline ?? ''} onChange={set('registrationDeadline')} />}</Field>
        <Field label="Location" className="sm:col-span-2">{(id) => <Input id={id} value={f.location ?? ''} onChange={set('location')} />}</Field>
        <Field label="Description" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.description ?? ''} onChange={set('description')} />}</Field>
      </form>
    </Modal>
  );
}
