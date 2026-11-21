import { prisma } from '../lib/prisma.js';
import { addDays, addMinutes, setTime, startOfDay, MS_PER_MIN } from '../utils/dates.js';
import {
  type Priority,
  type ScoredItem,
  type WorkItem,
  EXAM_PREP_HOURS,
  displayTitle,
  priorityLabel,
  rankItems,
} from './priority.js';

export const PREFERRED_START: Record<string, string> = {
  morning: '08:00',
  afternoon: '14:00',
  evening: '18:00',
  night: '20:30',
};

const asPriority = (p: string): Priority =>
  (['low', 'medium', 'high', 'critical'].includes(p) ? p : 'medium') as Priority;

/** Loads every unfinished task, assignment and upcoming exam for a user as WorkItems. */
export async function collectWorkItems(userId: string, now: Date = new Date()): Promise<WorkItem[]> {
  const [tasks, assignments, exams] = await Promise.all([
    prisma.task.findMany({ where: { userId, status: { not: 'done' } }, include: { course: true } }),
    prisma.assignment.findMany({ where: { userId, status: { not: 'completed' } }, include: { course: true } }),
    prisma.exam.findMany({ where: { userId, date: { gte: now } }, include: { course: true } }),
  ]);

  const items: WorkItem[] = [];
  for (const t of tasks) {
    items.push({
      id: t.id,
      kind: 'task',
      title: t.title,
      courseId: t.courseId,
      courseName: t.course?.name ?? null,
      courseCode: t.course?.code ?? null,
      color: t.course?.color ?? null,
      category: t.category,
      dueDate: t.dueDate,
      priority: asPriority(t.priority),
      remainingMinutes: t.status === 'in_progress' ? Math.ceil(t.estimatedMinutes * 0.6) : t.estimatedMinutes,
      progress: t.status === 'in_progress' ? 0.4 : 0,
    });
  }
  for (const a of assignments) {
    items.push({
      id: a.id,
      kind: 'assignment',
      title: a.title,
      courseId: a.courseId,
      courseName: a.course.name,
      courseCode: a.course.code,
      color: a.course.color,
      category: 'academic',
      dueDate: a.deadline,
      priority: asPriority(a.priority),
      remainingMinutes: Math.round(a.estimatedHours * 60 * (1 - a.progress / 100)),
      progress: a.progress / 100,
    });
  }
  for (const e of exams) {
    const topics = (e.topics ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const idx = Math.min(topics.length - 1, Math.floor((e.preparation / 100) * topics.length));
    items.push({
      id: e.id,
      kind: 'exam',
      title: e.name,
      courseId: e.courseId,
      courseName: e.course.name,
      courseCode: e.course.code,
      color: e.course.color,
      category: 'academic',
      dueDate: e.date,
      priority: 'medium',
      remainingMinutes: Math.round(EXAM_PREP_HOURS * 60 * (1 - e.preparation / 100)),
      progress: e.preparation / 100,
      focusTopic: topics.length ? topics[Math.max(0, idx)] : null,
    });
  }
  return items;
}

export interface DailyFocusItem {
  id: string;
  kind: WorkItem['kind'];
  title: string;
  courseName: string | null;
  courseCode: string | null;
  color: string | null;
  minutes: number;
  score: number;
  priority: string;
  priorityLabel: string;
  reason: string;
  dueDate: Date | null;
}

/** Greedy daily plan: highest score first, up to 90 min per item (60 for exam revision). */
export function planDay(ranked: ScoredItem[], availableMinutes: number): DailyFocusItem[] {
  const plan: DailyFocusItem[] = [];
  let left = availableMinutes;
  for (const item of ranked) {
    if (left < 15) break;
    const cap = item.kind === 'exam' ? 60 : 90;
    let minutes = Math.min(item.remainingMinutes, cap, left);
    if (minutes < 15 && item.remainingMinutes >= 15) continue;
    minutes = Math.max(5, Math.round(minutes / 5) * 5);
    plan.push({
      id: item.id,
      kind: item.kind,
      title: displayTitle(item),
      courseName: item.courseName,
      courseCode: item.courseCode,
      color: item.color,
      minutes,
      score: item.score,
      priority: item.priority,
      priorityLabel: priorityLabel(item.score),
      reason: item.reason,
      dueDate: item.dueDate,
    });
    left -= minutes;
  }
  return plan;
}

export interface WeekPlanInput {
  /** Minutes available on each day of the plan (index 0 = start day). */
  dailyMinutes: number[];
  preferredTime: keyof typeof PREFERRED_START | string;
  /** Restrict academic work to these courses. Non-course items are kept when includeNonAcademic. */
  courseIds?: string[];
  includeNonAcademic?: boolean;
  blockMinutes?: number;
  breakMinutes?: number;
  startDate?: Date;
}

export interface PlanBlock {
  start: Date;
  end: Date;
  minutes: number;
  itemId: string;
  kind: WorkItem['kind'];
  title: string;
  courseId: string | null;
  courseName: string | null;
  courseCode: string | null;
  color: string | null;
  reason: string;
  score: number;
}

export interface WeekPlan {
  days: { date: Date; availableMinutes: number; plannedMinutes: number; blocks: PlanBlock[] }[];
  totalMinutes: number;
  warnings: string[];
  considered: number;
}

/**
 * Builds a weekly schedule by simulating each day: items are re-scored relative to that day,
 * the top item that has not already been scheduled that day gets the next block, and work
 * whose deadline has passed is dropped. Remaining work at the end produces warnings.
 */
export function generateWeekPlan(items: WorkItem[], input: WeekPlanInput, now: Date = new Date()): WeekPlan {
  const block = input.blockMinutes ?? 60;
  const pause = input.breakMinutes ?? 15;
  const startDay = startOfDay(input.startDate ?? now);
  const startHHMM = PREFERRED_START[input.preferredTime] ?? input.preferredTime ?? '18:00';

  const filtered = items
    .filter((i) => {
      if (!i.courseId) return input.includeNonAcademic !== false;
      return !input.courseIds?.length || input.courseIds.includes(i.courseId);
    })
    .map((i) => ({ ...i }));
  const remaining = new Map(filtered.map((i) => [i.id, i.remainingMinutes]));

  const days: WeekPlan['days'] = [];
  for (let d = 0; d < input.dailyMinutes.length; d++) {
    const day = addDays(startDay, d);
    let cursor = setTime(day, startHHMM);
    if (cursor < now) {
      const next = Math.ceil(now.getTime() / (15 * MS_PER_MIN)) * 15 * MS_PER_MIN;
      cursor = new Date(next);
    }
    let left = input.dailyMinutes[d] ?? 0;
    const used = new Set<string>();
    const blocks: PlanBlock[] = [];

    while (left >= 15 && cursor.getDate() === day.getDate()) {
      const candidates = filtered
        .map((i) => ({ ...i, remainingMinutes: remaining.get(i.id) ?? 0 }))
        .filter((i) => i.remainingMinutes > 0 && (!i.dueDate || i.dueDate.getTime() - cursor.getTime() >= 15 * MS_PER_MIN));
      const ranked = rankItems(candidates, cursor);
      if (!ranked.length) break;
      const pick = ranked.find((r) => !used.has(r.id)) ?? ranked[0];
      const untilDue = pick.dueDate ? Math.floor((pick.dueDate.getTime() - cursor.getTime()) / MS_PER_MIN) : Infinity;
      const minutes = Math.min(block, pick.remainingMinutes, left, untilDue);
      if (minutes < 15 && pick.remainingMinutes >= 15) break;
      const start = cursor;
      const end = addMinutes(start, minutes);
      blocks.push({
        start,
        end,
        minutes,
        itemId: pick.id,
        kind: pick.kind,
        title: displayTitle(pick),
        courseId: pick.courseId,
        courseName: pick.courseName,
        courseCode: pick.courseCode,
        color: pick.color,
        reason: pick.reason,
        score: pick.score,
      });
      used.add(pick.id);
      remaining.set(pick.id, pick.remainingMinutes - minutes);
      left -= minutes;
      cursor = addMinutes(end, pause);
    }
    days.push({
      date: day,
      availableMinutes: input.dailyMinutes[d] ?? 0,
      plannedMinutes: blocks.reduce((s, b) => s + b.minutes, 0),
      blocks,
    });
  }

  const horizonEnd = addDays(startDay, input.dailyMinutes.length);
  const warnings: string[] = [];
  for (const item of filtered) {
    const left = remaining.get(item.id) ?? 0;
    if (left >= 15 && item.dueDate && item.dueDate <= horizonEnd) {
      warnings.push(
        `"${displayTitle(item)}" still needs about ${Math.round(left / 6) / 10}h before its deadline — consider adding study time.`,
      );
    }
  }

  return {
    days,
    totalMinutes: days.reduce((s, d) => s + d.plannedMinutes, 0),
    warnings,
    considered: filtered.length,
  };
}

export async function dailyFocus(userId: string, availableMinutes: number, now: Date = new Date()) {
  const items = await collectWorkItems(userId, now);
  return planDay(rankItems(items, now), availableMinutes);
}
