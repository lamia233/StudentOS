import { prisma } from '../lib/prisma.js';
import { addDays, endOfDay, setTime, startOfDay, MS_PER_DAY, relativeDayLabel, calendarDaysUntil } from '../utils/dates.js';
import { parseJson } from '../utils/json.js';
import { goalProgress, productivityOverview, skillProgress } from './analytics.js';
import { collectWorkItems, planDay } from './planner.js';
import { rankItems } from './priority.js';
import { generateRecommendations } from './recommendations.js';

export interface ClassMeeting {
  day: number;
  start: string;
  end: string;
  room?: string;
}

export type RadarLevel = 'critical' | 'approaching' | 'upcoming' | 'safe';

/** Deadline Radar buckets: ≤1 day critical · ≤4 approaching · ≤10 upcoming · later safe. Overdue counts as critical. */
export function radarLevel(due: Date, now: Date): RadarLevel {
  const d = calendarDaysUntil(due, now);
  if (d <= 1) return 'critical';
  if (d <= 4) return 'approaching';
  if (d <= 10) return 'upcoming';
  return 'safe';
}

export function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Today's available study minutes derived from the weekly goal (weekends get 1.5×). */
export function availableMinutesToday(studyHoursPerWeek: number, now: Date): number {
  const weekday = now.getDay();
  const weight = weekday === 0 || weekday === 6 ? 1.5 : 1;
  const totalWeight = 5 + 1.5 * 2;
  return Math.round(((studyHoursPerWeek * 60) / totalWeight) * weight / 5) * 5;
}

export async function deadlineRadar(userId: string, now: Date = new Date()) {
  const horizon = addDays(now, 45);
  const [assignments, exams, tasks, orgInterests] = await Promise.all([
    prisma.assignment.findMany({ where: { userId, status: { not: 'completed' }, deadline: { lte: horizon } }, include: { course: true } }),
    prisma.exam.findMany({ where: { userId, date: { gte: now, lte: horizon } }, include: { course: true } }),
    prisma.task.findMany({ where: { userId, status: { not: 'done' }, dueDate: { not: null, lte: horizon } }, include: { course: true } }),
    prisma.orgEventInterest.findMany({ where: { userId, status: { in: ['interested', 'saved'] } }, include: { event: { include: { organization: true } } } }),
  ]);
  const items = [
    ...assignments.map((a) => ({ id: a.id, kind: 'assignment' as const, title: a.title, course: a.course.name, courseCode: a.course.code, color: a.course.color, due: a.deadline, progress: a.progress, priority: a.priority, link: '/app/academics?tab=assignments' })),
    ...exams.map((e) => ({ id: e.id, kind: 'exam' as const, title: e.name, course: e.course.name, courseCode: e.course.code, color: e.course.color, due: e.date, progress: e.preparation, priority: 'high', link: '/app/academics?tab=exams' })),
    ...tasks.map((t) => ({ id: t.id, kind: 'task' as const, title: t.title, course: t.course?.name ?? null, courseCode: t.course?.code ?? null, color: t.course?.color ?? null, due: t.dueDate!, progress: t.status === 'in_progress' ? 40 : 0, priority: t.priority, category: t.category, link: '/app/tasks' })),
    ...orgInterests
      .filter((i) => i.event.registrationDeadline && i.event.registrationDeadline >= now && i.event.registrationDeadline <= horizon)
      .map((i) => ({ id: i.event.id, kind: 'registration' as const, title: `Register: ${i.event.title}`, course: i.event.organization.name, courseCode: null, color: i.event.organization.color, due: i.event.registrationDeadline!, progress: 0, priority: 'medium', link: '/app/campus' })),
  ]
    .map((i) => ({ ...i, level: radarLevel(i.due, now), label: relativeDayLabel(i.due, now), daysLeft: calendarDaysUntil(i.due, now), overdue: i.due < now }))
    .sort((a, b) => a.due.getTime() - b.due.getTime());

  const counts = { critical: 0, approaching: 0, upcoming: 0, safe: 0 } as Record<RadarLevel, number>;
  items.forEach((i) => counts[i.level]++);
  return { items, counts };
}

