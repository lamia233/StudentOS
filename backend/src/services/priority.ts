/**
 * StudentOS priority engine.
 *
 * Every open piece of work (task, assignment, exam preparation) becomes a WorkItem
 * and receives a 0–100 Priority Score made of five transparent components:
 *
 *   urgency     (0–35)  deadline urgency: 35 × max(0, 1 − daysLeft / 14); overdue = 35; no deadline = 5
 *   priority    (0–25)  user priority: low 4 · medium 10 · high 18 · critical 25
 *   effort      (0–15)  workload pressure: remaining hours vs. ~2 study hours/day until the deadline
 *   exam        (0–15)  exam proximity: 15 × max(0, 1 − daysLeft / 10), exams only
 *   completion  (0–10)  how much is left: 10 × (1 − progress)
 *
 * The planner always works on the highest scoring item first.
 */
import { daysUntil, calendarDaysUntil } from '../utils/dates.js';

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type WorkKind = 'task' | 'assignment' | 'exam';

export interface WorkItem {
  id: string;
  kind: WorkKind;
  title: string;
  courseId: string | null;
  courseName: string | null;
  courseCode: string | null;
  color: string | null;
  category: string;
  dueDate: Date | null;
  priority: Priority;
  /** Minutes of work left. */
  remainingMinutes: number;
  /** 0–1 */
  progress: number;
  /** For exams: the next syllabus topic to revise. */
  focusTopic?: string | null;
}

export interface ScoreBreakdown {
  urgency: number;
  priority: number;
  effort: number;
  exam: number;
  completion: number;
}

export interface ScoredItem extends WorkItem {
  score: number;
  breakdown: ScoreBreakdown;
  reason: string;
}

export const PRIORITY_POINTS: Record<Priority, number> = { low: 4, medium: 10, high: 18, critical: 25 };
export const DAILY_CAPACITY_HOURS = 2;
export const EXAM_PREP_HOURS = 8;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreItem(item: WorkItem, now: Date = new Date()): ScoredItem {
  const daysLeft = item.dueDate ? daysUntil(item.dueDate, now) : null;

  let urgency: number;
  if (daysLeft === null) urgency = 5;
  else if (daysLeft <= 0) urgency = 35;
  else urgency = 35 * Math.max(0, 1 - daysLeft / 14);

  const priority = PRIORITY_POINTS[item.priority] ?? PRIORITY_POINTS.medium;

  const hoursNeeded = item.remainingMinutes / 60;
  let effort: number;
  if (daysLeft === null) effort = Math.min(5, hoursNeeded);
  else {
    const capacity = Math.max(daysLeft, 0.5) * DAILY_CAPACITY_HOURS;
    effort = Math.min(15, (15 * hoursNeeded) / capacity);
  }

  const exam = item.kind === 'exam' && daysLeft !== null ? 15 * Math.min(1, Math.max(0, 1 - daysLeft / 10)) : 0;
  const completion = 10 * (1 - Math.min(1, Math.max(0, item.progress)));

  const breakdown: ScoreBreakdown = {
    urgency: round1(urgency),
    priority: round1(priority),
    effort: round1(effort),
    exam: round1(exam),
    completion: round1(completion),
  };
  const score = round1(urgency + priority + effort + exam + completion);
  return { ...item, score, breakdown, reason: explain(item, breakdown, now) };
}

function explain(item: WorkItem, b: ScoreBreakdown, now: Date): string {
  const parts: string[] = [];
  if (item.dueDate) {
    const d = calendarDaysUntil(item.dueDate, now);
    const what = item.kind === 'exam' ? 'Exam' : 'Due';
    if (d < 0) parts.push(`Overdue by ${-d} day${d === -1 ? '' : 's'}`);
    else if (d === 0) parts.push(`${what} today`);
    else if (d === 1) parts.push(`${what} tomorrow`);
    else parts.push(`${what} in ${d} days`);
  }
  if (item.priority === 'critical' || item.priority === 'high') parts.push(`${item.priority} priority`);
  if (b.effort >= 8) parts.push(`~${Math.round(item.remainingMinutes / 60)}h of work left`);
  if (item.kind === 'exam' && item.progress < 0.5) parts.push(`${Math.round(item.progress * 100)}% prepared`);
  return parts.join(' · ') || 'Keeps your plan balanced';
}

export function rankItems(items: WorkItem[], now: Date = new Date()): ScoredItem[] {
  return items
    .filter((i) => i.remainingMinutes > 0)
    .map((i) => scoreItem(i, now))
    .sort((a, b) => b.score - a.score);
}

export function priorityLabel(score: number): 'Critical' | 'High' | 'Medium' | 'Low' {
  if (score >= 70) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
}

export function displayTitle(item: WorkItem): string {
  if (item.kind === 'exam') {
    const subject = item.courseName ?? item.title;
    return item.focusTopic ? `${subject} Revision: ${item.focusTopic}` : `${subject} Revision`;
  }
  return item.title;
}
