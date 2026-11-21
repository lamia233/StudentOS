import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { validateBody as v } from '../middleware/validate.js';
import * as S from '../models/schemas.js';
import * as auth from '../controllers/auth.js';
import * as ac from '../controllers/academics.js';
import * as ws from '../controllers/workspace.js';
import * as campus from '../controllers/campus.js';
import * as ins from '../controllers/insights.js';
import { config } from '../config.js';

export const api = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.isTest ? 1000 : 50, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, please try again later.' } });

api.get('/health', (_req, res) => res.json({ ok: true, notionLive: !!config.notion.token, llm: !!config.llm.apiKey }));

// Auth
api.post('/auth/register', authLimiter, v(S.registerSchema), auth.register);
api.post('/auth/login', authLimiter, v(S.loginSchema), auth.login);
api.post('/auth/demo', authLimiter, auth.demo);
api.post('/auth/logout', auth.logout);

api.use(requireAuth);

// Users
api.get('/users/me', auth.me);
api.patch('/users/me', v(S.profileSchema), auth.updateMe);
api.post('/users/me/password', v(S.passwordSchema), auth.changePassword);
api.post('/users/me/onboarding', v(S.onboardingSchema), auth.onboard);
api.post('/users/me/reset-demo', auth.resetDemo);

// Courses
api.get('/courses', ac.listCourses);
api.post('/courses', v(S.courseSchema), ac.createCourse);
api.get('/courses/:id', ac.getCourse);
api.patch('/courses/:id', v(S.patchOf(S.courseSchema)), ac.updateCourse);
api.delete('/courses/:id', ac.deleteCourse);

// Tasks
api.get('/tasks', ac.listTasks);
api.post('/tasks', v(S.taskSchema), ac.createTask);
api.patch('/tasks/:id', v(S.patchOf(S.taskSchema)), ac.updateTask);
api.post('/tasks/:id/toggle', ac.toggleTask);
api.delete('/tasks/:id', ac.deleteTask);

// Assignments
api.get('/assignments', ac.listAssignments);
api.post('/assignments', v(S.assignmentSchema), ac.createAssignment);
api.patch('/assignments/:id', v(S.patchOf(S.assignmentSchema)), ac.updateAssignment);
api.delete('/assignments/:id', ac.deleteAssignment);

// Exams
api.get('/exams', ac.listExams);
api.post('/exams', v(S.examSchema), ac.createExam);
api.patch('/exams/:id', v(S.patchOf(S.examSchema)), ac.updateExam);
api.delete('/exams/:id', ac.deleteExam);

// Calendar events
api.get('/events', ws.listEvents);
api.get('/events/calendar', ws.calendarFeed);
api.post('/events', v(S.eventSchema), ws.createEvent);
api.patch('/events/:id', v(S.patchOf(S.eventBaseSchema)), ws.updateEvent);
api.delete('/events/:id', ws.deleteEvent);

// Knowledge hub
api.get('/notes', ws.listNotes);
api.get('/notes/search', ws.searchKnowledge);
api.post('/notes', v(S.noteSchema), ws.createNote);
api.patch('/notes/:id', v(S.patchOf(S.noteSchema)), ws.updateNote);
api.delete('/notes/:id', ws.deleteNote);

// Career
api.get('/goals', ws.listGoals);
api.post('/goals', v(S.goalSchema), ws.createGoal);
api.patch('/goals/:id', v(S.patchOf(S.goalSchema)), ws.updateGoal);
api.delete('/goals/:id', ws.deleteGoal);
api.post('/goals/:id/milestones', v(S.milestoneSchema), ws.addMilestone);
api.patch('/goals/:id/milestones/:milestoneId', v(S.patchOf(S.milestoneSchema)), ws.updateMilestone);
api.delete('/goals/:id/milestones/:milestoneId', ws.deleteMilestone);

// Skills
api.get('/skills', ws.listSkills);
api.post('/skills', v(S.skillSchema), ws.createSkill);
api.patch('/skills/:id', v(S.patchOf(S.skillSchema)), ws.updateSkill);
api.delete('/skills/:id', ws.deleteSkill);

// Study sessions
api.get('/study-sessions', ws.listStudySessions);
api.post('/study-sessions', v(S.studySessionSchema), ws.createStudySession);

// Campus
api.get('/organizations', campus.listOrganizations);
api.post('/organizations', v(S.organizationSchema), campus.createOrganization);
api.get('/organizations/events', campus.listOrgEvents);
api.post('/organizations/:id/events', v(S.orgEventSchema), campus.createOrgEvent);
api.delete('/organizations/events/:eventId', campus.deleteOrgEvent);
api.put('/organizations/events/:eventId/interest', v(S.interestSchema), campus.setInterest);
api.delete('/organizations/events/:eventId/interest', campus.removeInterest);
api.post('/organizations/events/:eventId/calendar', campus.addOrgEventToCalendar);

// Insights
api.get('/dashboard', ins.dashboard);
api.get('/radar', ins.radar);
api.get('/productivity', ins.productivity);
api.get('/recommendations', ins.recommendations);
api.get('/planner/priorities', ins.priorities);
api.get('/planner/today', ins.today);
api.post('/planner/week', v(S.weekPlanSchema), ins.weekPlan);
api.post('/planner/save', v(S.savePlanSchema), ins.savePlan);
api.get('/notifications', ins.listNotifications);
api.post('/notifications/read-all', ins.markAllNotificationsRead);
api.patch('/notifications/:id/read', ins.markNotificationRead);
api.post('/assistant', v(S.assistantSchema), ins.assistant);

// Notion
api.get('/notion/status', ins.notionStatus);
api.post('/notion/connect', v(S.notionConnectSchema), ins.notionConnect);
api.post('/notion/disconnect', ins.notionDisconnect);
api.post('/notion/sync', v(S.notionSyncSchema), ins.notionSync);
api.post('/notion/import', v(S.notionImportSchema), ins.notionImport);
