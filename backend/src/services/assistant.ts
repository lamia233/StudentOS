import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { addDays, calendarDaysUntil, relativeDayLabel } from '../utils/dates.js';
import { getDashboard, deadlineRadar } from './dashboard.js';
import { goalProgress, productivityOverview, skillProgress } from './analytics.js';

export interface AssistantReply {
  answer: string;
  source: 'rules' | 'llm';
  intent: string;
  suggestions: string[];
}

const SUGGESTIONS = [
  'What should I prioritize today?',
  'What deadlines are coming this week?',
  'Am I behind in any course?',
  'How should I prepare for my next exam?',
  'What should I do for my internship preparation?',
  'How productive was I this week?',
];

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`);

type Intent = 'prioritize' | 'deadlines' | 'exam' | 'behind' | 'career' | 'skills' | 'productivity' | 'schedule' | 'greeting' | 'help';

export function detectIntent(q: string): Intent {
  const s = q.toLowerCase();
  if (/\b(hi|hello|hey|salam)\b/.test(s) && s.length < 20) return 'greeting';
  if (/(exam|test|quiz|midterm|final|revis|prepare)/.test(s)) return 'exam';
  if (/(behind|falling|on track|struggl|at risk|course health)/.test(s)) return 'behind';
  if (/(intern|career|job|cv|resume|portfolio|interview|apply)/.test(s)) return 'career';
  if (/(skill|learn|level up|practice)/.test(s)) return 'skills';
  if (/(productiv|streak|score|how did i|study hours|this week.*(do|perform))/.test(s)) return 'productivity';
  if (/(deadline|due|this week|upcoming|coming)/.test(s)) return 'deadlines';
  if (/(schedule|class|calendar|tomorrow)/.test(s)) return 'schedule';
  if (/(prioriti|today|what should i (do|study)|focus|next|start)/.test(s)) return 'prioritize';
  return 'help';
}

/** Deterministic assistant that answers from the user's actual StudentOS data. */
export async function ruleBasedAnswer(userId: string, question: string, now: Date = new Date()): Promise<AssistantReply> {
  const intent = detectIntent(question);
  const dash = await getDashboard(userId, now);
  const lines: string[] = [];

  switch (intent) {
    case 'greeting':
    case 'prioritize': {
      if (intent === 'greeting') lines.push(`Hi ${dash.user.name.split(' ')[0]}! Here's where things stand.`);
      if (!dash.focus.length) {
        lines.push("You have no open work with deadlines right now. A great time to get ahead on a career milestone or skill.");
        break;
      }
      lines.push(`With about **${fmtMin(dash.availableMinutes)}** available today, I'd prioritize:`);
      dash.focus.forEach((f, i) => lines.push(`${i + 1}. **${f.title}** — ${fmtMin(f.minutes)} · ${f.priority} priority (${f.reason})`));
      if (dash.nextDeadline) lines.push('', `Your next important deadline is **${dash.nextDeadline.title}** — ${dash.nextDeadline.label}.`);
      lines.push('', 'Ranking uses the StudentOS priority score: deadline urgency + priority + remaining effort + exam proximity + completion.');
      break;
    }
    case 'deadlines': {
      const radar = await deadlineRadar(userId, now);
      const week = radar.items.filter((i) => i.due <= addDays(now, 7));
      if (!week.length) {
        lines.push('Nothing is due in the next 7 days. 🎉');
        break;
      }
      lines.push(`You have **${week.length}** deadline${week.length > 1 ? 's' : ''} in the next 7 days:`);
      week.forEach((i) => lines.push(`- **${i.title}**${i.course ? ` (${i.course})` : ''} — ${i.label} · ${i.level.toUpperCase()}`));
      const critical = week.filter((i) => i.level === 'critical');
      if (critical.length) lines.push('', `Start with **${critical[0].title}** — it's in the critical zone.`);
      break;
    }
    case 'exam': {
      const exams = await prisma.exam.findMany({ where: { userId, date: { gte: now } }, include: { course: true }, orderBy: { date: 'asc' } });
      if (!exams.length) {
        lines.push("You don't have any upcoming exams recorded. Add them under Academics → Exams.");
        break;
      }
      const s = question.toLowerCase();
      const exam =
        exams.find((e) => s.includes(e.course.code.toLowerCase()) || s.includes(e.course.name.toLowerCase())) ??
        exams.find((e) => e.course.name.toLowerCase().split(/\s+/).some((w) => w.length > 4 && s.includes(w.slice(0, 5)))) ??
        exams[0];
      const days = Math.max(1, calendarDaysUntil(exam.date, now));
      const topics = (exam.topics ?? '').split('\n').map((t) => t.trim()).filter(Boolean);
      const remainingHours = Math.round(8 * (1 - exam.preparation / 100) * 10) / 10;
      const perDay = Math.ceil(((remainingHours * 60) / days) / 5) * 5;
      lines.push(`**${exam.name}** (${exam.course.name}) is ${relativeDayLabel(exam.date, now)}${exam.location ? ` in ${exam.location}` : ''}. You're **${exam.preparation}%** prepared.`);
      lines.push('', `Plan: about **${remainingHours}h** of revision left → roughly **${fmtMin(perDay)} per day** until the exam.`);
      if (topics.length) {
        const doneCount = Math.floor((exam.preparation / 100) * topics.length);
        const todo = topics.slice(doneCount);
        lines.push('', 'Suggested order:');
        todo.forEach((t, i) => lines.push(`${i + 1}. ${t}${i === 0 ? ' ← start here' : ''}`));
        if (doneCount) lines.push('', `Quick review only: ${topics.slice(0, doneCount).join(', ')}.`);
      }
      lines.push('', 'Tip: use Focus Mode with 25/5 Pomodoros and finish with past-paper questions the day before.');
      break;
    }
    case 'behind': {
      const behind = dash.courseHealth.filter((c) => c.status !== 'on-track');
      if (!behind.length) lines.push("You're on track in every course. 👏");
      else {
        lines.push('Courses that need attention:');
        behind.forEach((c) => lines.push(`- **${c.code} ${c.name}** — ${c.status === 'behind' ? 'has overdue work' : 'exam soon with low preparation'} (${c.progress}% average progress)`));
      }
      const ok = dash.courseHealth.filter((c) => c.status === 'on-track');
      if (ok.length) lines.push('', `On track: ${ok.map((c) => c.code).join(', ')}.`);
      break;
    }
    case 'career': {
      const goals = await prisma.careerGoal.findMany({ where: { userId }, include: { milestones: { orderBy: { order: 'asc' } } } });
      if (!goals.length) {
        lines.push('You have no career goals yet. Add one in the Career Center — e.g. "Get a software engineering internship".');
        break;
      }
      const goal = goals.find((g) => /intern/i.test(g.title + g.category)) ?? goals[0];
      const open = goal.milestones.filter((m) => !m.done);
      lines.push(`**${goal.title}** is at **${goalProgress(goal.milestones)}%**${goal.deadline ? `, deadline ${relativeDayLabel(goal.deadline, now)}` : ''}.`);
      if (goal.milestones.some((m) => m.done)) lines.push(`Done: ${goal.milestones.filter((m) => m.done).map((m) => m.title).join(', ')}.`);
      if (open.length) {
        lines.push('', 'Next steps:');
        open.slice(0, 4).forEach((m, i) => lines.push(`${i + 1}. ${m.title}${i === 0 ? ' — schedule 30–45 min this week' : ''}`));
      }
      const careerTasks = await prisma.task.findMany({ where: { userId, category: 'career', status: { not: 'done' } }, orderBy: { dueDate: 'asc' }, take: 3 });
      if (careerTasks.length) lines.push('', `Open career tasks: ${careerTasks.map((t) => `${t.title}${t.dueDate ? ` (${relativeDayLabel(t.dueDate, now)})` : ''}`).join('; ')}.`);
      break;
    }
    case 'skills': {
      const skills = await prisma.skill.findMany({ where: { userId } });
      if (!skills.length) {
        lines.push('Add skills in the Skills tracker to get personalised advice.');
        break;
      }
      const sorted = [...skills].sort((a, b) => skillProgress(a) - skillProgress(b));
      lines.push('Biggest skill gaps:');
      sorted.slice(0, 3).forEach((s) => lines.push(`- **${s.name}** — level ${s.currentLevel}/${s.targetLevel} (${skillProgress(s)}%)`));
      lines.push('', `Focus one weekly practice block on **${sorted[0].name}**.`);
      break;
    }
    case 'productivity': {
      const o = await productivityOverview(userId, now);
      lines.push(`Weekly productivity score: **${o.score.score}/100**.`);
      o.score.components.forEach((c) => lines.push(`- ${c.label}: ${c.points}/${c.max} — ${c.detail}`));
      lines.push('', `Study this week: **${(o.thisWeek.studyMinutes / 60).toFixed(1)}h** of ${(o.thisWeek.weeklyGoalMinutes / 60).toFixed(0)}h · streak **${o.streak} day${o.streak === 1 ? '' : 's'}**${o.mostProductiveDay ? ` · most productive on ${o.mostProductiveDay}s` : ''}.`);
      break;
    }
    case 'schedule': {
      if (!dash.schedule.length) lines.push('Nothing is scheduled for today.');
      else {
        lines.push("Today's schedule:");
        dash.schedule.forEach((e) => lines.push(`- ${e.start.toTimeString().slice(0, 5)}–${e.end.toTimeString().slice(0, 5)} **${e.title}**${e.location ? ` · ${e.location}` : ''}`));
      }
      break;
    }
    default:
      lines.push("I can answer questions about your priorities, deadlines, exams, courses, career goals, skills and productivity — all from your StudentOS data. Try one of these:");
      SUGGESTIONS.slice(0, 4).forEach((s) => lines.push(`- ${s}`));
  }

  return { answer: lines.join('\n'), source: 'rules', intent, suggestions: SUGGESTIONS.filter((s) => s !== question).slice(0, 4) };
}

