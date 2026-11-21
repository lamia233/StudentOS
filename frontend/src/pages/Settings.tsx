import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BookOpen, Briefcase, Clock, GraduationCap, Lock, Palette, Settings as SettingsIcon, User as UserIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { applyTheme, type Theme } from '../lib/theme';
import { toDateInput, fromLocalInput, cn } from '../lib/format';
import { useApiMutation } from '../hooks/queries';
import type { User } from '../lib/types';
import { Button, Card, CardHeader, Field, Input, PageHeader, Select } from '../components/ui';

export default function Settings() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState<Record<string, string | number | boolean>>({});
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  useEffect(() => {
    if (user) setF({ name: user.name, university: user.university ?? '', degree: user.degree ?? '', semester: user.semester ?? '', semesterStart: toDateInput(user.semesterStart), semesterEnd: toDateInput(user.semesterEnd), studyHoursPerWeek: user.studyHoursPerWeek, preferredStudyTime: user.preferredStudyTime, careerGoal: user.careerGoal ?? '', notifyDeadlines: user.notifyDeadlines, notifyExams: user.notifyExams, notifyGoals: user.notifyGoals });
  }, [user]);
  const save = useApiMutation((b: Record<string, unknown>) => api.patch<{ user: User }>('/users/me', b), { success: 'Settings saved', onSuccess: (r) => setUser(r.user) });
  const changePw = useApiMutation((b: typeof pw) => api.post('/users/me/password', b), { success: 'Password updated', onSuccess: () => setPw({ currentPassword: '', newPassword: '' }) });
  const setTheme = (theme: Theme) => { applyTheme(theme); save.mutate({ theme }); };
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ ...f, university: f.university || null, degree: f.degree || null, semester: f.semester || null, careerGoal: f.careerGoal || null, studyHoursPerWeek: Number(f.studyHoursPerWeek), semesterStart: fromLocalInput(f.semesterStart ? `${f.semesterStart}T00:00` : ''), semesterEnd: fromLocalInput(f.semesterEnd ? `${f.semesterEnd}T00:00` : '') });
  };
  if (!user) return null;
  const toggle = (k: 'notifyDeadlines' | 'notifyExams' | 'notifyGoals', label: string) => (
    <label className="flex items-center justify-between gap-4 py-2 text-sm"><span>{label}</span><input type="checkbox" role="switch" className="h-5 w-9 cursor-pointer accent-brand-600" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /></label>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" icon={<SettingsIcon className="h-5 w-5" />} description={user.email} />
      <form onSubmit={submit} className="space-y-6">
        <Card><CardHeader title="Profile" icon={<UserIcon className="h-4 w-4" />} /><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Name" className="sm:col-span-2">{(id) => <Input id={id} required value={String(f.name ?? '')} onChange={set('name')} />}</Field></div></Card>
        <Card><CardHeader title="University & semester" icon={<GraduationCap className="h-4 w-4" />} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="University">{(id) => <Input id={id} value={String(f.university ?? '')} onChange={set('university')} />}</Field>
            <Field label="Degree">{(id) => <Input id={id} value={String(f.degree ?? '')} onChange={set('degree')} />}</Field>
            <Field label="Semester">{(id) => <Input id={id} value={String(f.semester ?? '')} onChange={set('semester')} />}</Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Starts">{(id) => <Input id={id} type="date" value={String(f.semesterStart ?? '')} onChange={set('semesterStart')} />}</Field><Field label="Ends">{(id) => <Input id={id} type="date" value={String(f.semesterEnd ?? '')} onChange={set('semesterEnd')} />}</Field></div>
          </div>
        </Card>
        <Card><CardHeader title="Study preferences" icon={<Clock className="h-4 w-4" />} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Weekly study goal (hours)">{(id) => <Input id={id} type="number" min={1} max={80} value={Number(f.studyHoursPerWeek ?? 14)} onChange={set('studyHoursPerWeek')} />}</Field>
            <Field label="Preferred study time">{(id) => <Select id={id} value={String(f.preferredStudyTime ?? 'evening')} onChange={set('preferredStudyTime')}><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="night">Night</option></Select>}</Field>
          </div>
        </Card>
        <Card><CardHeader title="Career preferences" icon={<Briefcase className="h-4 w-4" />} /><div className="p-5"><Field label="Primary career goal">{(id) => <Input id={id} value={String(f.careerGoal ?? '')} onChange={set('careerGoal')} placeholder="Software Engineering Internship" />}</Field></div></Card>
        <Card><CardHeader title="Notifications" icon={<Bell className="h-4 w-4" />} /><div className="divide-y divide-slate-100 px-5 py-2 dark:divide-slate-800">{toggle('notifyDeadlines', 'Upcoming and overdue deadlines')}{toggle('notifyExams', 'Exam reminders')}{toggle('notifyGoals', 'Goal and milestone nudges')}</div></Card>
        <div className="flex justify-end"><Button type="submit" loading={save.isPending && !save.variables?.theme}>Save settings</Button></div>
      </form>
      <div className="mt-6 space-y-6">
        <Card><CardHeader title="Appearance" icon={<Palette className="h-4 w-4" />} />
          <div className="grid grid-cols-3 gap-2 p-5">{(['light', 'dark', 'system'] as Theme[]).map((t) => <button key={t} type="button" onClick={() => setTheme(t)} aria-pressed={user.theme === t} className={cn('rounded-xl border py-3 text-sm font-medium capitalize', user.theme === t ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700')}>{t}</button>)}</div>
        </Card>
        <Card><CardHeader title="Notion" icon={<BookOpen className="h-4 w-4" />} /><div className="flex items-center justify-between p-5 text-sm"><span className="text-slate-600 dark:text-slate-400">Manage live connection, demo mode and sync.</span><Link to="/app/notion" className="font-medium text-brand-600 hover:underline">Open Notion settings</Link></div></Card>
        <Card><CardHeader title="Password" icon={<Lock className="h-4 w-4" />} />
          <form onSubmit={(e) => { e.preventDefault(); changePw.mutate(pw); }} className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Current password">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />}</Field>
            <Field label="New password">{(id) => <Input id={id} type="password" autoComplete="new-password" minLength={8} required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />}</Field>
            <Button type="submit" variant="secondary" loading={changePw.isPending}>Update</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
