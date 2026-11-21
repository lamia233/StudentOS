import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { decrypt, encrypt } from '../utils/crypto.js';
import { addDays, startOfDay } from '../utils/dates.js';
import { badRequest } from '../utils/errors.js';
import { NotionClient, type NotionObject, blocksToText, normalizeNotionId, plain, richText, titleOf } from './notionClient.js';

export const EXPORT_TYPES = ['tasks', 'assignments', 'studyPlans', 'notes', 'goals'] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];
export const IMPORT_TYPES = ['tasks', 'notes'] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

const DEMO_WORKSPACE = 'Demo Notion Workspace (simulated)';

/** The server-wide token is usable only by the account named in NOTION_OWNER_EMAIL. */
async function envToken(userId: string): Promise<string | undefined> {
  const { token, ownerEmail } = config.notion;
  if (!token || !ownerEmail) return undefined;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email.toLowerCase() === ownerEmail ? token : undefined;
}

export async function getStatus(userId: string) {
  const [conn, logs] = await Promise.all([
    prisma.notionConnection.findUnique({ where: { userId } }),
    prisma.notionSyncLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 15 }),
  ]);
  const [tasks, assignments, notes, goals] = await Promise.all([
    prisma.task.count({ where: { userId, notionPageId: { not: null } } }),
    prisma.assignment.count({ where: { userId, notionPageId: { not: null } } }),
    prisma.note.count({ where: { userId, OR: [{ notionPageId: { not: null } }, { source: { not: 'studentos' } }] } }),
    prisma.careerGoal.count({ where: { userId, notionPageId: { not: null } } }),
  ]);
  return {
    connected: conn?.status === 'connected',
    mode: conn?.mode ?? null,
    status: conn?.status ?? 'disconnected',
    targetId: conn?.targetId ?? null,
    targetType: conn?.targetType ?? null,
    targetTitle: conn?.targetTitle ?? null,
    workspaceName: conn?.workspaceName ?? null,
    lastSyncedAt: conn?.lastSyncedAt ?? null,
    lastError: conn?.lastError ?? null,
    tokenSource: conn?.encryptedToken ? 'user' : conn?.mode === 'live' ? 'env' : null,
    liveAvailable: !!(await envToken(userId)),
    defaultTargetConfigured: !!config.notion.targetId,
    linked: { tasks, assignments, notes, goals },
    logs,
  };
}

async function liveClient(userId: string) {
  const conn = await prisma.notionConnection.findUnique({ where: { userId } });
  if (!conn || conn.status !== 'connected') throw badRequest('Notion is not connected');
  if (conn.mode !== 'live') return { conn, client: null };
  const token = conn.encryptedToken ? decrypt(conn.encryptedToken) : await envToken(userId);
  if (!token) throw badRequest('No Notion token available. Reconnect Notion.');
  return { conn, client: new NotionClient(token) };
}

export async function connect(userId: string, input: { mode: 'demo' | 'live'; token?: string; targetId?: string }) {
  if (input.mode === 'demo') {
    await prisma.notionConnection.upsert({
      where: { userId },
      create: { userId, mode: 'demo', status: 'connected', workspaceName: DEMO_WORKSPACE, targetTitle: 'StudentOS Hub (demo)', targetType: 'database' },
      update: { mode: 'demo', status: 'connected', encryptedToken: null, targetId: null, workspaceName: DEMO_WORKSPACE, targetTitle: 'StudentOS Hub (demo)', targetType: 'database', lastError: null },
    });
    return getStatus(userId);
  }

  const token = input.token?.trim() || (await envToken(userId));
  if (!token) throw badRequest('A Notion integration token is required (or set NOTION_TOKEN on the server).');
  const rawTarget = input.targetId?.trim() || config.notion.targetId;
  if (!rawTarget) throw badRequest('A Notion database or page ID is required.');
  const targetId = normalizeNotionId(rawTarget);
  if (!targetId) throw badRequest('That does not look like a valid Notion database/page ID or URL.');

  const client = new NotionClient(token);
  let target: NotionObject;
  let targetType: 'database' | 'page';
  try {
    target = await client.getDatabase(targetId);
    targetType = 'database';
  } catch {
    target = await client.getPage(targetId);
    targetType = 'page';
  }
  let workspaceName: string | null = null;
  try {
    const me = await client.me();
    workspaceName = me?.bot?.workspace_name ?? me?.name ?? null;
  } catch {
    /* optional */
  }

  const data = {
    mode: 'live',
    status: 'connected',
    encryptedToken: input.token?.trim() ? encrypt(input.token.trim()) : null,
    targetId,
    targetType,
    targetTitle: titleOf(target),
    workspaceName: workspaceName ?? 'Notion workspace',
    lastError: null,
  };
  await prisma.notionConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return getStatus(userId);
}

