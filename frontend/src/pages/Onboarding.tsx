import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/format';
import type { StudyTime, User } from '../lib/types';
import { Logo } from '../components/Logo';
import { Button, Field, IconButton, Input, Select } from '../components/ui';

const STEPS = ['About you', 'Your courses', 'Study habits', 'Career'];
const TIMES: { value: StudyTime; label: string; hint: string }[] = [
  { value: 'morning', label: 'Morning', hint: 'from 8:00' },
  { value: 'afternoon', label: 'Afternoon', hint: 'from 14:00' },
  { value: 'evening', label: 'Evening', hint: 'from 18:00' },
  { value: 'night', label: 'Night', hint: 'from 20:30' },
];

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: user?.name ?? '',
    university: '',
    degree: '',
    semester: '',
    studyHoursPerWeek: 14,
    preferredStudyTime: 'evening' as StudyTime,
    careerGoal: '',
  });
  const [courses, setCourses] = useState([{ name: '', code: '', credits: 3 }]);
  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const valid = [form.name && form.university && form.degree && form.semester, true, form.studyHoursPerWeek > 0, true][step];

  const finish = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ user: User }>('/users/me/onboarding', { ...form, courses: courses.filter((c) => c.name.trim() && c.code.trim()) });
      setUser(r.user);
      toast.success('Your StudentOS is ready');
      navigate('/app');
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950 sm:items-center">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <ol className="mb-6 flex items-center gap-2" aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col gap-1.5">
              <span className={cn('h-1.5 rounded-full', i <= step ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-800')} />
              <span className={cn('text-[11px] font-medium', i === step ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400')} aria-current={i === step ? 'step' : undefined}>{s}</span>
            </li>
          ))}
        </ol>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold">Welcome to StudentOS</h1>
                <p className="text-sm text-slate-500">Tell us a bit about your studies so we can personalise your workspace.</p>
              </div>
              <Field label="Your name">{(id) => <Input id={id} value={form.name} onChange={(e) => set('name', e.target.value)} />}</Field>
              <Field label="University">{(id) => <Input id={id} value={form.university} onChange={(e) => set('university', e.target.value)} placeholder="e.g. United International University" />}</Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Degree">{(id) => <Input id={id} value={form.degree} onChange={(e) => set('degree', e.target.value)} placeholder="BSc in CSE" />}</Field>
                <Field label="Current semester">{(id) => <Input id={id} value={form.semester} onChange={(e) => set('semester', e.target.value)} placeholder="e.g. Spring 2026" />}</Field>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold">Add your courses</h1>
                <p className="text-sm text-slate-500">You can add schedules, assignments and exams later.</p>
              </div>
              {courses.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2 sm:grid-cols-[1fr_8rem_5rem_auto]">
                  <Field label={`Course ${i + 1}`}>{(id) => <Input id={id} value={c.name} onChange={(e) => setCourses(courses.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Database Systems" />}</Field>
                  <Field label="Code">{(id) => <Input id={id} value={c.code} onChange={(e) => setCourses(courses.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} placeholder="CSE 3521" />}</Field>
                  <Field label="Credits" className="hidden sm:block">{(id) => <Input id={id} type="number" min={0} max={10} value={c.credits} onChange={(e) => setCourses(courses.map((x, j) => (j === i ? { ...x, credits: Number(e.target.value) } : x)))} />}</Field>
                  <IconButton label={`Remove course ${i + 1}`} onClick={() => setCourses(courses.filter((_, j) => j !== i))} className="mb-0.5 h-9 w-9" disabled={courses.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              ))}
              {courses.length < 12 && (
                <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCourses([...courses, { name: '', code: '', credits: 3 }])}>
                  Add another course
                </Button>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold">How do you like to study?</h1>
                <p className="text-sm text-slate-500">The planner uses this to size your daily focus list and schedule study blocks.</p>
              </div>
              <Field label={`Weekly study goal: ${form.studyHoursPerWeek} hours`}>
                {(id) => <input id={id} type="range" min={2} max={50} value={form.studyHoursPerWeek} onChange={(e) => set('studyHoursPerWeek', Number(e.target.value))} className="w-full accent-brand-600" />}
              </Field>
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-300">Preferred study time</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TIMES.map((t) => (
                    <label key={t.value} className={cn('cursor-pointer rounded-xl border p-3 text-center text-sm transition-colors', form.preferredStudyTime === t.value ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700')}>
                      <input type="radio" name="time" value={t.value} checked={form.preferredStudyTime === t.value} onChange={() => set('preferredStudyTime', t.value)} className="sr-only" />
                      <span className="block font-medium">{t.label}</span>
                      <span className="block text-xs text-slate-500">{t.hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold">What are you working towards?</h1>
                <p className="text-sm text-slate-500">We'll create a career goal with starter milestones. You can skip this.</p>
              </div>
              <Field label="Career goal">
                {(id) => (
                  <Select id={id} value={form.careerGoal} onChange={(e) => set('careerGoal', e.target.value)}>
                    <option value="">Skip for now</option>
                    <option>Software Engineering Internship</option>
                    <option>Data Science Internship</option>
                    <option>Graduate Studies Abroad</option>
                    <option>Research Publication</option>
                    <option>Full-time Job after Graduation</option>
                  </Select>
                )}
              </Field>
            </div>
          )}
          <div className="mt-8 flex justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0} icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!valid}>Continue <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={finish} loading={busy}>Finish setup</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
