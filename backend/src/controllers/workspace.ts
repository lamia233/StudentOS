import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { notFound, badRequest } from '../utils/errors.js';
import { addDays, addMinutes, setTime, startOfDay } from '../utils/dates.js';
import { parseJson, splitTags } from '../utils/json.js';
import { recordActivity } from '../services/activity.js';
import { goalProgress, skillProgress } from '../services/analytics.js';
import { EXAM_PREP_HOURS } from '../services/priority.js';
import type { ClassMeeting } from '../services/dashboard.js';
import { assertOwned, param } from './helpers.js';

// ---------- Events & calendar ----------
export async function listEvents(req: Request, res: Response) {
  const { from, to } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = { userId: req.userId };
  if (from || to) where.start = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  res.json(await prisma.event.findMany({ where, orderBy: { start: 'asc' }, include: { course: { select: { code: true, color: true } } } }));
}

/** Aggregated calendar feed: stored events + weekly classes + assignment deadlines + exams. */
export async function calendarFeed(req: Request, res: Response) {
  const from = req.query.from ? new Date(String(req.query.from)) : startOfDay(addDays(new Date(), -7));
  const to = req.query.to ? new Date(String(req.query.to)) : addDays(from, 42);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw badRequest('Invalid date range');
  if (to.getTime() - from.getTime() > 1000 * 60 * 60 * 24 * 100) throw badRequest('Range too large (max 100 days)');
  const userId = req.userId;
  const [events, courses, assignments, exams] = await Promise.all([
    prisma.event.findMany({ where: { userId, start: { lte: to }, end: { gte: from } }, include: { course: true } }),
    prisma.course.findMany({ where: { userId } }),
    prisma.assignment.findMany({ where: { userId, deadline: { gte: from, lte: to } }, include: { course: true } }),
    prisma.exam.findMany({ where: { userId, date: { gte: from, lte: to } }, include: { course: true } }),
  ]);
  const items: Record<string, unknown>[] = events.map((e) => ({ id: e.id, title: e.title, type: e.type, start: e.start, end: e.end, allDay: e.allDay, location: e.location, description: e.description, courseId: e.courseId, color: e.course?.color ?? null, editable: true, source: e.source }));
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) {
    for (const c of courses) {
      for (const m of parseJson<ClassMeeting[]>(c.schedule, []).filter((m) => m.day === d.getDay())) {
        items.push({ id: `class-${c.id}-${d.toISOString().slice(0, 10)}-${m.start}`, title: `${c.code} ${c.name}`, type: 'class', start: setTime(d, m.start), end: setTime(d, m.end), location: m.room ?? null, courseId: c.id, color: c.color, editable: false, source: 'course' });
      }
    }
  }
  for (const a of assignments) items.push({ id: `assignment-${a.id}`, refId: a.id, title: `Due: ${a.title}`, type: 'assignment', start: addMinutes(a.deadline, -30), end: a.deadline, courseId: a.courseId, color: a.course.color, editable: false, source: 'assignment', status: a.status });
  for (const e of exams) items.push({ id: `exam-${e.id}`, refId: e.id, title: e.name, type: 'exam', start: e.date, end: addMinutes(e.date, 120), location: e.location, courseId: e.courseId, color: e.course.color, editable: false, source: 'exam', preparation: e.preparation });
  items.sort((a, b) => (a.start as Date).getTime() - (b.start as Date).getTime());
  res.json(items);
}

async function ownEvent(req: Request) {
  const e = await prisma.event.findFirst({ where: { id: param(req.params.id), userId: req.userId } });
  if (!e) throw notFound('Event');
  return e;
}
export async function createEvent(req: Request, res: Response) {
  await assertOwned(req.userId, req.body);
  res.status(201).json(await prisma.event.create({ data: { ...req.body, userId: req.userId } }));
}
export async function updateEvent(req: Request, res: Response) {
  const e = await ownEvent(req);
  await assertOwned(req.userId, req.body);
  res.json(await prisma.event.update({ where: { id: e.id }, data: req.body }));
}
export async function deleteEvent(req: Request, res: Response) {
  const e = await ownEvent(req);
  await prisma.event.delete({ where: { id: e.id } });
  res.status(204).end();
}

