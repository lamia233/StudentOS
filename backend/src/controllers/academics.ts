import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/errors.js';
import { addDays } from '../utils/dates.js';
import { parseJson } from '../utils/json.js';
import { recordActivity } from '../services/activity.js';
import { assertOwned, param } from './helpers.js';

const withSchedule = <T extends { schedule: string }>(c: T) => ({ ...c, schedule: parseJson(c.schedule, []) });

// ---------- Courses ----------
export async function listCourses(req: Request, res: Response) {
  const courses = await prisma.course.findMany({
    where: { userId: req.userId },
    orderBy: { code: 'asc' },
    include: { assignments: { select: { id: true, status: true, progress: true, deadline: true } }, exams: { select: { id: true, date: true, preparation: true } }, _count: { select: { tasks: true, notesList: true } } },
  });
  res.json(courses.map(withSchedule));
}
export async function getCourse(req: Request, res: Response) {
  const c = await prisma.course.findFirst({ where: { id: param(req.params.id), userId: req.userId }, include: { assignments: true, exams: true, tasks: true } });
  if (!c) throw notFound('Course');
  res.json(withSchedule(c));
}
export async function createCourse(req: Request, res: Response) {
  const c = await prisma.course.create({ data: { ...req.body, schedule: JSON.stringify(req.body.schedule ?? []), userId: req.userId } });
  res.status(201).json(withSchedule(c));
}
export async function updateCourse(req: Request, res: Response) {
  await ownCourse(req);
  const data = { ...req.body, ...(req.body.schedule ? { schedule: JSON.stringify(req.body.schedule) } : {}) };
  res.json(withSchedule(await prisma.course.update({ where: { id: param(req.params.id) }, data })));
}
export async function deleteCourse(req: Request, res: Response) {
  await ownCourse(req);
  await prisma.course.delete({ where: { id: param(req.params.id) } });
  res.status(204).end();
}
async function ownCourse(req: Request) {
  const c = await prisma.course.findFirst({ where: { id: param(req.params.id), userId: req.userId } });
  if (!c) throw notFound('Course');
  return c;
}

