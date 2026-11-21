import { prisma } from '../lib/prisma.js';
import { dayKey } from '../utils/dates.js';

/** Increments (or decrements) the daily ProductivityRecord rollup for a user. */
export async function recordActivity(
  userId: string,
  at: Date,
  delta: { tasksCompleted?: number; studyMinutes?: number; focusSessions?: number },
) {
  const date = dayKey(at);
  const existing = await prisma.productivityRecord.findUnique({ where: { userId_date: { userId, date } } });
  const next = {
    tasksCompleted: Math.max(0, (existing?.tasksCompleted ?? 0) + (delta.tasksCompleted ?? 0)),
    studyMinutes: Math.max(0, (existing?.studyMinutes ?? 0) + (delta.studyMinutes ?? 0)),
    focusSessions: Math.max(0, (existing?.focusSessions ?? 0) + (delta.focusSessions ?? 0)),
  };
  return prisma.productivityRecord.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...next },
    update: next,
  });
}