export async function disconnect(userId: string) {
  await prisma.notionConnection.deleteMany({ where: { userId } });
  return getStatus(userId);
}

export interface ExportRecord {
  type: ExportType;
  id: string;
  title: string;
  kindLabel: string;
  status?: string;
  date?: Date | null;
  course?: string | null;
  body: string;
  notionPageId?: string | null;
  todos?: string[];
}

async function gatherExport(userId: string, types: ExportType[]): Promise<ExportRecord[]> {
  const out: ExportRecord[] = [];
  if (types.includes('tasks')) {
    const tasks = await prisma.task.findMany({ where: { userId }, include: { course: true }, take: 50, orderBy: { updatedAt: 'desc' } });
    out.push(...tasks.map((t) => ({ type: 'tasks' as const, id: t.id, title: t.title, kindLabel: 'Task', status: t.status === 'done' ? 'Done' : t.status === 'in_progress' ? 'In progress' : 'Not started', date: t.dueDate, course: t.course?.code ?? null, body: t.description ?? '', notionPageId: t.notionPageId })));
  }
  if (types.includes('assignments')) {
    const as = await prisma.assignment.findMany({ where: { userId }, include: { course: true }, take: 50 });
    out.push(...as.map((a) => ({ type: 'assignments' as const, id: a.id, title: a.title, kindLabel: 'Assignment', status: a.status === 'completed' ? 'Done' : a.status === 'in_progress' ? 'In progress' : 'Not started', date: a.deadline, course: a.course.code, body: `${a.description ?? ''}\nProgress: ${a.progress}% · Estimated ${a.estimatedHours}h · ${a.priority} priority`, notionPageId: a.notionPageId })));
  }
  if (types.includes('notes')) {
    const notes = await prisma.note.findMany({ where: { userId, source: 'studentos' }, include: { course: true }, take: 50 });
    out.push(...notes.map((n) => ({ type: 'notes' as const, id: n.id, title: n.title, kindLabel: 'Note', course: n.course?.code ?? null, body: n.content + (n.url ? `\n${n.url}` : ''), notionPageId: n.notionPageId })));
  }
  if (types.includes('goals')) {
    const goals = await prisma.careerGoal.findMany({ where: { userId }, include: { milestones: { orderBy: { order: 'asc' } } } });
    out.push(...goals.map((g) => ({ type: 'goals' as const, id: g.id, title: g.title, kindLabel: 'Goal', date: g.deadline, body: g.description ?? '', todos: g.milestones.map((m) => `${m.done ? '[x]' : '[ ]'} ${m.title}`), notionPageId: g.notionPageId })));
  }
  if (types.includes('studyPlans')) {
    const now = new Date();
    const events = await prisma.event.findMany({ where: { userId, type: 'study', start: { gte: startOfDay(now), lte: addDays(now, 7) } }, orderBy: { start: 'asc' } });
    if (events.length) {
      out.push({
        type: 'studyPlans',
        id: `plan-${startOfDay(now).toISOString().slice(0, 10)}`,
        title: `Study Plan — week of ${startOfDay(now).toDateString()}`,
        kindLabel: 'Study Plan',
        date: startOfDay(now),
        body: `${events.length} planned study blocks generated by the StudentOS planner.`,
        todos: events.map((e) => `[ ] ${e.start.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · ${e.title}`),
      });
    }
  }
  return out;
}