async function buildContext(userId: string, now: Date) {
  const dash = await getDashboard(userId, now);
  return JSON.stringify({
    today: now.toDateString(),
    student: dash.user,
    availableMinutesToday: dash.availableMinutes,
    recommendedFocus: dash.focus.map((f) => ({ title: f.title, minutes: f.minutes, reason: f.reason })),
    deadlines: dash.radar.items.map((i) => ({ title: i.title, course: i.course, due: i.label, level: i.level })),
    exams: dash.exams.map((e) => ({ name: e.name, when: e.label, preparation: e.preparation })),
    courseHealth: dash.courseHealth,
    career: dash.career,
    productivity: dash.productivity,
  });
}

/** Uses an OpenAI-compatible API when OPENAI_API_KEY is configured, otherwise (or on failure) the rule-based assistant. */
export async function answerQuestion(userId: string, question: string, now: Date = new Date()): Promise<AssistantReply> {
  const fallback = await ruleBasedAnswer(userId, question, now);
  if (!config.llm.apiKey) return fallback;
  try {
    const context = await buildContext(userId, now);
    const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
      body: JSON.stringify({
        model: config.llm.model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are StudentOS Assistant, a concise study coach. Answer ONLY from the JSON data provided. Use short markdown lists and bold for key items. Never invent deadlines or courses.',
          },
          { role: 'user', content: `My StudentOS data:\n${context}\n\nQuestion: ${question}` },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`LLM API responded ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error('Empty LLM response');
    return { ...fallback, answer, source: 'llm' };
  } catch (err) {
    if (!config.isTest) console.warn('Assistant LLM unavailable, using rule-based answer:', (err as Error).message);
    return fallback;
  }
}
