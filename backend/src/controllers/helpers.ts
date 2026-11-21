import { prisma } from '../lib/prisma.js';
import { badRequest } from '../utils/errors.js';

/** Ensures referenced records belong to the current user before linking them. */
export async function assertOwned(
  userId: string,
  refs: { courseId?: string | null; careerGoalId?: string | null; skillId?: string | null; taskId?: string | null; assignmentId?: string | null; examId?: string | null },
) {
  const checks: [string | null | undefined, () => Promise<unknown>, string][] = [
    [refs.courseId, () => prisma.course.findFirst({ where: { id: refs.courseId!, userId } }), 'course'],
    [refs.careerGoalId, () => prisma.careerGoal.findFirst({ where: { id: refs.careerGoalId!, userId } }), 'career goal'],
    [refs.skillId, () => prisma.skill.findFirst({ where: { id: refs.skillId!, userId } }), 'skill'],
    [refs.taskId, () => prisma.task.findFirst({ where: { id: refs.taskId!, userId } }), 'task'],
    [refs.assignmentId, () => prisma.assignment.findFirst({ where: { id: refs.assignmentId!, userId } }), 'assignment'],
    [refs.examId, () => prisma.exam.findFirst({ where: { id: refs.examId!, userId } }), 'exam'],
  ];
  for (const [value, find, label] of checks) {
    if (value && !(await find())) throw badRequest(`Unknown ${label}`);
  }
}

export const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
