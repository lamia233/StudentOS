import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, BookOpen, Bot, Briefcase, CalendarDays, CheckCircle2, GraduationCap, Library, Radar, Sparkles, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/api';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';

const FEATURES = [
  { icon: Sparkles, title: 'Smart Study Planner', text: 'A transparent priority score turns deadlines, exams and effort into a realistic weekly plan — one click.' },
  { icon: Radar, title: 'Deadline Radar', text: 'Every assignment, exam and registration sorted into Critical, Approaching, Upcoming and Safe.' },
  { icon: GraduationCap, title: 'Academic Planner', text: 'Courses, assignments, exams, preparation and course health in one place.' },
  { icon: CalendarDays, title: 'Unified Calendar', text: 'Classes, study blocks, exams, deadlines and campus events in month, week and day views.' },
  { icon: Briefcase, title: 'Career & Skills', text: 'Internship goals with milestones, skill levels and the tasks that move them forward.' },
  { icon: BarChart3, title: 'Real Analytics', text: 'Productivity score, streaks and workload computed from what you actually did.' },
  { icon: Timer, title: 'Focus Mode', text: 'Pomodoro and custom sessions that log study time against the right course.' },
  { icon: Library, title: 'Knowledge Hub', text: 'Lecture notes, resources and research notes, searchable alongside your tasks.' },
  { icon: BookOpen, title: 'Notion Sync', text: 'Export tasks, assignments, notes and goals to Notion — or try the clearly-labelled demo mode.' },
];

export default function Landing() {
  const { demo, user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const tryDemo = async () => {
    setBusy(true);
    try {
      await demo();
      navigate('/app');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2" aria-label="Account">
            {user ? (
              <Button onClick={() => navigate('/app')}>Open dashboard</Button>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                  Log in
                </Link>
                <Button onClick={() => navigate('/register')}>Get started</Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent)]" />
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" /> Built with Devin · Notion-ready
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
              Your entire student life, <span className="bg-gradient-to-r from-brand-600 to-violet-500 bg-clip-text text-transparent">one smart workspace.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              StudentOS brings assignments, exams, classes, study plans, notes, goals and career prep together — and answers the question that matters every morning: <strong className="text-slate-900 dark:text-white">“What should I do today?”</strong>
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={tryDemo} loading={busy} icon={<Sparkles className="h-4 w-4" />}>
                Try the demo
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/register')}>
                Get started free <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-500">No sign-up needed for the demo · demo@studentos.app / demo1234</p>

            <DashboardPreview />
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50/60 py-20 dark:border-slate-800 dark:bg-slate-900/40" aria-labelledby="features">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="features" className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Everything a student juggles — finally connected</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">Each module feeds the others, so your dashboard, planner and assistant always reason over the full picture.</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20" aria-labelledby="how">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 id="how" className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">A planner you can actually trust</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">No black box. Every recommendation shows why it was ranked where it is.</p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  ['Deadline urgency', 'up to 35 pts'],
                  ['Your priority', 'up to 25 pts'],
                  ['Remaining effort vs. time left', 'up to 15 pts'],
                  ['Exam proximity', 'up to 15 pts'],
                  ['Work still to do', 'up to 10 pts'],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {k}</span>
                    <span className="text-slate-500">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="h-4 w-4 text-brand-500" /> StudentOS Assistant</div>
              <div className="mt-4 space-y-3 text-sm">
                <p className="ml-auto w-fit rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2 text-white">What should I prioritize today?</p>
                <div className="w-fit max-w-md rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  With about 3h available today, I'd prioritize:
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li><strong>Database Assignment 3</strong> — due tomorrow, 40% done</li>
                    <li><strong>Computer Networks revision</strong> — exam in 4 days</li>
                    <li><strong>Internship application</strong> — closes in 5 days</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-brand-600 to-violet-600 px-6 py-12 text-center text-white shadow-xl">
            <h2 className="text-3xl font-bold">Stop juggling five apps.</h2>
            <p className="mx-auto mt-2 max-w-xl text-brand-100">Open the demo and see a full semester — deadlines, exams, a weekly plan and an internship goal — in under a minute.</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="secondary" onClick={tryDemo} loading={busy}>Try the demo</Button>
              <Button size="lg" className="bg-white/15 hover:bg-white/25" onClick={() => navigate('/register')}>Create an account</Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        StudentOS · Built with Devin for the “Build a Smarter Student OS” challenge
      </footer>
    </div>
  );
}

function DashboardPreview() {
  const rows = [
    { t: 'Database Assignment 3', s: 'Due tomorrow · CSE 3521', c: '#6366f1', p: 'Critical' },
    { t: 'Computer Networks revision', s: 'Midterm in 4 days · 35% prepared', c: '#0ea5e9', p: 'High' },
    { t: 'Internship application', s: 'Brain Station 23 · 5 days left', c: '#8b5cf6', p: 'High' },
  ];
  return (
    <div className="relative mx-auto mt-14 max-w-5xl" aria-label="Dashboard preview" role="img">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-brand-500/10 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-left dark:bg-slate-950 md:grid-cols-3">
          <div className="rounded-xl bg-white p-4 shadow-card dark:bg-slate-900 md:col-span-2">
            <p className="text-xs font-medium text-slate-500">Good morning, Nusrat 👋</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Today's priorities</p>
            <ul className="mt-3 space-y-2">
              {rows.map((r) => (
                <li key={r.t} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                  <span className="h-8 w-1 rounded-full" style={{ background: r.c }} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{r.t}</span>
                    <span className="block text-xs text-slate-500">{r.s}</span>
                  </span>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:bg-rose-500/10">{r.p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-white p-4 shadow-card dark:bg-slate-900">
              <p className="text-xs text-slate-500">Productivity score</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">78<span className="text-base text-slate-400">/100</span></p>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 w-[78%] rounded-full bg-brand-500" /></div>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-card dark:bg-slate-900">
              <p className="text-xs text-slate-500">Internship goal</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">5 of 8 milestones</p>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 w-[63%] rounded-full bg-violet-500" /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
