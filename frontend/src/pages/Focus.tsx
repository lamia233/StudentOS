import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Pause, Play, RotateCcw, Square, Timer } from 'lucide-react';
import { useApiMutation, useApiQuery, useCourses } from '../hooks/queries';
import { api } from '../lib/api';
import { cn, formatMinutes, formatDateTime } from '../lib/format';
import type { StudySession } from '../lib/types';
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, ProgressRing, Select, Tabs } from '../components/ui';

type Mode = 'pomodoro' | 'focus';
const PRESETS = [25, 45, 60, 90];

export default function Focus() {
  const [params] = useSearchParams();
  const { data: courses } = useCourses();
  const { data: sessions } = useApiQuery<StudySession[]>(['study-sessions'], '/study-sessions');
  const [mode, setMode] = useState<Mode>(params.get('minutes') ? 'focus' : 'pomodoro');
  const [title, setTitle] = useState(params.get('title') ?? '');
  const [courseId, setCourseId] = useState('');
  const [minutes, setMinutes] = useState(Number(params.get('minutes')) || 25);
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [pomos, setPomos] = useState(0);
  const [done, setDone] = useState<{ minutes: number; title: string } | null>(null);
  const startedAt = useRef<Date | null>(null);
  const link = { kind: params.get('kind'), id: params.get('id') };

  const log = useApiMutation((body: Record<string, unknown>) => api.post('/study-sessions', body), { invalidate: [['study-sessions'], ['assignments'], ['exams'], ['tasks']] });

  const total = (onBreak ? (pomos % 4 === 0 ? 15 : 5) : minutes) * 60;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    document.title = running ? `${fmt(remaining)} · Focus — StudentOS` : 'StudentOS';
    return () => {
      document.title = 'StudentOS';
    };
  }, [remaining, running]);

  const complete = (elapsedMin: number) => {
    setRunning(false);
    if (elapsedMin >= 1) {
      const name = title.trim() || 'Focus session';
      log.mutate({
        title: name,
        durationMinutes: Math.round(elapsedMin),
        type: mode,
        start: startedAt.current?.toISOString(),
        courseId: courseId || null,
        ...(link.kind === 'assignment' && link.id ? { assignmentId: link.id } : {}),
        ...(link.kind === 'exam' && link.id ? { examId: link.id } : {}),
        ...(link.kind === 'task' && link.id ? { taskId: link.id } : {}),
      });
      setDone({ minutes: Math.round(elapsedMin), title: name });
    }
    startedAt.current = null;
  };

  useEffect(() => {
    if (remaining > 0 || !running) return;
    if (onBreak) {
      setOnBreak(false);
      setRemaining(minutes * 60);
      setRunning(false);
      return;
    }
    complete(minutes);
    if (mode === 'pomodoro') {
      const n = pomos + 1;
      setPomos(n);
      setOnBreak(true);
      setRemaining((n % 4 === 0 ? 15 : 5) * 60);
    } else setRemaining(minutes * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, running]);

  const start = () => {
    if (!startedAt.current && !onBreak) startedAt.current = new Date();
    setDone(null);
    setRunning(true);
  };
  const stopEarly = () => {
    const elapsed = (minutes * 60 - remaining) / 60;
    complete(elapsed);
    setRemaining(minutes * 60);
  };
  const reset = () => {
    setRunning(false);
    setOnBreak(false);
    setRemaining(minutes * 60);
    startedAt.current = null;
  };
  const pickMinutes = (m: number) => {
    setMinutes(m);
    if (!running) setRemaining(m * 60);
  };

  const today = (sessions ?? []).filter((s) => new Date(s.start).toDateString() === new Date().toDateString());
  const todayMin = today.reduce((s, x) => s + x.durationMinutes, 0);
  const pct = ((total - remaining) / total) * 100;
  const inSession = running || (startedAt.current !== null && !onBreak);

  return (
    <div>
      <PageHeader title="Focus Mode" icon={<Timer className="h-5 w-5" />} description="Distraction-free sessions that count toward your study goal and course progress." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-col items-center">
            <Tabs<Mode> value={mode} onChange={(m) => { setMode(m); pickMinutes(m === 'pomodoro' ? 25 : 45); reset(); }} tabs={[{ value: 'pomodoro', label: 'Pomodoro' }, { value: 'focus', label: 'Custom focus' }]} />
            <div className="my-8">
              <ProgressRing value={pct} size={260} stroke={14} color={onBreak ? '#10b981' : '#6366f1'} label={`${fmt(remaining)} remaining`}>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{onBreak ? 'Break' : running ? 'Focusing' : inSession ? 'Paused' : 'Ready'}</span>
                <span className="mt-1 font-mono text-5xl font-bold tabular-nums" aria-live="off">{fmt(remaining)}</span>
                {mode === 'pomodoro' && <span className="mt-2 text-xs text-slate-500">Pomodoro {pomos % 4 + (onBreak ? 0 : 1)} of 4</span>}
              </ProgressRing>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {!running ? (
                <Button size="lg" onClick={start} icon={<Play className="h-4 w-4" />}>{inSession ? 'Resume' : onBreak ? 'Start break' : 'Start session'}</Button>
              ) : (
                <Button size="lg" variant="secondary" onClick={() => setRunning(false)} icon={<Pause className="h-4 w-4" />}>Pause</Button>
              )}
              {inSession && <Button size="lg" variant="secondary" onClick={stopEarly} icon={<Square className="h-4 w-4" />}>Finish & log</Button>}
              <Button size="lg" variant="ghost" onClick={reset} icon={<RotateCcw className="h-4 w-4" />}>Reset</Button>
            </div>
            {done && (
              <div role="status" className="mt-6 flex w-full max-w-md items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Great work! <strong>{formatMinutes(done.minutes)}</strong> of “{done.title}” logged. {mode === 'pomodoro' && 'Take a short break.'}</span>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Session setup</h2>
            <div className="space-y-4">
              <Field label="What are you working on?">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Revise TCP congestion control" disabled={inSession} />}</Field>
              <Field label="Course">{(id) => <Select id={id} value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={inSession}><option value="">No course</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Select>}</Field>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">Duration</p>
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map((m) => (
                    <button key={m} type="button" disabled={inSession} onClick={() => pickMinutes(m)} className={cn('rounded-lg border py-2 text-sm font-medium disabled:opacity-50', minutes === m ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700')} aria-pressed={minutes === m}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Today's sessions" subtitle={`${formatMinutes(todayMin)} focused today`} icon={<Timer className="h-4 w-4" />} />
            <ul className="space-y-1 p-3">
              {(sessions ?? []).slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <span className="h-8 w-1 rounded-full" style={{ background: s.course?.color ?? '#94a3b8' }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(s.start)} · <span className="capitalize">{s.type}</span></p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{formatMinutes(s.durationMinutes)}</span>
                </li>
              ))}
              {!sessions?.length && <EmptyState title="No sessions yet" message="Your completed sessions will appear here." />}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
