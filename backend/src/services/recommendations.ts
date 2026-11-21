import { prisma } from '../lib/prisma.js';
import { addDays, calendarDaysUntil, startOfWeek } from '../utils/dates.js';
import { productivityOverview, skillProgress } from './analytics.js';
import { collectWorkItems } from './planner.js';
import { displayTitle, rankItems } from './priority.js';

export interface Recommendation {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  action?: { label: string; link: string };
}

/** Rule-based recommendations computed from the user's real data (no AI claims). */
export async function generateRecommendations(userId: string, now: Date = new Date()): Promise<Recommendation[]> {
  const recs: Recommendation[] = [];
  const [items, overview, exams, goals, skills, sessions] = await Promise.all([
    collectWorkItems(userId, now),
    productivityOverview(userId, now),
    prisma.exam.findMany({ where: { userId, date: { gte: now, lte: addDays(now, 10) } }, include: { course: true }, orderBy: { date: 'asc' } }),
    prisma.careerGoal.findMany({ where: { userId }, include: { milestones: true } }),
    prisma.skill.findMany({ where: { userId }, include: { tasks: { where: { status: { not: 'done' } } } } }),
    prisma.studySession.findMany({ where: { userId }, orderBy: { start: 'desc' }, take: 300 }),
  ]);

  const ranked = rankItems(items, now);
  const overdue = items.filter((i) => i.kind !== 'exam' && i.dueDate && i.dueDate < now);
  if (overdue.length) {
    recs.push({
      id: 'overdue',
      severity: 'critical',
      title: `${overdue.length} overdue item${overdue.length > 1 ? 's' : ''}`,
      message: `"${overdue[0].title}" is past its deadline. Finish it or reschedule it so it stops blocking your plan.`,
      action: { label: 'Open Deadline Radar', link: '/app/radar' },
    });
  }

  const soon = items.filter((i) => i.kind !== 'exam' && i.dueDate && i.dueDate >= now && i.dueDate <= addDays(now, 5));
  if (soon.length >= 2) {
    const top = ranked.find((r) => r.kind !== 'exam' && soon.some((s) => s.id === r.id));
    recs.push({
      id: 'deadline-cluster',
      severity: 'warning',
      title: `${soon.length} deadlines in the next 5 days`,
      message: `You have ${soon.length} deadlines within the next 5 days.${top ? ` Consider starting "${top.title}" today.` : ''}`,
      action: { label: 'Plan my week', link: '/app/planner' },
    });
  }

  for (const exam of exams) {
    const last = sessions.find((s) => s.courseId === exam.courseId);
    const daysToExam = calendarDaysUntil(exam.date, now);
    const sinceStudy = last ? calendarDaysUntil(now, last.start) : null;
    if (sinceStudy === null || sinceStudy >= 3) {
      recs.push({
        id: `exam-gap-${exam.id}`,
        severity: daysToExam <= 4 ? 'critical' : 'warning',
        title: `${exam.course.name} needs attention`,
        message:
          sinceStudy === null
            ? `You haven't logged any study for ${exam.course.name} and your exam is in ${daysToExam} days.`
            : `You haven't studied ${exam.course.name} in ${sinceStudy} days and your exam is in ${daysToExam} days.`,
        action: { label: 'Start a focus session', link: '/app/focus' },
      });
    } else if (exam.preparation < 50 && daysToExam <= 7) {
      recs.push({
        id: `exam-prep-${exam.id}`,
        severity: 'warning',
        title: `${exam.name}: ${exam.preparation}% prepared`,
        message: `${exam.name} is in ${daysToExam} days. Schedule daily revision blocks to reach at least 80% preparation.`,
        action: { label: 'Plan my week', link: '/app/planner' },
      });
    }
  }

  const { tasksCompleted } = overview.thisWeek;
  const last = overview.lastWeek.tasksCompleted;
  if (tasksCompleted > 0 && last > 0 && tasksCompleted !== last) {
    const pct = Math.round(((tasksCompleted - last) / last) * 100);
    recs.push({
      id: 'week-compare',
      severity: pct > 0 ? 'success' : 'info',
      title: pct > 0 ? 'More done than last week' : 'Slower week so far',
      message: `You completed ${tasksCompleted} item${tasksCompleted > 1 ? 's' : ''} this week — ${Math.abs(pct)}% ${pct > 0 ? 'more' : 'fewer'} than last week (${last}).`,
    });
  } else if (tasksCompleted > 0) {
    recs.push({
      id: 'week-compare',
      severity: 'success',
      title: 'Keep the momentum',
      message: `You completed ${tasksCompleted} item${tasksCompleted > 1 ? 's' : ''} this week.`,
    });
  }

  const goalMin = overview.thisWeek.weeklyGoalMinutes;
  const studied = overview.thisWeek.studyMinutes;
  const daysElapsed = Math.floor((now.getTime() - startOfWeek(now).getTime()) / 86_400_000) + 1;
  if (goalMin > 0 && studied >= goalMin) {
    recs.push({ id: 'study-goal', severity: 'success', title: 'Weekly study goal reached', message: `You've studied ${(studied / 60).toFixed(1)}h this week — goal achieved.` });
  } else if (goalMin > 0 && studied < goalMin * (daysElapsed / 7) * 0.7) {
    recs.push({
      id: 'study-goal',
      severity: 'info',
      title: 'Behind your study pace',
      message: `You've studied ${(studied / 60).toFixed(1)}h of your ${(goalMin / 60).toFixed(0)}h weekly goal. A 45-minute focus session today keeps you on track.`,
      action: { label: 'Open Focus Mode', link: '/app/focus' },
    });
  }

  const openMilestones = goals.flatMap((g) => g.milestones.filter((m) => !m.done));
  if (openMilestones.length) {
    recs.push({
      id: 'milestones',
      severity: 'info',
      title: 'Career milestones waiting',
      message: `You have ${openMilestones.length} unfinished career milestone${openMilestones.length > 1 ? 's' : ''}. Consider scheduling 30 minutes this weekend.`,
      action: { label: 'Open Career', link: '/app/career' },
    });
  }

  const gap = skills
    .filter((s) => s.currentLevel < s.targetLevel && s.tasks.length === 0)
    .sort((a, b) => skillProgress(a) - skillProgress(b))[0];
  if (gap) {
    recs.push({
      id: `skill-${gap.id}`,
      severity: 'info',
      title: `Practice ${gap.name}`,
      message: `${gap.name} is at level ${gap.currentLevel}/${gap.targetLevel} with no practice tasks planned. Add one small practice task this week.`,
      action: { label: 'Open Skills', link: '/app/skills' },
    });
  }

  if (!recs.length && ranked[0]) {
    recs.push({ id: 'top', severity: 'info', title: 'Next best step', message: `Your highest priority right now is "${displayTitle(ranked[0])}".` });
  }

  const order = { critical: 0, warning: 1, info: 2, success: 3 };
  return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}
