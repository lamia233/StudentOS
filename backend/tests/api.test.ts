import { describe, expect, it } from 'vitest';
import { api, registerUser } from './helpers.js';
import { config } from '../src/config.js';

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

describe('authentication', () => {
  it('registers, logs in, returns the current user and logs out', async () => {
    const { email } = await registerUser('Ayesha');
    const login = await api().post('/api/auth/login').send({ email, password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.user.passwordHash).toBeUndefined();
    const cookie = login.headers['set-cookie'];
    expect(String(cookie)).toContain('studentos_session');
    const me = await api().get('/api/users/me').set('Cookie', cookie);
    expect(me.body.user.email).toBe(email);
    const out = await api().post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);
  });

  it('rejects wrong passwords, duplicates and invalid input', async () => {
    const { email } = await registerUser();
    expect((await api().post('/api/auth/login').send({ email, password: 'wrong-pass' })).status).toBe(401);
    expect((await api().post('/api/auth/register').send({ name: 'X', email, password: 'password123' })).status).toBe(409);
    const bad = await api().post('/api/auth/register').send({ name: '', email: 'nope', password: '1' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBeTruthy();
  });

  it('protects API routes', async () => {
    expect((await api().get('/api/dashboard')).status).toBe(401);
    expect((await api().get('/api/tasks').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });
});

describe('tasks', () => {
  it('creates, completes, updates and deletes a task', async () => {
    const { auth } = await registerUser();
    const created = await api().post('/api/tasks').set(auth).send({ title: 'Read chapter 5', priority: 'high', dueDate: inDays(1), estimatedMinutes: 45, tags: ['reading', 'os'] });
    expect(created.status).toBe(201);
    expect(created.body.tags).toBe('reading,os');
    const id = created.body.id;

    const done = await api().patch(`/api/tasks/${id}`).set(auth).send({ status: 'done' });
    expect(done.body.status).toBe('done');
    expect(done.body.completedAt).toBeTruthy();
    expect(done.body.priority).toBe('high');

    const prod = await api().get('/api/productivity').set(auth);
    expect(prod.body.thisWeek.tasksCompleted).toBeGreaterThanOrEqual(1);

    expect((await api().delete(`/api/tasks/${id}`).set(auth)).status).toBe(204);
    expect((await api().get('/api/tasks').set(auth)).body).toHaveLength(0);
  });

  it('creates the next instance when a recurring task is completed', async () => {
    const { auth } = await registerUser();
    const t = await api().post('/api/tasks').set(auth).send({ title: 'Weekly review', recurrence: 'weekly', dueDate: inDays(0) });
    await api().patch(`/api/tasks/${t.body.id}`).set(auth).send({ status: 'done' });
    const list = (await api().get('/api/tasks').set(auth)).body;
    expect(list).toHaveLength(2);
    expect(list.filter((x: { status: string }) => x.status === 'todo')).toHaveLength(1);
  });

  it("does not let users touch each other's data", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const t = await api().post('/api/tasks').set(a.auth).send({ title: 'Private' });
    expect((await api().patch(`/api/tasks/${t.body.id}`).set(b.auth).send({ title: 'hacked' })).status).toBe(404);
    expect((await api().delete(`/api/tasks/${t.body.id}`).set(b.auth)).status).toBe(404);
  });
});

describe('academics and dashboard', () => {
  it('creates a course and assignment and reflects them in the dashboard', async () => {
    const { auth } = await registerUser();
    const course = await api().post('/api/courses').set(auth).send({ name: 'Database Systems', code: 'CSE 3521', credits: 3, color: '#6366f1' });
    expect(course.status).toBe(201);
    const asg = await api().post('/api/assignments').set(auth).send({ title: 'ER Diagram', courseId: course.body.id, deadline: inDays(1), priority: 'high', estimatedHours: 2 });
    expect(asg.status).toBe(201);
    const exam = await api().post('/api/exams').set(auth).send({ name: 'Midterm', courseId: course.body.id, date: inDays(4), type: 'midterm' });
    expect(exam.status).toBe(201);

    const dash = await api().get('/api/dashboard').set(auth);
    expect(dash.status).toBe(200);
    expect(dash.body.nextDeadline.title).toBe('ER Diagram');
    expect(dash.body.focus[0].title).toContain('ER Diagram');
    expect(dash.body.exams).toHaveLength(1);

    const radar = await api().get('/api/radar').set(auth);
    const item = radar.body.items.find((i: { title: string }) => i.title === 'ER Diagram');
    expect(item.level).toBe('critical');
  });

  it('rejects linking to another user course', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const course = await api().post('/api/courses').set(a.auth).send({ name: 'Secret', code: 'S1' });
    const res = await api().post('/api/assignments').set(b.auth).send({ title: 'x', courseId: course.body.id, deadline: inDays(2) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Unknown course');
  });
});

describe('planner', () => {
  it('generates and saves a weekly plan', async () => {
    const { auth } = await registerUser();
    const course = await api().post('/api/courses').set(auth).send({ name: 'Networks', code: 'CSE 3711' });
    await api().post('/api/assignments').set(auth).send({ title: 'Socket lab', courseId: course.body.id, deadline: inDays(3), estimatedHours: 3 });
    const plan = await api().post('/api/planner/week').set(auth).send({ dailyMinutes: [120, 120, 120, 120, 120, 120, 120], preferredTime: 'evening' });
    expect(plan.status).toBe(200);
    expect(plan.body.totalMinutes).toBeGreaterThan(0);
    const blocks = plan.body.days.flatMap((d: { blocks: unknown[] }) => d.blocks);
    const saved = await api().post('/api/planner/save').set(auth).send({ blocks, replaceExisting: true });
    expect(saved.body.saved).toBe(blocks.length);
    const events = await api().get('/api/events').set(auth);
    expect(events.body.some((e: { type: string }) => e.type === 'study')).toBe(true);
  });
});

describe('career', () => {
  it('creates a goal with milestones and computes progress', async () => {
    const { auth } = await registerUser();
    const goal = await api().post('/api/goals').set(auth).send({ title: 'Get a software internship', category: 'internship', deadline: inDays(60) });
    expect(goal.status).toBe(201);
    await api().post(`/api/goals/${goal.body.id}/milestones`).set(auth).send({ title: 'Update CV' });
    const withTwo = await api().post(`/api/goals/${goal.body.id}/milestones`).set(auth).send({ title: 'Apply to 10 companies' });
    const first = withTwo.body.milestones[0];
    await api().patch(`/api/goals/${goal.body.id}/milestones/${first.id}`).set(auth).send({ done: true });
    const goals = await api().get('/api/goals').set(auth);
    expect(goals.body[0].progress).toBe(50);
  });
});

describe('notion (demo mode)', () => {
  it('connects in demo mode and simulates export and import without claiming live sync', async () => {
    const { auth } = await registerUser();
    await api().post('/api/tasks').set(auth).send({ title: 'Export me' });
    const status = await api().get('/api/notion/status').set(auth);
    expect(status.body.liveAvailable).toBe(false);

    const live = await api().post('/api/notion/connect').set(auth).send({ mode: 'live' });
    expect(live.status).toBe(400);

    const conn = await api().post('/api/notion/connect').set(auth).send({ mode: 'demo' });
    expect(conn.body.mode).toBe('demo');

    const sync = await api().post('/api/notion/sync').set(auth).send({ types: ['tasks'] });
    expect(sync.status).toBe(200);
    expect(sync.body.mode).toBe('demo');
    expect(sync.body.simulated).toBe(true);
    expect(sync.body.results[0]).toMatchObject({ type: 'tasks', created: 1 });
    expect(sync.body.status.logs[0].message.toLowerCase()).toContain('simulated');

    const imp = await api().post('/api/notion/import').set(auth).send({ kind: 'notes' });
    expect(imp.body.mode).toBe('demo');
    expect(JSON.stringify(status.body)).not.toMatch(/secret_|ntn_/);
  });
});

describe('notion (server token)', () => {
  it('only lets NOTION_OWNER_EMAIL use the server-wide token', async () => {
    const saved = { ...config.notion };
    Object.assign(config.notion, { token: 'server-token', ownerEmail: 'owner@studentos.test' });
    try {
      const { auth } = await registerUser();
      const status = await api().get('/api/notion/status').set(auth);
      expect(status.body.liveAvailable).toBe(false);
      const live = await api().post('/api/notion/connect').set(auth).send({ mode: 'live', targetId: 'abc' });
      expect(live.status).toBe(400);
    } finally {
      Object.assign(config.notion, saved);
    }
  });
});

describe('assistant', () => {
  it('answers prioritization questions from the user data', async () => {
    const { auth } = await registerUser();
    const course = await api().post('/api/courses').set(auth).send({ name: 'Database Systems', code: 'CSE 3521' });
    await api().post('/api/assignments').set(auth).send({ title: 'Normalization worksheet', courseId: course.body.id, deadline: inDays(1), priority: 'high' });
    const res = await api().post('/api/assistant').set(auth).send({ message: 'What should I prioritize today?' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('rules');
    expect(res.body.answer).toContain('Normalization worksheet');
  });
});

describe('demo account', () => {
  it('logs into a fully seeded demo workspace', async () => {
    const res = await api().post('/api/auth/demo');
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'];
    const dash = await api().get('/api/dashboard').set('Cookie', cookie);
    expect(dash.body.user.isDemo).toBe(true);
    expect(dash.body.radar.items.some((i: { title: string; label: string }) => i.title.startsWith('Database Assignment') && i.label === 'tomorrow')).toBe(true);
    expect(dash.body.career.goals.length).toBeGreaterThan(0);
  });
});
