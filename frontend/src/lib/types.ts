export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Theme = 'light' | 'dark' | 'system';
export type StudyTime = 'morning' | 'afternoon' | 'evening' | 'night';

export interface User {
  id: string;
  email: string;
  name: string;
  university: string | null;
  degree: string | null;
  semester: string | null;
  semesterStart: string | null;
  semesterEnd: string | null;
  studyHoursPerWeek: number;
  preferredStudyTime: StudyTime;
  careerGoal: string | null;
  onboarded: boolean;
  isDemo: boolean;
  theme: Theme;
  notifyDeadlines: boolean;
  notifyExams: boolean;
  notifyGoals: boolean;
}

export interface CourseRef {
  id: string;
  code: string;
  name: string;
  color: string;
}

export interface ClassMeeting {
  day: number;
  start: string;
  end: string;
  room?: string;
}

export interface Course extends CourseRef {
  instructor: string | null;
  credits: number;
  semester: string | null;
  notes: string | null;
  schedule: ClassMeeting[];
  assignments: { id: string; status: string; progress: number; deadline: string }[];
  exams: { id: string; date: string; preparation: number }[];
  _count: { tasks: number; notesList: number };
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskCategory = 'academic' | 'career' | 'personal' | 'organization';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  category: TaskCategory;
  dueDate: string | null;
  estimatedMinutes: number;
  tags: string;
  recurrence: 'none' | 'daily' | 'weekly';
  completedAt: string | null;
  courseId: string | null;
  careerGoalId: string | null;
  skillId: string | null;
  notionPageId: string | null;
  course: CourseRef | null;
  careerGoal: { id: string; title: string } | null;
  skill: { id: string; name: string } | null;
}

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  estimatedHours: number;
  priority: Priority;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  difficulty: 'easy' | 'medium' | 'hard';
  courseId: string;
  completedAt: string | null;
  course: CourseRef;
}

export interface Exam {
  id: string;
  name: string;
  date: string;
  location: string | null;
  topics: string | null;
  preparation: number;
  courseId: string;
  course: CourseRef;
}

export interface CalendarItem {
  id: string;
  refId?: string;
  title: string;
  type: 'class' | 'academic' | 'study' | 'exam' | 'assignment' | 'career' | 'personal';
  start: string;
  end: string;
  allDay?: boolean;
  location?: string | null;
  description?: string | null;
  courseId: string | null;
  color: string | null;
  editable: boolean;
  source: string;
  preparation?: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'resource' | 'link' | 'lecture' | 'project' | 'research';
  url: string | null;
  topic: string | null;
  semester: string | null;
  tags: string;
  source: string;
  courseId: string | null;
  course: CourseRef | null;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  order: number;
  completedAt: string | null;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  target: string | null;
  deadline: string | null;
  milestones: Milestone[];
  tasks: { id: string; title: string; status: TaskStatus; dueDate: string | null }[];
  progress: number;
}

export interface Skill {
  id: string;
  name: string;
  category: 'technical' | 'soft' | 'language' | 'domain';
  currentLevel: number;
  targetLevel: number;
  resources: { title: string; url: string }[];
  tasks: { id: string; title: string; status: TaskStatus }[];
  progress: number;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  category: string;
  color: string;
  _count: { events: number };
}

export interface OrgEvent {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  registrationDeadline: string | null;
  category: string;
  organization: { id: string; name: string; color: string; category: string };
  myStatus: 'saved' | 'interested' | 'registered' | null;
  onCalendar: boolean;
  interestedCount: number;
  canEdit: boolean;
}

export interface StudySession {
  id: string;
  title: string;
  start: string;
  durationMinutes: number;
  type: 'focus' | 'pomodoro' | 'manual';
  course: { code: string; name: string; color: string } | null;
}

export interface RadarItem {
  id: string;
  kind: 'task' | 'assignment' | 'exam' | 'registration';
  title: string;
  course: string | null;
  courseCode: string | null;
  color: string | null;
  due: string;
  progress: number;
  priority: Priority | string;
  category?: string;
  link: string;
  level: 'critical' | 'approaching' | 'upcoming' | 'safe';
  label: string;
  daysLeft: number;
  overdue: boolean;
}

export interface Radar {
  items: RadarItem[];
  counts: Record<RadarItem['level'], number>;
}

export interface Recommendation {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  action?: { label: string; link: string };
}