function buildProperties(schema: NotionObject, rec: ExportRecord): NotionObject {
  const props: NotionObject = {};
  const entries = Object.entries<NotionObject>(schema.properties ?? {});
  const titleKey = entries.find(([, p]) => p.type === 'title')?.[0] ?? 'Name';
  props[titleKey] = { title: richText(rec.title) };
  const find = (names: string[], types: string[]) =>
    entries.find(([k, p]) => names.includes(k.toLowerCase()) && types.includes(p.type));
  const typeProp = find(['type', 'kind', 'category'], ['select', 'rich_text']);
  if (typeProp) props[typeProp[0]] = typeProp[1].type === 'select' ? { select: { name: rec.kindLabel } } : { rich_text: richText(rec.kindLabel) };
  const dateProp = find(['due', 'due date', 'date', 'deadline'], ['date']);
  if (dateProp && rec.date) props[dateProp[0]] = { date: { start: rec.date.toISOString() } };
  const statusProp = find(['status'], ['select', 'status', 'rich_text']);
  if (statusProp && rec.status) {
    const t = statusProp[1].type;
    props[statusProp[0]] = t === 'rich_text' ? { rich_text: richText(rec.status) } : { [t]: { name: rec.status } };
  }
  const courseProp = find(['course', 'subject'], ['select', 'rich_text']);
  if (courseProp && rec.course) props[courseProp[0]] = courseProp[1].type === 'select' ? { select: { name: rec.course } } : { rich_text: richText(rec.course) };
  return props;
}

export function buildChildren(rec: ExportRecord): NotionObject[] {
  const blocks: NotionObject[] = [];
  const todos = (rec.todos ?? []).slice(0, 50);
  // Notion accepts at most 100 child blocks per request (incl. the footer); fold any overflow into the last paragraph.
  const paras = rec.body.split('\n').filter(Boolean);
  const maxParas = 99 - todos.length;
  if (paras.length > maxParas) paras.splice(maxParas - 1, paras.length, paras.slice(maxParas - 1).join('\n'));
  for (const para of paras) {
    blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: richText(para) } });
  }
  for (const todo of todos) {
    blocks.push({ object: 'block', type: 'to_do', to_do: { rich_text: richText(todo.slice(4)), checked: todo.startsWith('[x]') } });
  }
  blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: richText(`Synced from StudentOS · ${new Date().toISOString()}`) } });
  return blocks;
}