// ---------- Tasks ----------
export async function listTasks(req: Request, res: Response) {
  const { status, priority, courseId, category, view, q } = req.query as Record<string, string | undefined>;
  const now = new Date();
  const where: Record<string, unknown> = { userId: req.userId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (courseId) where.courseId = courseId;
  if (category) where.category = category;
  if (view === 'today') Object.assign(where, { status: { not: 'done' }, dueDate: { lte: new Date(new Date(now).setHours(23, 59, 59, 999)) } });
  if (view === 'upcoming') Object.assign(where, { status: { not: 'done' }, dueDate: { gt: now, lte: addDays(now, 14) } });
  if (view === 'completed') where.status = 'done';
  let tasks = await prisma.task.findMany({
    where,
    include: { course: { select: { id: true, code: true, name: true, color: true } }, careerGoal: { select: { id: true, title: true } }, skill: { select: { id: true, name: true } } },
    orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  });
  if (q) {
    const s = q.toLowerCase();
    tasks = tasks.filter((t) => `${t.title} ${t.description ?? ''} ${t.tags}`.toLowerCase().includes(s));
  }
  res.json(tasks);
}
export async function createTask(req: Request, res: Response) {
  await assertOwned(req.userId, req.body);
  const done = req.body.status === 'done';
  const t = await prisma.task.create({ data: { ...req.body, userId: req.userId, completedAt: done ? new Date() : null } });
  if (done) await recordActivity(req.userId, new Date(), { tasksCompleted: 1 });
  res.status(201).json(t);
}
async function ownTask(req: Request) {
  const t = await prisma.task.findFirst({ where: { id: param(req.params.id), userId: req.userId } });
  if (!t) throw notFound('Task');
  return t;
}
/** Handles status transitions: completion timestamps, productivity rollups and spawning the next recurring instance. */
async function transitionTask(userId: string, before: Awaited<ReturnType<typeof ownTask>>, nextStatus: string | undefined) {
  if (!nextStatus || nextStatus === before.status) return {};
  const now = new Date();
  if (nextStatus === 'done') {
    await recordActivity(userId, now, { tasksCompleted: 1 });
    if (before.recurrence !== 'none') {
      const step = before.recurrence === 'daily' ? 1 : 7;
      const base = before.dueDate && before.dueDate > now ? before.dueDate : now;
      await prisma.task.create({
        data: {
          userId,
          title: before.title,
          description: before.description,
          priority: before.priority,
          category: before.category,
          estimatedMinutes: before.estimatedMinutes,
          tags: before.tags,
          recurrence: before.recurrence,
          courseId: before.courseId,
          careerGoalId: before.careerGoalId,
          skillId: before.skillId,
          dueDate: addDays(base, step),
        },
      });
    }
    return { completedAt: now };
  }
  if (before.status === 'done') {
    await recordActivity(userId, before.completedAt ?? now, { tasksCompleted: -1 });
    return { completedAt: null };
  }
  return {};
}
export async function updateTask(req: Request, res: Response) {
  const before = await ownTask(req);
  await assertOwned(req.userId, req.body);
  const extra = await transitionTask(req.userId, before, req.body.status);
  res.json(await prisma.task.update({ where: { id: before.id }, data: { ...req.body, ...extra } }));
}
export async function toggleTask(req: Request, res: Response) {
  const before = await ownTask(req);
  const status = before.status === 'done' ? 'todo' : 'done';
  const extra = await transitionTask(req.userId, before, status);
  res.json(await prisma.task.update({ where: { id: before.id }, data: { status, ...extra } }));
}
export async function deleteTask(req: Request, res: Response) {
  const t = await ownTask(req);
  await prisma.task.delete({ where: { id: t.id } });
  res.status(204).end();
}

// ---------- Assignments ----------
export async function listAssignments(req: Request, res: Response) {
  const { courseId, status } = req.query as Record<string, string | undefined>;
  res.json(
    await prisma.assignment.findMany({
      where: { userId: req.userId, ...(courseId ? { courseId } : {}), ...(status ? { status } : {}) },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: [{ status: 'asc' }, { deadline: 'asc' }],
    }),
  );
}
function normalizeAssignment(body: Record<string, unknown>, before?: { status: string; completedAt: Date | null }) {
  const data = { ...body };
  if (data.progress === 100 && data.status === undefined) data.status = 'completed';
  if (data.status === 'completed') {
    data.progress = 100;
    if (before?.status !== 'completed') data.completedAt = new Date();
  } else if (data.status && before?.status === 'completed') data.completedAt = null;
  if (data.status === 'not_started' && typeof data.progress === 'number' && data.progress > 0) data.status = 'in_progress';
  return data;
}
export async function createAssignment(req: Request, res: Response) {
  await assertOwned(req.userId, req.body);
  const data = normalizeAssignment(req.body);
  const a = await prisma.assignment.create({ data: { ...(data as typeof req.body), userId: req.userId } });
  if (a.status === 'completed') await recordActivity(req.userId, new Date(), { tasksCompleted: 1 });
  res.status(201).json(a);
}
export async function updateAssignment(req: Request, res: Response) {
  const before = await prisma.assignment.findFirst({ where: { id: param(req.params.id), userId: req.userId } });
  if (!before) throw notFound('Assignment');
  await assertOwned(req.userId, req.body);
  const data = normalizeAssignment(req.body, before);
  const after = await prisma.assignment.update({ where: { id: before.id }, data });
  if (after.status === 'completed' && before.status !== 'completed') await recordActivity(req.userId, new Date(), { tasksCompleted: 1 });
  if (before.status === 'completed' && after.status !== 'completed') await recordActivity(req.userId, before.completedAt ?? new Date(), { tasksCompleted: -1 });
  res.json(after);
}
export async function deleteAssignment(req: Request, res: Response) {
  const a = await prisma.assignment.findFirst({ where: { id: param(req.params.id), userId: req.userId } });
  if (!a) throw notFound('Assignment');
  await prisma.assignment.delete({ where: { id: a.id } });
  res.status(204).end();
}

// ---------- Exams ----------
export async function listExams(req: Request, res: Response) {
  res.json(
    await prisma.exam.findMany({
      where: { userId: req.userId },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: { date: 'asc' },
    }),
  );
}
export async function createExam(req: Request, res: Response) {
  await assertOwned(req.userId, req.body);
  res.status(201).json(await prisma.exam.create({ data: { ...req.body, userId: req.userId } }));
}
export async function updateExam(req: Request, res: Response) {
  const e = await prisma.exam.findFirst({ where: { id: param(req.params.id), userId: req.userId } });
  if (!e) throw notFound('Exam');
  await assertOwned(req.userId, req.body);
  res.json(await prisma.exam.update({ where: { id: e.id }, data: req.body }));
}
export async function deleteExam(req: Request, res: Response) {
  const e = await prisma.exam.findFirst({ where: { id: param(req.params.id), userId: req.userId } });
  if (!e) throw notFound('Exam');
  await prisma.exam.delete({ where: { id: e.id } });
  res.status(204).end();
}
