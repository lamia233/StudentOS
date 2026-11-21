import { z } from 'zod';

const priority = z.enum(['low', 'medium', 'high', 'critical']);
const optionalDate = z.coerce.date().nullable().optional();
const str = (max = 200) => z.string().trim().max(max);
const optStr = (max = 2000) => z.string().trim().max(max).nullable().optional();
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #6366f1');
const id = z.string().min(1).max(64);

export const registerSchema = z.object({
  name: str(80).min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required').max(128),
});

export const classMeeting = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  room: str(60).optional(),
});

export const onboardingSchema = z.object({
  name: str(80).min(1),
  university: str(120).min(1),
  degree: str(120).min(1),
  semester: str(60).min(1),
  studyHoursPerWeek: z.number().int().min(1).max(80),
  careerGoal: str(160).optional().default(''),
  preferredStudyTime: z.enum(['morning', 'afternoon', 'evening', 'night']),
  courses: z
    .array(z.object({ name: str(120).min(1), code: str(30).min(1), credits: z.number().min(0).max(10).optional(), color: hexColor.optional() }))
    .max(12)
    .default([]),
});

export const profileSchema = z
  .object({
    name: str(80).min(1),
    university: optStr(120),
    degree: optStr(120),
    semester: optStr(60),
    semesterStart: optionalDate,
    semesterEnd: optionalDate,
    studyHoursPerWeek: z.number().int().min(1).max(80),
    preferredStudyTime: z.enum(['morning', 'afternoon', 'evening', 'night']),
    careerGoal: optStr(160),
    theme: z.enum(['light', 'dark', 'system']),
    notifyDeadlines: z.boolean(),
    notifyExams: z.boolean(),
    notifyGoals: z.boolean(),
  })
  .partial();

export const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const courseSchema = z.object({
  name: str(120).min(1, 'Course name is required'),
  code: str(30).min(1, 'Course code is required'),
  instructor: optStr(120),
  credits: z.number().min(0).max(10).default(3),
  color: hexColor.default('#6366f1'),
  semester: optStr(60),
  notes: optStr(4000),
  schedule: z.array(classMeeting).max(10).default([]),
});

export const taskSchema = z.object({
  title: str(200).min(1, 'Title is required'),
  description: optStr(4000),
  priority: priority.default('medium'),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  category: z.enum(['academic', 'career', 'personal', 'organization']).default('academic'),
  dueDate: optionalDate,
  estimatedMinutes: z.number().int().min(5).max(24 * 60).default(30),
  tags: z.union([z.string().max(300), z.array(z.string().max(40)).max(15)]).transform((t) => (Array.isArray(t) ? t.join(',') : t)).default(''),
  recurrence: z.enum(['none', 'daily', 'weekly']).default('none'),
  courseId: id.nullable().optional(),
  careerGoalId: id.nullable().optional(),
  skillId: id.nullable().optional(),
});

export const assignmentSchema = z.object({
  title: str(200).min(1, 'Title is required'),
  courseId: id,
  description: optStr(4000),
  deadline: z.coerce.date(),
  estimatedHours: z.number().min(0.25).max(200).default(3),
  priority: priority.default('medium'),
  status: z.enum(['not_started', 'in_progress', 'completed']).default('not_started'),
  progress: z.number().int().min(0).max(100).default(0),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});

export const examSchema = z.object({
  name: str(200).min(1, 'Exam name is required'),
  courseId: id,
  date: z.coerce.date(),
  location: optStr(120),
  topics: optStr(4000),
  preparation: z.number().int().min(0).max(100).default(0),
});

export const eventBaseSchema = z.object({
    title: str(200).min(1, 'Title is required'),
    description: optStr(4000),
    start: z.coerce.date(),
    end: z.coerce.date(),
    allDay: z.boolean().default(false),
    type: z.enum(['academic', 'study', 'exam', 'assignment', 'career', 'personal']).default('personal'),
    location: optStr(120),
    courseId: id.nullable().optional(),
});

export const eventSchema = eventBaseSchema.refine((e) => e.end >= e.start, { message: 'End must be after start', path: ['end'] });