async function saveLink(rec: ExportRecord, pageId: string) {
  if (rec.type === 'tasks') await prisma.task.update({ where: { id: rec.id }, data: { notionPageId: pageId } });
  if (rec.type === 'assignments') await prisma.assignment.update({ where: { id: rec.id }, data: { notionPageId: pageId } });
  if (rec.type === 'notes') await prisma.note.update({ where: { id: rec.id }, data: { notionPageId: pageId } });
  if (rec.type === 'goals') await prisma.careerGoal.update({ where: { id: rec.id }, data: { notionPageId: pageId } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, config.isTest ? 0 : ms));

/** StudentOS → Notion. In demo mode nothing leaves StudentOS; the sync is simulated and logged as such. */
export async function exportToNotion(userId: string, types: ExportType[]) {
  const { conn, client } = await liveClient(userId);
  const records = await gatherExport(userId, types);
  const results: { type: ExportType; created: number; updated: number }[] = types.map((t) => ({ type: t, created: 0, updated: 0 }));
  const bump = (t: ExportType, k: 'created' | 'updated') => results.find((r) => r.type === t)![k]++;

  if (!client) {
    for (const rec of records) {
      if (rec.notionPageId) bump(rec.type, 'updated');
      else {
        bump(rec.type, 'created');
        if (rec.type !== 'studyPlans') await saveLink(rec, `demo-${crypto.randomUUID()}`);
      }
    }
  } else {
    const schema = conn.targetType === 'database' ? await client.getDatabase(conn.targetId!) : null;
    try {
      for (const rec of records) {
        const isLive = rec.notionPageId && !rec.notionPageId.startsWith('demo-');
        if (isLive && schema) {
          await client.updatePage(rec.notionPageId!, { properties: buildProperties(schema, rec) });
          bump(rec.type, 'updated');
        } else {
          const page = await client.createPage(
            schema
              ? { parent: { database_id: conn.targetId }, properties: buildProperties(schema, rec), children: buildChildren(rec) }
              : { parent: { page_id: conn.targetId }, properties: { title: { title: richText(`[${rec.kindLabel}] ${rec.title}`) } }, children: buildChildren(rec) },
          );
          if (rec.type !== 'studyPlans') await saveLink(rec, page.id);
          bump(rec.type, 'created');
        }
        await sleep(340);
      }
    } catch (err) {
      await prisma.notionConnection.update({ where: { userId }, data: { lastError: (err as Error).message } });
      await prisma.notionSyncLog.create({ data: { userId, mode: 'live', direction: 'export', itemType: types.join(','), count: 0, status: 'error', message: (err as Error).message } });
      throw err;
    }
  }

  const simulated = conn.mode === 'demo';
  for (const r of results) {
    await prisma.notionSyncLog.create({
      data: {
        userId,
        mode: conn.mode,
        direction: 'export',
        itemType: r.type,
        count: r.created + r.updated,
        message: simulated
          ? `Simulated: ${r.created} new, ${r.updated} updated (demo mode — no data sent to Notion)`
          : `${r.created} created, ${r.updated} updated in "${conn.targetTitle}"`,
      },
    });
  }
  await prisma.notionConnection.update({ where: { userId }, data: { lastSyncedAt: new Date(), lastError: null } });
  return { mode: conn.mode, simulated, results, status: await getStatus(userId) };
}

const DEMO_IMPORT = {
  tasks: [
    { key: 'demo-import-task-1', title: 'Email supervisor about thesis progress', priority: 'high', days: 2, minutes: 15, category: 'academic' },
    { key: 'demo-import-task-2', title: 'Book library study room for group revision', priority: 'medium', days: 3, minutes: 10, category: 'personal' },
    { key: 'demo-import-task-3', title: 'Update LinkedIn headline and featured projects', priority: 'medium', days: 6, minutes: 30, category: 'career' },
  ],
  notes: [
    { key: 'demo-import-note-1', title: 'Thesis meeting notes — week 9', type: 'research', topic: 'Thesis', content: '## Feedback\n- Narrow the scope to federated learning on edge devices\n- Compare FedAvg vs FedProx on non-IID data\n## Next steps\n[ ] Run baseline experiments\n[ ] Draft related-work section' },
    { key: 'demo-import-note-2', title: 'Interview prep: system design checklist', type: 'project', topic: 'Career', content: '## Checklist\n- Clarify requirements & constraints\n- Estimate scale (QPS, storage)\n- High-level design → deep dive\n- Bottlenecks, caching, trade-offs' },
  ],
};

function propValue(page: NotionObject, names: string[], type: string) {
  const entries = Object.entries<NotionObject>(page.properties ?? {});
  return entries.find(([k, p]) => names.includes(k.toLowerCase()) && p.type === type)?.[1];
}

/** Notion → StudentOS. Demo mode imports a fixed set of clearly labelled sample pages. */
export async function importFromNotion(userId: string, kind: ImportType) {
  const { conn, client } = await liveClient(userId);
  let created = 0;
  let updated = 0;

  if (!client) {
    if (kind === 'tasks') {
      for (const t of DEMO_IMPORT.tasks) {
        const exists = await prisma.task.findFirst({ where: { userId, notionPageId: t.key } });
        if (exists) { updated++; continue; }
        await prisma.task.create({ data: { userId, title: t.title, priority: t.priority, category: t.category, dueDate: addDays(new Date(), t.days), estimatedMinutes: t.minutes, tags: 'notion-demo', notionPageId: t.key } });
        created++;
      }
    } else {
      for (const n of DEMO_IMPORT.notes) {
        const exists = await prisma.note.findFirst({ where: { userId, notionPageId: n.key } });
        if (exists) { updated++; continue; }
        await prisma.note.create({ data: { userId, title: n.title, content: n.content, type: n.type, topic: n.topic, tags: 'notion-demo', source: 'notion-demo', notionPageId: n.key } });
        created++;
      }
    }
  } else {
    const pages: NotionObject[] = [];
    if (conn.targetType === 'database') {
      pages.push(...(await client.queryDatabase(conn.targetId!)).results);
    } else {
      const children = (await client.getBlockChildren(conn.targetId!)).results;
      if (kind === 'tasks') {
        for (const b of children.filter((b) => b.type === 'to_do')) {
          pages.push({ id: b.id, __todo: true, title: plain(b.to_do.rich_text), checked: b.to_do.checked });
        }
      } else {
        pages.push(...children.filter((b) => b.type === 'child_page').map((b) => ({ id: b.id, __childPage: true, title: b.child_page.title })));
        if (!pages.length) pages.push({ id: conn.targetId, __childPage: true, title: conn.targetTitle });
      }
    }

    for (const p of pages) {
      const title = p.__todo || p.__childPage ? p.title : titleOf(p);
      if (!title) continue;
      if (kind === 'tasks') {
        const due = propValue(p, ['due', 'due date', 'date', 'deadline'], 'date')?.date?.start;
        const statusProp = propValue(p, ['status'], 'status') ?? propValue(p, ['status'], 'select');
        const statusName = (statusProp?.status ?? statusProp?.select)?.name?.toLowerCase() ?? '';
        const checkbox = propValue(p, ['done', 'completed', 'complete'], 'checkbox')?.checkbox;
        const done = p.checked === true || checkbox === true || /done|complete/.test(statusName);
        const data = { title, dueDate: due ? new Date(due) : null, status: done ? 'done' : statusName.includes('progress') ? 'in_progress' : 'todo', completedAt: done ? new Date() : null };
        const existing = await prisma.task.findFirst({ where: { userId, notionPageId: p.id } });
        if (existing) { await prisma.task.update({ where: { id: existing.id }, data }); updated++; }
        else { await prisma.task.create({ data: { userId, ...data, tags: 'notion', notionPageId: p.id } }); created++; }
      } else {
        const blocks = (await client.getBlockChildren(p.id)).results;
        const content = blocksToText(blocks).replace(/\n?Synced from StudentOS · \S+$/, '');
        const existing = await prisma.note.findFirst({ where: { userId, notionPageId: p.id } });
        if (existing) { await prisma.note.update({ where: { id: existing.id }, data: { title, content } }); updated++; }
        else { await prisma.note.create({ data: { userId, title, content, source: 'notion', tags: 'notion', notionPageId: p.id } }); created++; }
        await sleep(340);
      }
    }
  }

  const simulated = conn.mode === 'demo';
  await prisma.notionSyncLog.create({
    data: {
      userId,
      mode: conn.mode,
      direction: 'import',
      itemType: kind,
      count: created + updated,
      message: simulated
        ? `Simulated import from the demo workspace: ${created} new, ${updated} already imported`
        : `${created} imported, ${updated} updated from "${conn.targetTitle}"`,
    },
  });
  await prisma.notionConnection.update({ where: { userId }, data: { lastSyncedAt: new Date(), lastError: null } });
  return { mode: conn.mode, simulated, created, updated, status: await getStatus(userId) };
}

