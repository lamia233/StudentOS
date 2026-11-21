import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { addDays, addMinutes, setTime, startOfDay } from '../utils/dates.js';
import { parseJson } from '../utils/json.js';
import type { ClassMeeting } from '../services/dashboard.js';
import { getDashboard, deadlineRadar } from '../services/dashboard.js';
import { productivityOverview } from '../services/analytics.js';
import { generateRecommendations } from '../services/recommendations.js';
import { refreshNotifications } from '../services/notifications.js';
import { collectWorkItems, generateWeekPlan, planDay } from '../services/planner.js';
import { displayTitle, rankItems, priorityLabel } from '../services/priority.js';
import { answerQuestion } from '../services/assistant.js';
import * as notion from '../services/notion.js';
import { param } from './helpers.js';

export async function dashboard(req: Request, res: Response) {
  res.json(await getDashboard(req.userId));
}
export async function radar(req: Request, res: Response) {
  res.json(await deadlineRadar(req.userId));
}
export async function productivity(req: Request, res: Response) {
  res.json(await productivityOverview(req.userId));
}
export async function recommendations(req: Request, res: Response) {
  res.json(await generateRecommendations(req.userId));
}

// ---------- Planner ----------
export async function priorities(req: Request, res: Response) {
  const now = new Date();
  const ranked = rankItems(await collectWorkItems(req.userId, now), now);
  res.json(ranked.map((r) => ({ ...r, displayTitle: displayTitle(r), priorityLabel: priorityLabel(r.score) })));
}
export async function today(req: Request, res: Response) {
  const minutes = Math.min(16 * 60, Math.max(15, Number(req.query.minutes ?? 120)));
  const now = new Date();
  res.json(planDay(rankItems(await collectWorkItems(req.userId, now), now), minutes));
}
export async function weekPlan(req: Request, res: Response) {
  const now = new Date();
  const items = await collectWorkItems(req.userId, now);
  const from = startOfDay(now);
  const to = addDays(from, req.body.dailyMinutes.length);
  const [events, courses, exams] = await Promise.all([
    prisma.event.findMany({ where: { userId: req.userId, allDay: false, source: { not: 'planner' }, start: { lt: to }, end: { gt: from } }, select: { start: true, end: true } }),
    prisma.course.findMany({ where: { userId: req.userId }, select: { schedule: true } }),
    prisma.exam.findMany({ where: { userId: req.userId, date: { gte: from, lt: to } }, select: { date: true } }),
  ]);
  const busy = [...events, ...exams.map((e) => ({ start: e.date, end: addMinutes(e.date, 120) }))];
  for (let d = from; d < to; d = addDays(d, 1)) {
    for (const c of courses) {
      for (const m of parseJson<ClassMeeting[]>(c.schedule, []).filter((m) => m.day === d.getDay())) busy.push({ start: setTime(d, m.start), end: setTime(d, m.end) });
    }
  }
  res.json(generateWeekPlan(items, { ...req.body, busy }, now));
}
/** Saves generated blocks as "study" calendar events, replacing earlier planner events in the same range. */
export async function savePlan(req: Request, res: Response) {
  const blocks = req.body.blocks as { title: string; start: Date; end: Date; courseId?: string | null }[];
  if (!blocks.length) return res.json({ saved: 0 });
  const from = startOfDay(new Date(Math.min(...blocks.map((b) => b.start.getTime()))));
  const to = addDays(startOfDay(new Date(Math.max(...blocks.map((b) => b.end.getTime())))), 1);
  const courseIds = new Set((await prisma.course.findMany({ where: { userId: req.userId }, select: { id: true } })).map((c) => c.id));
  await prisma.$transaction([
    ...(req.body.replaceExisting ? [prisma.event.deleteMany({ where: { userId: req.userId, source: 'planner', start: { gte: from, lt: to } } })] : []),
    prisma.event.createMany({
      data: blocks.map((b) => ({ userId: req.userId, title: b.title, start: b.start, end: b.end, type: 'study', source: 'planner', courseId: b.courseId && courseIds.has(b.courseId) ? b.courseId : null })),
    }),
  ]);
  res.status(201).json({ saved: blocks.length });
}

// ---------- Notifications ----------
export async function listNotifications(req: Request, res: Response) {
  await refreshNotifications(req.userId);
  const items = await prisma.notification.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' }, take: 40 });
  res.json({ items, unread: items.filter((n) => !n.read).length });
}
export async function markNotificationRead(req: Request, res: Response) {
  await prisma.notification.updateMany({ where: { id: param(req.params.id), userId: req.userId }, data: { read: true } });
  res.status(204).end();
}
export async function markAllNotificationsRead(req: Request, res: Response) {
  await prisma.notification.updateMany({ where: { userId: req.userId, read: false }, data: { read: true } });
  res.status(204).end();
}

// ---------- Assistant ----------
export async function assistant(req: Request, res: Response) {
  res.json(await answerQuestion(req.userId, req.body.message));
}

// ---------- Notion ----------
export async function notionStatus(req: Request, res: Response) {
  res.json(await notion.getStatus(req.userId));
}
export async function notionConnect(req: Request, res: Response) {
  res.json(await notion.connect(req.userId, req.body));
}
export async function notionDisconnect(req: Request, res: Response) {
  res.json(await notion.disconnect(req.userId));
}
export async function notionSync(req: Request, res: Response) {
  res.json(await notion.exportToNotion(req.userId, req.body.types));
}
export async function notionImport(req: Request, res: Response) {
  res.json(await notion.importFromNotion(req.userId, req.body.kind));
}
