import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { HttpError, badRequest } from '../utils/errors.js';
import { clearAuthCookie, setAuthCookie, signToken } from '../middleware/auth.js';
import { getFreshDemoUser, seedDemoData } from '../services/demo.js';
import { addDays, startOfDay } from '../utils/dates.js';

const COURSE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];

type UserRow = Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>;

export function publicUser(u: UserRow) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = u;
  return rest;
}

function issue(res: Response, user: UserRow, status = 200) {
  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.status(status).json({ user: publicUser(user), token });
}

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body;
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'An account with this email already exists');
  const user = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12) } });
  issue(res, user, 201);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Invalid email or password');
  issue(res, user);
}

export async function demo(_req: Request, res: Response) {
  issue(res, await getFreshDemoUser());
}

export function logout(_req: Request, res: Response) {
  clearAuthCookie(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json({ user: publicUser(user) });
}

export async function updateMe(req: Request, res: Response) {
  const user = await prisma.user.update({ where: { id: req.userId }, data: req.body });
  res.json({ user: publicUser(user) });
}

export async function changePassword(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  if (user.isDemo) throw badRequest('The demo account password cannot be changed');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(req.body.newPassword, 12) } });
  res.status(204).end();
}

export async function resetDemo(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  if (!user.isDemo) throw badRequest('Only the demo account can be reset');
  await seedDemoData(user.id, new Date());
  res.json({ user: publicUser(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })) });
}

/** Saves onboarding answers and builds a starter workspace from them. */
export async function onboard(req: Request, res: Response) {
  const b = req.body;
  const now = new Date();
  const userId = req.userId;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: b.name,
        university: b.university,
        degree: b.degree,
        semester: b.semester,
        studyHoursPerWeek: b.studyHoursPerWeek,
        careerGoal: b.careerGoal || null,
        preferredStudyTime: b.preferredStudyTime,
        semesterStart: startOfDay(now),
        semesterEnd: startOfDay(addDays(now, 7 * 14)),
        onboarded: true,
      },
    });
    for (const [i, c] of (b.courses as { name: string; code: string; credits?: number; color?: string }[]).entries()) {
      await tx.course.create({ data: { userId, name: c.name, code: c.code, credits: c.credits ?? 3, color: c.color ?? COURSE_COLORS[i % COURSE_COLORS.length], semester: b.semester } });
    }
    if (b.careerGoal) {
      await tx.careerGoal.create({
        data: {
          userId,
          title: b.careerGoal,
          category: /intern/i.test(b.careerGoal) ? 'internship' : 'career',
          deadline: addDays(now, 90),
          milestones: { create: ['Define what success looks like', 'Update CV and LinkedIn', 'Build one portfolio project', 'Apply / take the first concrete step'].map((title, order) => ({ title, order })) },
        },
      });
    }
    await tx.task.create({ data: { userId, title: 'Add your first assignment or exam', category: 'academic', priority: 'medium', dueDate: addDays(now, 1), estimatedMinutes: 10, tags: 'getting-started' } });
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  res.json({ user: publicUser(user) });
}