export interface FocusItem {
  id: string;
  kind: 'task' | 'assignment' | 'exam';
  title: string;
  courseName: string | null;
  courseCode: string | null;
  color: string | null;
  minutes: number;
  score: number;
  priorityLabel: 'Critical' | 'High' | 'Medium' | 'Low';
  reason: string;
  dueDate: string | null;
}

export interface ScoreComponent {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface ProductivityScore {
  score: number;
  components: ScoreComponent[];
}

export interface DayStat {
  date: string;
  label: string;
  studyMinutes: number;
  tasksCompleted: number;
  focusSessions: number;
  isFuture: boolean;
}

export interface Productivity {
  week: DayStat[];
  weeks: { weekStart: string; label: string; studyHours: number; tasksCompleted: number }[];
  thisWeek: { tasksCompleted: number; studyMinutes: number; focusSessions: number; weeklyGoalMinutes: number; completionRate: number | null; overdue: number };
  lastWeek: { tasksCompleted: number };
  streak: number;
  mostProductiveDay: string | null;
  score: ProductivityScore;
  courseWorkload: { courseId: string; code: string; name: string; color: string; remainingHours: number; studiedHours14d: number }[];
  goals: { id: string; title: string; progress: number; done: number; total: number }[];
}

export interface ScheduleItem {
  id: string;
  title: string;
  type: string;
  start: string;
  end: string;
  location?: string | null;
  color?: string | null;
}

export interface Dashboard {
  user: { name: string; university: string | null; semester: string | null; isDemo: boolean };
  greeting: string;
  now: string;
  nextDeadline: { title: string; label: string; kind: string; course: string | null } | null;
  semester: { progress: number | null; week: number | null; weeks: number | null; start: string | null; end: string | null };
  availableMinutes: number;
  focus: FocusItem[];
  schedule: ScheduleItem[];
  todayTasks: { id: string; title: string; status: TaskStatus; priority: Priority; dueDate: string | null; estimatedMinutes: number; course: { code: string; color: string } | null }[];
  radar: Radar;
  exams: { id: string; name: string; course: string; code: string; color: string; date: string; location: string | null; preparation: number; label: string }[];
  study: { minutesThisWeek: number; goalMinutes: number; week: DayStat[] };
  productivity: { score: ProductivityScore; streak: number; tasksCompleted: number; lastWeekTasksCompleted: number };
  courseHealth: { id: string; code: string; name: string; color: string; progress: number; status: 'on-track' | 'at-risk' | 'behind' }[];
  career: { progress: number; goals: { id: string; title: string; category: string; progress: number; nextMilestone: string | null; deadline: string | null }[] };
  skills: { id: string; name: string; currentLevel: number; targetLevel: number; progress: number }[];
  recommendations: Recommendation[];
  notion: { status: string; mode: string; lastSyncedAt: string | null } | null;
}

export interface ScoredItem {
  id: string;
  kind: 'task' | 'assignment' | 'exam';
  title: string;
  displayTitle: string;
  courseId: string | null;
  courseName: string | null;
  courseCode: string | null;
  color: string | null;
  category: string;
  dueDate: string | null;
  priority: Priority;
  remainingMinutes: number;
  progress: number;
  score: number;
  priorityLabel: string;
  breakdown: { urgency: number; priority: number; effort: number; exam: number; completion: number };
  reason: string;
}

export interface PlanBlock {
  start: string;
  end: string;
  minutes: number;
  itemId: string;
  kind: string;
  title: string;
  courseId: string | null;
  courseName: string | null;
  courseCode: string | null;
  color: string | null;
  reason: string;
  score: number;
}

export interface WeekPlan {
  days: { date: string; availableMinutes: number; plannedMinutes: number; blocks: PlanBlock[] }[];
  totalMinutes: number;
  warnings: string[];
  considered: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotionLog {
  id: string;
  mode: 'demo' | 'live';
  direction: 'export' | 'import';
  itemType: string;
  count: number;
  status: string;
  message: string;
  createdAt: string;
}

export interface NotionStatus {
  connected: boolean;
  mode: 'demo' | 'live' | null;
  status: string;
  targetId: string | null;
  targetType: string | null;
  targetTitle: string | null;
  workspaceName: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  tokenSource: 'env' | 'user' | null;
  liveAvailable: boolean;
  defaultTargetConfigured: boolean;
  linked: Record<string, number>;
  logs: NotionLog[];
}

export interface AssistantReply {
  answer: string;
  source: 'rules' | 'llm';
  intent: string;
  suggestions: string[];
}
