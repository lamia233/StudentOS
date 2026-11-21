import { prisma } from '../lib/prisma.js';
import { addDays, calendarDaysUntil, relativeDayLabel, startOfWeek } from '../utils/dates.js';

/** Creates deadline/exam/goal notifications that don't exist yet (idempotent via dedupeKey). */
export async function refreshNotifications(userId: string, now: Date = new Date()) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const drafts: { title: string; message: string; type: string; link: string; dedupeKey: string }[] = [];

  if (user.notifyDeadlines) {
    const tomorrowEnd = addDays(now, 2);
    const [assignments, tasks] = await Promise.all([
      prisma.assignment.findMany({ where: { userId, status: { not: 'completed' }, deadline: { gte: now, lte: tomorrowEnd } } }),
      prisma.task.findMany({ where: { userId, status: { not: 'done' }, dueDate: { gte: now, lte: tomorrowEnd }, priority: { in: ['high', 'critical'] } } }),
    ]);
    for (const a of assignments.filter((a) => calendarDaysUntil(a.deadline, now) <= 1)) {
      drafts.push({ title: 'Deadline approaching', message: `${a.title} is due ${relativeDayLabel(a.deadline, now)}.`, type: 'deadline', link: '/app/radar', dedupeKey: `due-${a.id}-${calendarDaysUntil(a.deadline, now)}` });
    }
    for (const t of tasks.filter((t) => t.dueDate && calendarDaysUntil(t.dueDate, now) <= 1)) {
      drafts.push({ title: 'Task due soon', message: `${t.title} is due ${relativeDayLabel(t.dueDate!, now)}.`, type: 'deadline', link: '/app/tasks', dedupeKey: `task-${t.id}-${calendarDaysUntil(t.dueDate!, now)}` });
    }
  }

  if (user.notifyExams) {
    const exams = await prisma.exam.findMany({ where: { userId, date: { gte: now, lte: addDays(now, 4) } } });
    for (const e of exams) {
      const d = calendarDaysUntil(e.date, now);
      drafts.push({ title: 'Upcoming exam', message: `${e.name} is ${relativeDayLabel(e.date, now)}. You're ${e.preparation}% prepared.`, type: 'exam', link: '/app/academics?tab=exams', dedupeKey: `exam-${e.id}-${d}` });
    }
  }

  if (user.notifyGoals) {
    const weekStart = startOfWeek(now);
    const sessions = await prisma.studySession.aggregate({ where: { userId, start: { gte: weekStart } }, _sum: { durationMinutes: true } });
    const minutes = sessions._sum.durationMinutes ?? 0;
    if (minutes >= user.studyHoursPerWeek * 60) {
      drafts.push({ title: 'Weekly study goal reached', message: `You completed your weekly study goal of ${user.studyHoursPerWeek}h. Great work!`, type: 'study', link: '/app/productivity', dedupeKey: `studygoal-${weekStart.toISOString().slice(0, 10)}` });
    }
    const goals = await prisma.careerGoal.findMany({ where: { userId, deadline: { lte: addDays(now, 30) } }, include: { milestones: true } });
    for (const g of goals) {
      const open = g.milestones.filter((m) => !m.done);
      if (open.length) {
        drafts.push({ title: 'Unfinished career milestone', message: `"${open[0].title}" for ${g.title} is still open.`, type: 'goal', link: '/app/career', dedupeKey: `goal-${g.id}-${weekStart.toISOString().slice(0, 10)}` });
      }
    }
  }

  for (const d of drafts) {
    await prisma.notification.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey: d.dedupeKey } },
      create: { userId, ...d },
      update: {},
    });
  }
}
