import { prisma } from '../lib/prisma.js';
import { addDays, dayKey, startOfDay, startOfWeek, WEEKDAYS, MS_PER_DAY } from '../utils/dates.js';
import { EXAM_PREP_HOURS } from './priority.js';

export interface ScoreComponent {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface ProductivityScore {
  score: number;
  components: ScoreComponent[];
}

const round = (n: number) => Math.round(n);

export function goalProgress(milestones: { done: boolean }[]): number {
  if (!milestones.length) return 0;
  return round((milestones.filter((m) => m.done).length / milestones.length) * 100);
}

export function skillProgress(s: { currentLevel: number; targetLevel: number }): number {
  if (s.targetLevel <= 0) return 100;
  return Math.min(100, round((s.currentLevel / s.targetLevel) * 100));
}

/**
 * Weekly Productivity Score (0–100):
 *   Completion  40 — share of work due this week (or overdue) that you finished
 *   Study goal  30 — study minutes vs. your weekly goal, pro-rated to today
 *   On time     20 — loses 4 points per overdue item (max 5)
 *   Consistency 10 — share of days this week with study or completed work
 */
export function computeProductivityScore(input: {
  completedThisWeek: number;
  openDueThisWeek: number;
  overdue: number;
  studyMinutes: number;
  weeklyGoalMinutes: number;
  activeDays: number;
  daysElapsed: number;
}): ProductivityScore {
  const denom = input.completedThisWeek + input.openDueThisWeek;
  const completionRate = denom === 0 ? (input.completedThisWeek > 0 ? 1 : 0.5) : input.completedThisWeek / denom;
  const expected = Math.max(1, input.weeklyGoalMinutes * (input.daysElapsed / 7));
  const studyRate = Math.min(1, input.studyMinutes / expected);
  const onTimeRate = Math.max(0, 1 - input.overdue / 5);
  const consistency = Math.min(1, input.activeDays / Math.max(1, input.daysElapsed));

  const components: ScoreComponent[] = [
    {
      key: 'completion',
      label: 'Completion',
      points: round(40 * completionRate),
      max: 40,
      detail: `${input.completedThisWeek} of ${denom} items due this week completed`,
    },
    {
      key: 'study',
      label: 'Study goal',
      points: round(30 * studyRate),
      max: 30,
      detail: `${(input.studyMinutes / 60).toFixed(1)}h studied vs. ${(expected / 60).toFixed(1)}h expected so far`,
    },
    {
      key: 'ontime',
      label: 'On time',
      points: round(20 * onTimeRate),
      max: 20,
      detail: input.overdue ? `${input.overdue} overdue item${input.overdue > 1 ? 's' : ''}` : 'Nothing overdue',
    },
    {
      key: 'consistency',
      label: 'Consistency',
      points: round(10 * consistency),
      max: 10,
      detail: `Active on ${input.activeDays} of ${input.daysElapsed} days this week`,
    },
  ];
  return { score: components.reduce((s, c) => s + c.points, 0), components };
}

/** Consecutive days (ending today, or yesterday if today has no activity yet) with activity. */
export function computeStreak(activeDayKeys: Set<number>, now: Date): number {
  let cursor = dayKey(now).getTime();
  if (!activeDayKeys.has(cursor)) cursor -= MS_PER_DAY;
  let streak = 0;
  while (activeDayKeys.has(cursor)) {
    streak++;
    cursor -= MS_PER_DAY;
  }
  return streak;
}

export async function productivityOverview(userId: string, now: Date = new Date()) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const lastWeekStart = addDays(weekStart, -7);
  const historyStart = addDays(weekStart, -7 * 7);

  const [records, tasks, assignments, exams, sessions, goals, courses] = await Promise.all([
    prisma.productivityRecord.findMany({
      where: { userId, date: { gte: dayKey(historyStart) } },
      orderBy: { date: 'asc' },
    }),
    prisma.task.findMany({ where: { userId } }),
    prisma.assignment.findMany({ where: { userId } }),
    prisma.exam.findMany({ where: { userId, date: { gte: now } } }),
    prisma.studySession.findMany({ where: { userId, start: { gte: addDays(now, -14) } } }),
    prisma.careerGoal.findMany({ where: { userId }, include: { milestones: true } }),
    prisma.course.findMany({ where: { userId } }),
  ]);

