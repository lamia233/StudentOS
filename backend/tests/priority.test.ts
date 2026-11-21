import { describe, expect, it } from 'vitest';
import { rankItems, scoreItem, type WorkItem } from '../src/services/priority.js';
import { generateWeekPlan, planDay } from '../src/services/planner.js';
import { computeProductivityScore, computeStreak, goalProgress } from '../src/services/analytics.js';
import { radarLevel, availableMinutesToday } from '../src/services/dashboard.js';
import { dayKey, addDays } from '../src/utils/dates.js';

const now = new Date('2026-03-02T09:00:00');
const item = (o: Partial<WorkItem>): WorkItem => ({
  id: Math.random().toString(36).slice(2),
  kind: 'assignment',
  title: 'Item',
  courseId: 'c1',
  courseName: 'Course',
  courseCode: 'C1',
  color: null,
  category: 'academic',
  dueDate: addDays(now, 3),
  priority: 'medium',
  remainingMinutes: 60,
  progress: 0,
  ...o,
});

describe('priority score', () => {
  it('ranks the challenge example in the expected order', () => {
    const db = item({ title: 'Database Assignment', dueDate: addDays(now, 1), priority: 'high', remainingMinutes: 90 });
    const exam = item({ title: 'Networking exam', kind: 'exam', dueDate: addDays(now, 4), priority: 'high', remainingMinutes: 300, progress: 0.3 });
    const pres = item({ title: 'SE presentation', dueDate: addDays(now, 7), priority: 'medium', remainingMinutes: 180 });
    const internship = item({ title: 'Internship application', dueDate: addDays(now, 5), priority: 'medium', remainingMinutes: 30, courseId: null, category: 'career' });
    const ranked = rankItems([pres, internship, exam, db], now).map((r) => r.title);
    expect(ranked[0]).toBe('Database Assignment');
    expect(ranked[1]).toBe('Networking exam');
    expect(ranked.indexOf('SE presentation')).toBeGreaterThan(1);
  });

  it('keeps every component inside its documented range', () => {
    const s = scoreItem(item({ dueDate: addDays(now, -2), priority: 'critical', remainingMinutes: 6000, kind: 'exam' }), now);
    expect(s.breakdown.urgency).toBe(35);
    expect(s.breakdown.priority).toBe(25);
    expect(s.breakdown.effort).toBeLessThanOrEqual(15);
    expect(s.breakdown.exam).toBe(15);
    expect(s.score).toBeLessThanOrEqual(100);
  });

  it('gives no-deadline work a low urgency', () => {
    expect(scoreItem(item({ dueDate: null }), now).breakdown.urgency).toBe(5);
  });

  it('drops finished work from the ranking', () => {
    expect(rankItems([item({ remainingMinutes: 0 })], now)).toHaveLength(0);
  });
});

describe('daily planner', () => {
  it('fits work into the available minutes, highest score first', () => {
    const ranked = rankItems([
      item({ title: 'A', dueDate: addDays(now, 1), priority: 'high', remainingMinutes: 60 }),
      item({ title: 'B', dueDate: addDays(now, 4), kind: 'exam', remainingMinutes: 300 }),
      item({ title: 'C', dueDate: addDays(now, 5), remainingMinutes: 20, courseId: null }),
    ], now);
    const plan = planDay(ranked, 120);
    expect(plan.reduce((s, p) => s + p.minutes, 0)).toBeLessThanOrEqual(120);
    expect(plan[0].title).toBe('A');
    expect(plan[0].minutes).toBe(60);
  });
});

describe('weekly planner', () => {
  it('schedules blocks at the preferred time and never after a deadline', () => {
    const a = item({ title: 'Due in 2 days', dueDate: addDays(now, 2), remainingMinutes: 240, priority: 'high' });
    const b = item({ title: 'Exam', kind: 'exam', dueDate: addDays(now, 5), remainingMinutes: 300 });
    const plan = generateWeekPlan([a, b], { dailyMinutes: [120, 120, 120, 120, 120, 120, 120], preferredTime: 'evening' }, now);
    expect(plan.days).toHaveLength(7);
    const blocks = plan.days.flatMap((d) => d.blocks);
    expect(blocks.length).toBeGreaterThan(0);
    for (const blk of blocks) {
      expect(blk.start.getHours()).toBeGreaterThanOrEqual(18);
      const src = blk.itemId === a.id ? a : b;
      expect(blk.end.getTime()).toBeLessThanOrEqual(src.dueDate!.getTime());
    }
    for (const d of plan.days) expect(d.plannedMinutes).toBeLessThanOrEqual(d.availableMinutes);
  });

  it('warns when work cannot be finished before its deadline', () => {
    const big = item({ title: 'Huge project', dueDate: addDays(now, 1), remainingMinutes: 900 });
    const plan = generateWeekPlan([big], { dailyMinutes: [60, 60], preferredTime: 'evening' }, now);
    expect(plan.warnings.join(' ')).toContain('Huge project');
  });

  it('respects the course filter', () => {
    const a = item({ courseId: 'keep' });
    const b = item({ courseId: 'drop' });
    const plan = generateWeekPlan([a, b], { dailyMinutes: [240], preferredTime: 'morning', courseIds: ['keep'] }, now);
    expect(plan.days[0].blocks.every((x) => x.courseId === 'keep')).toBe(true);
  });
});

describe('analytics', () => {
  it('computes the productivity score from its four components', () => {
    const s = computeProductivityScore({ completedThisWeek: 8, openDueThisWeek: 2, overdue: 1, studyMinutes: 600, weeklyGoalMinutes: 840, activeDays: 4, daysElapsed: 5 });
    expect(s.components.map((c) => c.points)).toEqual([32, 30, 16, 8]);
    expect(s.score).toBe(86);
  });

  it('counts a streak ending yesterday', () => {
    const keys = new Set([dayKey(addDays(now, -1)), dayKey(addDays(now, -2)), dayKey(addDays(now, -4))].map((d) => d.getTime()));
    expect(computeStreak(keys, now)).toBe(2);
  });

  it('derives goal progress from milestones', () => {
    expect(goalProgress([{ done: true }, { done: false }, { done: true }, { done: false }])).toBe(50);
    expect(goalProgress([])).toBe(0);
  });

  it('buckets deadlines for the radar', () => {
    expect(radarLevel(addDays(now, 1), now)).toBe('critical');
    expect(radarLevel(addDays(now, 3), now)).toBe('approaching');
    expect(radarLevel(addDays(now, 8), now)).toBe('upcoming');
    expect(radarLevel(addDays(now, 20), now)).toBe('safe');
    expect(radarLevel(addDays(now, -2), now)).toBe('critical');
  });

  it('gives weekends more study time', () => {
    const sat = new Date('2026-03-07T09:00:00');
    expect(availableMinutesToday(14, sat)).toBeGreaterThan(availableMinutesToday(14, now));
  });
});