export async function todaySchedule(userId: string, now: Date = new Date()) {
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const [courses, events] = await Promise.all([
    prisma.course.findMany({ where: { userId } }),
    prisma.event.findMany({ where: { userId, start: { lte: dayEnd }, end: { gte: dayStart } }, orderBy: { start: 'asc' }, include: { course: true } }),
  ]);
  const classes = courses.flatMap((c) =>
    parseJson<ClassMeeting[]>(c.schedule, [])
      .filter((m) => m.day === now.getDay())
      .map((m) => ({
        id: `class-${c.id}-${m.start}`,
        title: `${c.code} — ${c.name}`,
        type: 'class',
        start: setTime(now, m.start),
        end: setTime(now, m.end),
        location: m.room ?? null,
        color: c.color,
      })),
  );
  const evs = events.map((e) => ({ id: e.id, title: e.title, type: e.type, start: e.start, end: e.end, location: e.location, color: e.course?.color ?? null }));
  return [...classes, ...evs].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function getDashboard(userId: string, now: Date = new Date()) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const [items, schedule, radar, overview, recommendations, goals, skills, courses, todayTasks, exams, notionConn] = await Promise.all([
    collectWorkItems(userId, now),
    todaySchedule(userId, now),
    deadlineRadar(userId, now),
    productivityOverview(userId, now),
    generateRecommendations(userId, now),
    prisma.careerGoal.findMany({ where: { userId }, include: { milestones: { orderBy: { order: 'asc' } } } }),
    prisma.skill.findMany({ where: { userId } }),
    prisma.course.findMany({ where: { userId }, include: { assignments: true, exams: true } }),
    prisma.task.findMany({
      where: { userId, OR: [{ dueDate: { lte: endOfDay(now) }, status: { not: 'done' } }, { completedAt: { gte: startOfDay(now) } }] },
      include: { course: true },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      take: 8,
    }),
    prisma.exam.findMany({ where: { userId, date: { gte: now } }, include: { course: true }, orderBy: { date: 'asc' }, take: 4 }),
    prisma.notionConnection.findUnique({ where: { userId } }),
  ]);

  const available = availableMinutesToday(user.studyHoursPerWeek, now);
  const ranked = rankItems(items, now);
  const focus = planDay(ranked, available);
  const upcoming = radar.items.filter((i) => !i.overdue && i.kind !== 'registration');
  const nextDeadline = upcoming.find((i) => i.kind === 'assignment' || i.kind === 'exam' || i.priority === 'high' || i.priority === 'critical') ?? upcoming[0];

  let semesterProgress: number | null = null;
  let semesterWeek: number | null = null;
  let semesterWeeks: number | null = null;
  if (user.semesterStart && user.semesterEnd) {
    const total = user.semesterEnd.getTime() - user.semesterStart.getTime();
    semesterProgress = Math.min(100, Math.max(0, Math.round(((now.getTime() - user.semesterStart.getTime()) / total) * 100)));
    semesterWeeks = Math.ceil(total / (7 * MS_PER_DAY));
    semesterWeek = Math.min(semesterWeeks, Math.max(1, Math.ceil((now.getTime() - user.semesterStart.getTime()) / (7 * MS_PER_DAY))));
  }

  const courseHealth = courses.map((c) => {
    const work = [...c.assignments.map((a) => a.progress), ...c.exams.map((e) => e.preparation)];
    const progress = work.length ? Math.round(work.reduce((s, x) => s + x, 0) / work.length) : 0;
    const overdue = c.assignments.filter((a) => a.status !== 'completed' && a.deadline < now).length;
    const status = overdue > 0 ? 'behind' : progress < 40 && c.exams.some((e) => e.date > now && e.date < addDays(now, 7)) ? 'at-risk' : 'on-track';
    return { id: c.id, code: c.code, name: c.name, color: c.color, progress, status };
  });

  const goalStats = goals.map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    progress: goalProgress(g.milestones),
    nextMilestone: g.milestones.find((m) => !m.done)?.title ?? null,
    deadline: g.deadline,
  }));
  const careerProgress = goalStats.length ? Math.round(goalStats.reduce((s, g) => s + g.progress, 0) / goalStats.length) : 0;

  return {
    user: { name: user.name, university: user.university, semester: user.semester, isDemo: user.isDemo },
    greeting: greetingFor(now),
    now,
    nextDeadline: nextDeadline ? { title: nextDeadline.title, label: nextDeadline.label, kind: nextDeadline.kind, course: nextDeadline.course } : null,
    semester: { progress: semesterProgress, week: semesterWeek, weeks: semesterWeeks, start: user.semesterStart, end: user.semesterEnd },
    availableMinutes: available,
    focus,
    schedule,
    todayTasks: todayTasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, estimatedMinutes: t.estimatedMinutes, course: t.course ? { code: t.course.code, color: t.course.color } : null })),
    radar: { counts: radar.counts, items: radar.items.slice(0, 6) },
    exams: exams.map((e) => ({ id: e.id, name: e.name, course: e.course.name, code: e.course.code, color: e.course.color, date: e.date, location: e.location, preparation: e.preparation, label: relativeDayLabel(e.date, now) })),
    study: { minutesThisWeek: overview.thisWeek.studyMinutes, goalMinutes: overview.thisWeek.weeklyGoalMinutes, week: overview.week },
    productivity: { score: overview.score, streak: overview.streak, tasksCompleted: overview.thisWeek.tasksCompleted, lastWeekTasksCompleted: overview.lastWeek.tasksCompleted },
    courseHealth,
    career: { progress: careerProgress, goals: goalStats },
    skills: skills.map((s) => ({ id: s.id, name: s.name, currentLevel: s.currentLevel, targetLevel: s.targetLevel, progress: skillProgress(s) })).slice(0, 5),
    recommendations: recommendations.slice(0, 4),
    notion: notionConn ? { status: notionConn.status, mode: notionConn.mode, lastSyncedAt: notionConn.lastSyncedAt } : null,
  };
}