  const recordByDay = new Map(records.map((r) => [r.date.getTime(), r]));
  const dayRecord = (d: Date) => recordByDay.get(dayKey(d).getTime());

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const r = dayRecord(d);
    return {
      date: d,
      label: WEEKDAYS[d.getDay()].slice(0, 3),
      studyMinutes: r?.studyMinutes ?? 0,
      tasksCompleted: r?.tasksCompleted ?? 0,
      focusSessions: r?.focusSessions ?? 0,
      isFuture: d > now,
    };
  });

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const ws = addDays(historyStart, i * 7);
    let studyMinutes = 0;
    let tasksCompleted = 0;
    for (let k = 0; k < 7; k++) {
      const r = dayRecord(addDays(ws, k));
      studyMinutes += r?.studyMinutes ?? 0;
      tasksCompleted += r?.tasksCompleted ?? 0;
    }
    return { weekStart: ws, label: `${ws.getDate()}/${ws.getMonth() + 1}`, studyHours: +(studyMinutes / 60).toFixed(1), tasksCompleted };
  });

  const inRange = (d: Date | null, a: Date, b: Date) => !!d && d >= a && d < b;
  const completed = [
    ...tasks.filter((t) => t.status === 'done').map((t) => t.completedAt),
    ...assignments.filter((a) => a.status === 'completed').map((a) => a.completedAt),
  ];
  const completedThisWeek = completed.filter((d) => inRange(d, weekStart, weekEnd)).length;
  const completedLastWeek = completed.filter((d) => inRange(d, lastWeekStart, weekStart)).length;

  const openTasks = tasks.filter((t) => t.status !== 'done');
  const openAssignments = assignments.filter((a) => a.status !== 'completed');
  const openDue = [...openTasks.map((t) => t.dueDate), ...openAssignments.map((a) => a.deadline)];
  const overdue = openDue.filter((d) => d && d < now).length;
  const openDueThisWeek = openDue.filter((d) => d && d < weekEnd).length;

  const studyMinutesThisWeek = week.reduce((s, d) => s + d.studyMinutes, 0);
  const daysElapsed = Math.min(7, Math.floor((startOfDay(now).getTime() - weekStart.getTime()) / MS_PER_DAY) + 1);
  const activeDays = week.filter((d) => !d.isFuture && (d.studyMinutes > 0 || d.tasksCompleted > 0)).length;
  const weeklyGoalMinutes = user.studyHoursPerWeek * 60;

  const score = computeProductivityScore({
    completedThisWeek,
    openDueThisWeek,
    overdue,
    studyMinutes: studyMinutesThisWeek,
    weeklyGoalMinutes,
    activeDays,
    daysElapsed,
  });

  const activeKeys = new Set(
    records.filter((r) => r.studyMinutes > 0 || r.tasksCompleted > 0).map((r) => r.date.getTime()),
  );
  const streak = computeStreak(activeKeys, now);

  const weekdayTotals = new Array(7).fill(0);
  for (const r of records.filter((r) => r.date >= dayKey(addDays(now, -28)))) {
    weekdayTotals[r.date.getUTCDay()] += r.studyMinutes + r.tasksCompleted * 30;
  }
  const bestIdx = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const mostProductiveDay = weekdayTotals[bestIdx] > 0 ? WEEKDAYS[bestIdx] : null;

  const courseWorkload = courses
    .map((c) => {
      const remainingHours =
        openAssignments.filter((a) => a.courseId === c.id).reduce((s, a) => s + a.estimatedHours * (1 - a.progress / 100), 0) +
        openTasks.filter((t) => t.courseId === c.id).reduce((s, t) => s + t.estimatedMinutes / 60, 0) +
        exams.filter((e) => e.courseId === c.id).reduce((s, e) => s + EXAM_PREP_HOURS * (1 - e.preparation / 100), 0);
      const studied = sessions.filter((s) => s.courseId === c.id).reduce((s, x) => s + x.durationMinutes, 0);
      return {
        courseId: c.id,
        code: c.code,
        name: c.name,
        color: c.color,
        remainingHours: +remainingHours.toFixed(1),
        studiedHours14d: +(studied / 60).toFixed(1),
      };
    })
    .sort((a, b) => b.remainingHours - a.remainingHours);

  const goalStats = goals.map((g) => ({
    id: g.id,
    title: g.title,
    progress: goalProgress(g.milestones),
    done: g.milestones.filter((m) => m.done).length,
    total: g.milestones.length,
  }));

  return {
    week,
    weeks,
    thisWeek: {
      tasksCompleted: completedThisWeek,
      studyMinutes: studyMinutesThisWeek,
      focusSessions: week.reduce((s, d) => s + d.focusSessions, 0),
      weeklyGoalMinutes,
      completionRate: completedThisWeek + openDueThisWeek ? round((completedThisWeek / (completedThisWeek + openDueThisWeek)) * 100) : null,
      overdue,
    },
    lastWeek: { tasksCompleted: completedLastWeek },
    streak,
    mostProductiveDay,
    score,
    courseWorkload,
    goals: goalStats,
  };
}