// ---------- Notes / Knowledge Hub ----------
export async function listNotes(req: Request, res: Response) {
  const { courseId, type, tag, semester, topic } = req.query as Record<string, string | undefined>;
  let notes = await prisma.note.findMany({
    where: { userId: req.userId, ...(courseId ? { courseId } : {}), ...(type ? { type } : {}), ...(semester ? { semester } : {}), ...(topic ? { topic } : {}) },
    include: { course: { select: { id: true, code: true, name: true, color: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  if (tag) notes = notes.filter((n) => splitTags(n.tags).includes(tag));
  res.json(notes);
}

/** Full-text search across notes, plus related tasks, assignments and exams. */
export async function searchKnowledge(req: Request, res: Response) {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  if (!q) return res.json({ notes: [], tasks: [], assignments: [], exams: [] });
  const terms = q.split(/\s+/).filter(Boolean);
  const matches = (text: string) => {
    const t = text.toLowerCase();
    return terms.every((term) => t.includes(term)) || t.includes(q);
  };
  const score = (text: string) => terms.reduce((s, term) => s + (text.toLowerCase().split(term).length - 1), 0);
  const userId = req.userId;
  const [notes, tasks, assignments, exams] = await Promise.all([
    prisma.note.findMany({ where: { userId }, include: { course: { select: { id: true, code: true, name: true, color: true } } } }),
    prisma.task.findMany({ where: { userId }, include: { course: { select: { code: true, color: true } } } }),
    prisma.assignment.findMany({ where: { userId }, include: { course: { select: { code: true, color: true } } } }),
    prisma.exam.findMany({ where: { userId }, include: { course: { select: { code: true, color: true } } } }),
  ]);
  const noteText = (n: (typeof notes)[number]) => `${n.title} ${n.title} ${n.content} ${n.tags} ${n.topic ?? ''} ${n.course?.name ?? ''} ${n.course?.code ?? ''}`;
  res.json({
    notes: notes.filter((n) => matches(noteText(n))).sort((a, b) => score(noteText(b)) - score(noteText(a))),
    tasks: tasks.filter((t) => matches(`${t.title} ${t.description ?? ''} ${t.tags}`)).slice(0, 10),
    assignments: assignments.filter((a) => matches(`${a.title} ${a.description ?? ''}`)).slice(0, 10),
    exams: exams.filter((e) => matches(`${e.name} ${e.topics ?? ''}`)).slice(0, 10),
  });
}
async function ownNote(req: Request) {
  const n = await prisma.note.findFirst({ where: { id: param(req.params.id), userId: req.userId } });
  if (!n) throw notFound('Note');
  return n;
}
export async function createNote(req: Request, res: Response) {
  await assertOwned(req.userId, req.body);
  res.status(201).json(await prisma.note.create({ data: { ...req.body, userId: req.userId } }));
}
export async function updateNote(req: Request, res: Response) {
  const n = await ownNote(req);
  await assertOwned(req.userId, req.body);
  res.json(await prisma.note.update({ where: { id: n.id }, data: req.body }));
}
export async function deleteNote(req: Request, res: Response) {
  const n = await ownNote(req);
  await prisma.note.delete({ where: { id: n.id } });
  res.status(204).end();
}

// ---------- Career goals ----------
const goalInclude = {
  milestones: { orderBy: { order: 'asc' as const } },
  tasks: { select: { id: true, title: true, status: true, dueDate: true, priority: true } },
};
const withProgress = <T extends { milestones: { done: boolean }[] }>(g: T) => ({ ...g, progress: goalProgress(g.milestones) });

export async function listGoals(req: Request, res: Response) {
  const goals = await prisma.careerGoal.findMany({ where: { userId: req.userId }, include: goalInclude, orderBy: { createdAt: 'asc' } });
  res.json(goals.map(withProgress));
}
async function ownGoal(req: Request, idParam = 'id') {
  const g = await prisma.careerGoal.findFirst({ where: { id: param(req.params[idParam]), userId: req.userId } });
  if (!g) throw notFound('Career goal');
  return g;
}
export async function createGoal(req: Request, res: Response) {
  const { milestones, ...data } = req.body;
  const g = await prisma.careerGoal.create({
    data: { ...data, userId: req.userId, milestones: milestones?.length ? { create: milestones.map((m: { title: string; done: boolean }, order: number) => ({ ...m, order, completedAt: m.done ? new Date() : null })) } : undefined },
    include: goalInclude,
  });
  res.status(201).json(withProgress(g));
}
export async function updateGoal(req: Request, res: Response) {
  const g = await ownGoal(req);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { milestones, ...data } = req.body;
  res.json(withProgress(await prisma.careerGoal.update({ where: { id: g.id }, data, include: goalInclude })));
}
export async function deleteGoal(req: Request, res: Response) {
  const g = await ownGoal(req);
  await prisma.careerGoal.delete({ where: { id: g.id } });
  res.status(204).end();
}
export async function addMilestone(req: Request, res: Response) {
  const g = await ownGoal(req);
  const count = await prisma.careerMilestone.count({ where: { goalId: g.id } });
  await prisma.careerMilestone.create({ data: { goalId: g.id, title: req.body.title, done: req.body.done, order: count, completedAt: req.body.done ? new Date() : null } });
  res.status(201).json(withProgress(await prisma.careerGoal.findUniqueOrThrow({ where: { id: g.id }, include: goalInclude })));
}
export async function updateMilestone(req: Request, res: Response) {
  const g = await ownGoal(req);
  const m = await prisma.careerMilestone.findFirst({ where: { id: param(req.params.milestoneId), goalId: g.id } });
  if (!m) throw notFound('Milestone');
  const data: Record<string, unknown> = {};
  if (typeof req.body.title === 'string') data.title = req.body.title;
  if (typeof req.body.done === 'boolean') {
    data.done = req.body.done;
    data.completedAt = req.body.done ? new Date() : null;
  }
  await prisma.careerMilestone.update({ where: { id: m.id }, data });
  res.json(withProgress(await prisma.careerGoal.findUniqueOrThrow({ where: { id: g.id }, include: goalInclude })));
}
export async function deleteMilestone(req: Request, res: Response) {
  const g = await ownGoal(req);
  await prisma.careerMilestone.deleteMany({ where: { id: param(req.params.milestoneId), goalId: g.id } });
  res.json(withProgress(await prisma.careerGoal.findUniqueOrThrow({ where: { id: g.id }, include: goalInclude })));
}

// ---------- Skills ----------
const skillOut = <T extends { resources: string; currentLevel: number; targetLevel: number }>(s: T) => ({ ...s, resources: parseJson(s.resources, []), progress: skillProgress(s) });
const skillInclude = { tasks: { select: { id: true, title: true, status: true, dueDate: true } } };

export async function listSkills(req: Request, res: Response) {
  const skills = await prisma.skill.findMany({ where: { userId: req.userId }, include: skillInclude, orderBy: { name: 'asc' } });
  res.json(skills.map(skillOut));
}
async function ownSkill(req: Request) {
  const s = await prisma.skill.findFirst({ where: { id: param(req.params.id), userId: req.userId } });
  if (!s) throw notFound('Skill');
  return s;
}
export async function createSkill(req: Request, res: Response) {
  const s = await prisma.skill.create({ data: { ...req.body, resources: JSON.stringify(req.body.resources ?? []), userId: req.userId }, include: skillInclude });
  res.status(201).json(skillOut(s));
}
export async function updateSkill(req: Request, res: Response) {
  const s = await ownSkill(req);
  const data = { ...req.body, ...(req.body.resources ? { resources: JSON.stringify(req.body.resources) } : {}) };
  res.json(skillOut(await prisma.skill.update({ where: { id: s.id }, data, include: skillInclude })));
}
export async function deleteSkill(req: Request, res: Response) {
  const s = await ownSkill(req);
  await prisma.skill.delete({ where: { id: s.id } });
  res.status(204).end();
}

// ---------- Study sessions (Focus Mode) ----------
export async function listStudySessions(req: Request, res: Response) {
  const days = Math.min(90, Number(req.query.days ?? 14));
  res.json(
    await prisma.studySession.findMany({
      where: { userId: req.userId, start: { gte: addDays(new Date(), -days) } },
      include: { course: { select: { code: true, name: true, color: true } } },
      orderBy: { start: 'desc' },
    }),
  );
}

/** Logs a finished focus session; credits study time and nudges linked assignment/exam progress. */
export async function createStudySession(req: Request, res: Response) {
  const userId = req.userId;
  const b = req.body;
  await assertOwned(userId, b);
  let courseId = b.courseId ?? null;
  const updates: Record<string, unknown> = {};
  if (b.assignmentId) {
    const a = await prisma.assignment.findUniqueOrThrow({ where: { id: b.assignmentId } });
    courseId ??= a.courseId;
    const progress = Math.min(95, Math.max(a.progress, Math.round(a.progress + (b.durationMinutes / (a.estimatedHours * 60)) * 100)));
    updates.assignment = await prisma.assignment.update({ where: { id: a.id }, data: { progress, status: a.status === 'not_started' ? 'in_progress' : a.status } });
  }
  if (b.examId) {
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: b.examId } });
    courseId ??= e.courseId;
    const preparation = Math.min(100, Math.round(e.preparation + (b.durationMinutes / (EXAM_PREP_HOURS * 60)) * 100));
    updates.exam = await prisma.exam.update({ where: { id: e.id }, data: { preparation } });
  }
  if (b.taskId) {
    const t = await prisma.task.findUniqueOrThrow({ where: { id: b.taskId } });
    courseId ??= t.courseId;
    if (t.status === 'todo') updates.task = await prisma.task.update({ where: { id: t.id }, data: { status: 'in_progress' } });
  }
  const start = b.start ?? addMinutes(new Date(), -b.durationMinutes);
  const session = await prisma.studySession.create({
    data: { userId, title: b.title, durationMinutes: b.durationMinutes, type: b.type, start, courseId, taskId: b.taskId ?? null, assignmentId: b.assignmentId ?? null, examId: b.examId ?? null },
  });
  await recordActivity(userId, start, { studyMinutes: b.durationMinutes, focusSessions: 1 });
  res.status(201).json({ session, ...updates });
}