export const noteSchema = z.object({
  title: str(200).min(1, 'Title is required'),
  content: z.string().max(50000).default(''),
  type: z.enum(['note', 'resource', 'link', 'lecture', 'project', 'research']).default('note'),
  url: z.string().trim().url('Enter a valid URL').max(500).nullable().optional().or(z.literal('').transform(() => null)),
  topic: optStr(120),
  semester: optStr(60),
  tags: z.union([z.string().max(300), z.array(z.string().max(40)).max(15)]).transform((t) => (Array.isArray(t) ? t.join(',') : t)).default(''),
  courseId: id.nullable().optional(),
});

export const goalSchema = z.object({
  title: str(200).min(1, 'Title is required'),
  description: optStr(4000),
  category: z.enum(['internship', 'job', 'research', 'learning', 'higher-study', 'portfolio', 'career']).default('career'),
  target: optStr(200),
  deadline: optionalDate,
  milestones: z.array(z.object({ title: str(200).min(1), done: z.boolean().default(false) })).max(30).optional(),
});

export const milestoneSchema = z.object({ title: str(200).min(1), done: z.boolean().default(false) });

export const skillSchema = z.object({
  name: str(80).min(1, 'Skill name is required'),
  category: z.enum(['technical', 'soft', 'language', 'domain']).default('technical'),
  currentLevel: z.number().int().min(0).max(10).default(1),
  targetLevel: z.number().int().min(1).max(10).default(7),
  resources: z.array(z.object({ title: str(120).min(1), url: z.string().trim().max(500).optional().default('') })).max(20).default([]),
});

export const studySessionSchema = z.object({
  title: str(200).min(1),
  durationMinutes: z.number().int().min(1).max(600),
  type: z.enum(['focus', 'pomodoro', 'manual']).default('focus'),
  start: z.coerce.date().optional(),
  courseId: id.nullable().optional(),
  taskId: id.nullable().optional(),
  assignmentId: id.nullable().optional(),
  examId: id.nullable().optional(),
});

export const organizationSchema = z.object({
  name: str(120).min(1),
  description: optStr(2000),
  category: z.enum(['club', 'society', 'department', 'volunteer', 'company']).default('club'),
  color: hexColor.default('#0ea5e9'),
});

export const orgEventSchema = z.object({
  title: str(200).min(1, 'Title is required'),
  description: optStr(4000),
  date: z.coerce.date(),
  location: optStr(160),
  registrationDeadline: optionalDate,
  category: z.enum(['hackathon', 'competition', 'volunteering', 'workshop', 'seminar', 'social', 'career']).default('workshop'),
});

export const interestSchema = z.object({ status: z.enum(['saved', 'interested', 'registered']) });

export const weekPlanSchema = z.object({
  dailyMinutes: z.array(z.number().int().min(0).max(16 * 60)).min(1).max(14),
  preferredTime: z.enum(['morning', 'afternoon', 'evening', 'night']).default('evening'),
  courseIds: z.array(id).optional(),
  includeNonAcademic: z.boolean().default(true),
  blockMinutes: z.number().int().min(15).max(180).default(60),
  breakMinutes: z.number().int().min(0).max(60).default(15),
});

export const savePlanSchema = z.object({
  blocks: z
    .array(z.object({ title: str(200).min(1), start: z.coerce.date(), end: z.coerce.date(), courseId: id.nullable().optional() }))
    .max(200),
  replaceExisting: z.boolean().default(true),
});

export const assistantSchema = z.object({ message: z.string().trim().min(1, 'Ask a question').max(1000) });

export const notionConnectSchema = z.object({
  mode: z.enum(['demo', 'live']),
  token: z.string().trim().max(300).optional(),
  targetId: z.string().trim().max(300).optional(),
});

export const notionSyncSchema = z.object({
  types: z.array(z.enum(['tasks', 'assignments', 'studyPlans', 'notes', 'goals'])).min(1).default(['tasks', 'assignments', 'notes', 'goals', 'studyPlans']),
});

export const notionImportSchema = z.object({ kind: z.enum(['tasks', 'notes']) });

/** Partial version of an object schema for PATCH requests: every field optional and defaults removed. */
export function patchOf(schema: z.ZodObject) {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const inner = field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : (field as z.ZodType);
    shape[key] = inner.optional();
  }
  return z.object(shape);
}
