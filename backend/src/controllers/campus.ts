import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/errors.js';
import { addMinutes } from '../utils/dates.js';
import { param } from './helpers.js';

export async function listOrganizations(_req: Request, res: Response) {
  res.json(await prisma.organization.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { events: true } } } }));
}

export async function createOrganization(req: Request, res: Response) {
  res.status(201).json(await prisma.organization.create({ data: req.body }));
}

export async function listOrgEvents(req: Request, res: Response) {
  const { category, organizationId, mine, includePast } = req.query as Record<string, string | undefined>;
  const events = await prisma.organizationEvent.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(includePast === 'true' ? {} : { date: { gte: new Date() } }),
      ...(mine === 'true' ? { interests: { some: { userId: req.userId } } } : {}),
    },
    include: { organization: true, interests: { select: { userId: true, status: true, calendarEventId: true } } },
    orderBy: { date: 'asc' },
  });
  res.json(
    events.map(({ interests, ...e }) => {
      const my = interests.find((i) => i.userId === req.userId);
      return { ...e, myStatus: my?.status ?? null, onCalendar: !!my?.calendarEventId, interestedCount: interests.length, canEdit: e.createdById === req.userId };
    }),
  );
}

export async function createOrgEvent(req: Request, res: Response) {
  const org = await prisma.organization.findUnique({ where: { id: param(req.params.id) } });
  if (!org) throw notFound('Organization');
  res.status(201).json(await prisma.organizationEvent.create({ data: { ...req.body, organizationId: org.id, createdById: req.userId } }));
}

export async function deleteOrgEvent(req: Request, res: Response) {
  const e = await prisma.organizationEvent.findFirst({ where: { id: param(req.params.eventId), createdById: req.userId } });
  if (!e) throw notFound('Event');
  await prisma.organizationEvent.delete({ where: { id: e.id } });
  res.status(204).end();
}

export async function setInterest(req: Request, res: Response) {
  const event = await prisma.organizationEvent.findUnique({ where: { id: param(req.params.eventId) } });
  if (!event) throw notFound('Event');
  const interest = await prisma.orgEventInterest.upsert({
    where: { userId_eventId: { userId: req.userId, eventId: event.id } },
    create: { userId: req.userId, eventId: event.id, status: req.body.status },
    update: { status: req.body.status },
  });
  res.json(interest);
}

export async function removeInterest(req: Request, res: Response) {
  const interest = await prisma.orgEventInterest.findUnique({ where: { userId_eventId: { userId: req.userId, eventId: param(req.params.eventId) } } });
  if (interest?.calendarEventId) await prisma.event.deleteMany({ where: { id: interest.calendarEventId, userId: req.userId } });
  await prisma.orgEventInterest.deleteMany({ where: { userId: req.userId, eventId: param(req.params.eventId) } });
  res.status(204).end();
}

export async function addOrgEventToCalendar(req: Request, res: Response) {
  const event = await prisma.organizationEvent.findUnique({ where: { id: param(req.params.eventId) }, include: { organization: true } });
  if (!event) throw notFound('Event');
  const existing = await prisma.orgEventInterest.findUnique({ where: { userId_eventId: { userId: req.userId, eventId: event.id } } });
  if (existing?.calendarEventId && (await prisma.event.findFirst({ where: { id: existing.calendarEventId, userId: req.userId } }))) {
    return res.json({ calendarEventId: existing.calendarEventId, alreadyAdded: true });
  }
  const type = event.category === 'career' || event.category === 'hackathon' || event.category === 'competition' ? 'career' : 'personal';
  const cal = await prisma.event.create({
    data: { userId: req.userId, title: event.title, description: `${event.organization.name}\n${event.description ?? ''}`.trim(), start: event.date, end: addMinutes(event.date, 120), location: event.location, type, source: 'campus' },
  });
  await prisma.orgEventInterest.upsert({
    where: { userId_eventId: { userId: req.userId, eventId: event.id } },
    create: { userId: req.userId, eventId: event.id, status: 'interested', calendarEventId: cal.id },
    update: { calendarEventId: cal.id },
  });
  res.status(201).json({ calendarEventId: cal.id, alreadyAdded: false });
}
