import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { addDays, addMinutes, MS_PER_HOUR, setTime, startOfDay } from '../utils/dates.js';
import { recordActivity } from './activity.js';

/** Returns a date `days` from today at hh:mm local time. */
const at = (now: Date, days: number, hhmm: string) => setTime(addDays(now, days), hhmm);

const ORGANIZATIONS = [
  { name: 'UIU Computer Club', category: 'club', color: '#6366f1', description: 'Programming contests, hackathons and tech talks for UIU students.' },
  { name: 'UIU Robotics Club', category: 'club', color: '#f97316', description: 'Robotics projects, competitions and hands-on embedded systems workshops.' },
  { name: 'IEEE UIU Student Branch', category: 'society', color: '#0ea5e9', description: 'Technical seminars, research workshops and IEEE competitions.' },
  { name: 'UIU Social Service Club', category: 'volunteer', color: '#10b981', description: 'Volunteering, blood donation drives and community service.' },
  { name: 'UIU Career Services', category: 'department', color: '#8b5cf6', description: 'Career fairs, CV clinics and internship placement support.' },
  { name: 'UIU Debate Club', category: 'club', color: '#e11d48', description: 'Parliamentary debates, public speaking and leadership events.' },
];

/** Creates the campus organizations and (re)creates system events relative to `now` when they are stale. */
export async function ensureCampus(now: Date = new Date(), force = false) {
  const orgs: Record<string, string> = {};
  for (const o of ORGANIZATIONS) {
    const org = await prisma.organization.upsert({ where: { name: o.name }, create: o, update: {} });
    orgs[o.name] = org.id;
  }
  const upcoming = await prisma.organizationEvent.count({ where: { createdById: null, date: { gte: addDays(now, 7) } } });
  if (upcoming >= 3 && !force) return orgs;

  await prisma.organizationEvent.deleteMany({ where: { createdById: null } });
  const events = [
    { org: 'UIU Computer Club', title: 'UIU CSE Fest Hackathon 2026', category: 'hackathon', days: 12, time: '09:00', reg: 5, location: 'UIU Multipurpose Hall', description: '24-hour hackathon on "Tech for Smarter Campuses". Teams of 3–4. Prizes worth BDT 150,000 and internship interviews with sponsors.' },
    { org: 'UIU Computer Club', title: 'Intra-UIU Programming Contest', category: 'competition', days: 9, time: '14:00', reg: 3, location: 'Computer Lab 2 & 3', description: 'ICPC-style 5-hour contest. Top 10 teams qualify for the national collegiate programming contest.' },
    { org: 'UIU Career Services', title: 'Spring Career & Internship Fair', category: 'career', days: 3, time: '10:00', reg: null, location: 'UIU Central Plaza', description: '30+ companies including Brain Station 23, Enosis, Cefalo and Therap. Bring printed CVs.' },
    { org: 'UIU Social Service Club', title: 'Blood Donation Campaign', category: 'volunteering', days: 6, time: '09:30', reg: 4, location: 'Ground Floor Lobby', description: 'Volunteer as a donor or organiser. Organisers receive a volunteering certificate.' },
    { org: 'IEEE UIU Student Branch', title: 'Workshop: Getting Started with AWS Cloud', category: 'workshop', days: 8, time: '15:00', reg: 6, location: 'Room 405', description: 'Hands-on workshop: EC2, S3, and deploying a full-stack app. Laptop required.' },
    { org: 'UIU Robotics Club', title: 'Line-Follower Robot Competition', category: 'competition', days: 17, time: '11:00', reg: 10, location: 'Robotics Lab', description: 'Build and race a line-follower robot. Kits available for first-time teams.' },
    { org: 'UIU Debate Club', title: 'Inter-University Debate Championship', category: 'social', days: 21, time: '10:00', reg: 12, location: 'UIU Auditorium', description: 'Asian Parliamentary format. Speakers and adjudicators welcome.' },
    { org: 'IEEE UIU Student Branch', title: 'Research Paper Writing Seminar', category: 'seminar', days: 5, time: '16:00', reg: 3, location: 'Seminar Room 1', description: 'How to structure, write and submit your first IEEE conference paper.' },
  ];
  for (const e of events) {
    await prisma.organizationEvent.create({
      data: {
        organizationId: orgs[e.org],
        title: e.title,
        description: e.description,
        category: e.category,
        location: e.location,
        date: at(now, e.days, e.time),
        registrationDeadline: e.reg !== null ? at(now, e.reg, '23:59') : null,
      },
    });
  }
  return orgs;
}

export async function ensureDemoUser() {
  const existing = await prisma.user.findUnique({ where: { email: config.demo.email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email: config.demo.email,
      passwordHash: await bcrypt.hash(config.demo.password, 10),
      name: 'Nusrat',
      isDemo: true,
      onboarded: true,
    },
  });
}

/** Returns the demo user, regenerating its data when stale so "due tomorrow" stays true. */
export async function getFreshDemoUser(now: Date = new Date()) {
  const user = await ensureDemoUser();
  const stale = !user.demoSeededAt || now.getTime() - user.demoSeededAt.getTime() > config.demo.refreshAfterHours * MS_PER_HOUR;
  if (stale) await seedDemoData(user.id, now);
  return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
}

/** Wipes and regenerates realistic demo data for a user, with all dates relative to `now`. */
export async function seedDemoData(userId: string, now: Date = new Date(), forceCampus = false) {
  const orgs = await ensureCampus(now, forceCampus);

  await prisma.$transaction([
    prisma.course.deleteMany({ where: { userId } }),
    prisma.task.deleteMany({ where: { userId } }),
    prisma.event.deleteMany({ where: { userId } }),
    prisma.studySession.deleteMany({ where: { userId } }),
    prisma.note.deleteMany({ where: { userId } }),
    prisma.careerGoal.deleteMany({ where: { userId } }),
    prisma.skill.deleteMany({ where: { userId } }),
    prisma.productivityRecord.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.notionSyncLog.deleteMany({ where: { userId } }),
    prisma.notionConnection.deleteMany({ where: { userId } }),
    prisma.orgEventInterest.deleteMany({ where: { userId } }),
  ]);

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: 'Nusrat',
      university: 'United International University',
      degree: 'BSc in Computer Science and Engineering',
      semester: '12th Semester',
      semesterStart: startOfDay(addDays(now, -49)),
      semesterEnd: startOfDay(addDays(now, 49)),
      studyHoursPerWeek: 18,
      preferredStudyTime: 'evening',
      careerGoal: 'Software Engineering Internship',
      onboarded: true,
      demoSeededAt: now,
    },
  });

  const mk = (data: { name: string; code: string; instructor: string; credits: number; color: string; schedule: object[]; notes: string }) =>
    prisma.course.create({ data: { userId, semester: '12th Semester', ...data, schedule: JSON.stringify(data.schedule) } });

  const db = await mk({ name: 'Database Management Systems', code: 'CSE 3521', instructor: 'Dr. Mohammad Rahman', credits: 3, color: '#6366f1', notes: 'Grading: 2 assignments (20%), mid (30%), final (40%), attendance (10%).', schedule: [{ day: 0, start: '09:30', end: '10:50', room: 'Room 602' }, { day: 3, start: '09:30', end: '10:50', room: 'Room 602' }] });
  const cn = await mk({ name: 'Computer Networks', code: 'CSE 3711', instructor: 'Dr. Farhana Akter', credits: 3, color: '#0ea5e9', notes: 'Textbook: Kurose & Ross, Computer Networking: A Top-Down Approach (8th ed).', schedule: [{ day: 1, start: '11:00', end: '12:20', room: 'Room 504' }, { day: 4, start: '11:00', end: '12:20', room: 'Room 504' }] });
  const se = await mk({ name: 'Software Engineering', code: 'CSE 3411', instructor: 'Prof. Kamrul Hasan', credits: 3, color: '#10b981', notes: 'Semester project: team of 4 building a campus lost-and-found app using Scrum.', schedule: [{ day: 2, start: '14:00', end: '15:20', room: 'Room 310' }, { day: 6, start: '14:00', end: '15:20', room: 'Room 310' }] });
  const ai = await mk({ name: 'Artificial Intelligence', code: 'CSE 4121', instructor: 'Dr. Ayesha Siddiqua', credits: 3, color: '#f59e0b', notes: 'Labs in Python. Weekly quizzes on Sundays.', schedule: [{ day: 0, start: '12:30', end: '13:50', room: 'Room 701' }, { day: 3, start: '12:30', end: '13:50', room: 'Room 701' }] });
  const fyp = await mk({ name: 'Final Year Design Project II', code: 'CSE 4000', instructor: 'Dr. Ayesha Siddiqua', credits: 2, color: '#ec4899', notes: 'Thesis: Federated learning for privacy-preserving campus health monitoring.', schedule: [{ day: 6, start: '10:00', end: '11:30', room: 'Research Lab' }, { day: 1, start: '15:30', end: '17:00', room: 'Research Lab' }] });

  await prisma.assignment.createMany({
    data: [
      { userId, courseId: db.id, title: 'Database Assignment 3: ER Diagram & Normalization', description: 'Design the ER diagram for a university library system, map it to relations and normalise to 3NF/BCNF with justification.', deadline: at(now, 1, '23:59'), estimatedHours: 2.5, priority: 'high', status: 'in_progress', progress: 40, difficulty: 'medium' },
      { userId, courseId: se.id, title: 'Software Engineering Sprint Review Presentation', description: '10-minute team presentation: sprint goals, burndown chart, demo and retrospective.', deadline: at(now, 7, '14:00'), estimatedHours: 4, priority: 'high', status: 'in_progress', progress: 20, difficulty: 'medium' },
      { userId, courseId: ai.id, title: 'AI Lab 5: A* Search on Grid Maps', description: 'Implement A* with Manhattan and Euclidean heuristics; compare node expansions with BFS and UCS.', deadline: at(now, 6, '23:59'), estimatedHours: 3, priority: 'medium', status: 'not_started', progress: 0, difficulty: 'hard' },
      { userId, courseId: cn.id, title: 'Socket Programming Lab Report', description: 'Multi-client TCP chat server in Python + report on observed throughput with Wireshark captures.', deadline: at(now, 10, '23:59'), estimatedHours: 3, priority: 'medium', status: 'not_started', progress: 0, difficulty: 'medium' },
      { userId, courseId: fyp.id, title: 'Thesis Chapter 3: Methodology Draft', description: 'Describe the federated learning setup, datasets, non-IID partitioning and evaluation metrics.', deadline: at(now, 14, '23:59'), estimatedHours: 6, priority: 'high', status: 'in_progress', progress: 30, difficulty: 'hard' },
      { userId, courseId: db.id, title: 'Database Assignment 2: Advanced SQL Queries', description: 'Joins, nested queries, window functions on the Sakila dataset.', deadline: at(now, -6, '23:59'), estimatedHours: 3, priority: 'medium', status: 'completed', progress: 100, difficulty: 'medium', completedAt: at(now, -7, '21:10') },
      { userId, courseId: ai.id, title: 'AI Lab 4: Minimax with Alpha-Beta Pruning', description: 'Tic-tac-toe agent with alpha-beta pruning.', deadline: at(now, -3, '23:59'), estimatedHours: 2.5, priority: 'medium', status: 'completed', progress: 100, difficulty: 'medium', completedAt: at(now, -4, '20:30') },
    ],
  });

  await prisma.exam.createMany({
    data: [
      { userId, courseId: cn.id, name: 'Computer Networks Midterm', date: at(now, 4, '10:00'), location: 'Room 504', preparation: 35, topics: 'Application Layer (HTTP, DNS)\nTransport Layer\nTCP Congestion Control\nNetwork Layer & IP Addressing\nRouting Algorithms: Link State, Distance Vector' },
      { userId, courseId: ai.id, name: 'AI Quiz 3', date: at(now, 9, '12:30'), location: 'Room 701', preparation: 20, topics: 'Informed Search & Heuristics\nAdversarial Search\nConstraint Satisfaction Problems' },
      { userId, courseId: se.id, name: 'Software Engineering Midterm', date: at(now, 15, '14:00'), location: 'Room 310', preparation: 10, topics: 'Software Process Models\nRequirements Engineering\nUML Diagrams\nAgile & Scrum\nSoftware Testing' },
      { userId, courseId: db.id, name: 'Database Final Exam', date: at(now, 28, '09:30'), location: 'Hall 2', preparation: 5, topics: 'ER Modelling\nRelational Algebra\nSQL\nNormalization\nTransactions & Concurrency\nIndexing & B+ Trees' },
    ],
  });

  const internship = await prisma.careerGoal.create({
    data: {
      userId,
      title: 'Land a Software Engineering Internship',
      description: 'Secure a summer SWE internship at a product company in Dhaka or remote.',
      category: 'internship',
      target: 'Offer from at least one company',
      deadline: addDays(now, 45),
      milestones: {
        create: [
          { title: 'Resume completed', done: true, order: 0, completedAt: addDays(now, -30) },
          { title: 'GitHub profile updated with pinned projects', done: true, order: 1, completedAt: addDays(now, -21) },
          { title: 'LinkedIn profile optimized', done: true, order: 2, completedAt: addDays(now, -18) },
          { title: 'Solve 50 LeetCode problems', done: true, order: 3, completedAt: addDays(now, -9) },
          { title: 'Mock interview with a mentor', done: true, order: 4, completedAt: addDays(now, -5) },
          { title: 'Portfolio website live', done: false, order: 5 },
          { title: 'Apply to 10 companies', done: false, order: 6 },
          { title: 'Complete interview preparation (DSA + system design)', done: false, order: 7 },
        ],
      },
    },
  });
  const thesisGoal = await prisma.careerGoal.create({
    data: {
      userId,
      title: 'Publish Undergraduate Thesis Paper',
      description: 'Turn the FYDP research into a conference paper.',
      category: 'research',
      target: 'Submit to an IEEE conference',
      deadline: addDays(now, 120),
      milestones: { create: [
        { title: 'Finalize research topic', done: true, order: 0, completedAt: addDays(now, -60) },
        { title: 'Literature review (25 papers)', done: true, order: 1, completedAt: addDays(now, -20) },
        { title: 'Run baseline experiments', done: false, order: 2 },
        { title: 'Write paper draft', done: false, order: 3 },
        { title: 'Submit to conference', done: false, order: 4 },
      ] },
    },
  });
  await prisma.careerGoal.create({
    data: {
      userId,
      title: 'Prepare for IELTS (Band 7.5)',
      description: "Needed for master's applications next year.",
      category: 'higher-study',
      target: 'Overall band 7.5',
      deadline: addDays(now, 90),
      milestones: { create: [
        { title: 'Take a diagnostic test', done: true, order: 0, completedAt: addDays(now, -14) },
        { title: 'Writing Task 2: 10 practice essays', done: false, order: 1 },
        { title: 'Speaking mock tests x3', done: false, order: 2 },
      ] },
    },
  });

  const skill = (name: string, category: string, currentLevel: number, targetLevel: number, resources: { title: string; url: string }[]) =>
    prisma.skill.create({ data: { userId, name, category, currentLevel, targetLevel, resources: JSON.stringify(resources) } });
  const dsa = await skill('Data Structures & Algorithms', 'technical', 6, 9, [{ title: 'NeetCode 150', url: 'https://neetcode.io/practice' }]);
  await skill('Python', 'technical', 7, 9, [{ title: 'Fluent Python', url: 'https://www.oreilly.com/library/view/fluent-python-2nd/9781492056348/' }]);
  await skill('Java', 'technical', 6, 8, [{ title: 'Java Programming MOOC', url: 'https://java-programming.mooc.fi/' }]);
  await skill('C++', 'technical', 6, 7, [{ title: 'learncpp.com', url: 'https://www.learncpp.com/' }]);
  const react = await skill('React', 'technical', 5, 8, [{ title: 'React docs', url: 'https://react.dev/learn' }]);
  await skill('SQL', 'technical', 6, 9, [{ title: 'CS50 SQL', url: 'https://cs50.harvard.edu/sql/' }]);
  await skill('Machine Learning', 'technical', 4, 8, [{ title: 'Andrew Ng — ML Specialization', url: 'https://www.coursera.org/specializations/machine-learning-introduction' }]);
  await skill('Networking', 'technical', 5, 8, [{ title: 'Kurose & Ross lectures', url: 'https://gaia.cs.umass.edu/kurose_ross/lectures.php' }]);
  await skill('Cybersecurity', 'technical', 2, 6, [{ title: 'TryHackMe Pre-Security', url: 'https://tryhackme.com/path/outline/presecurity' }]);
  await skill('Communication', 'soft', 6, 8, [{ title: 'Toastmasters tips', url: 'https://www.toastmasters.org/resources' }]);

  const T = (data: { title: string } & Record<string, unknown>) => ({ userId, ...data }) as Prisma.TaskCreateManyInput;
  await prisma.task.createMany({
    data: [
      T({ title: 'Submit internship application — Brain Station 23', category: 'career', priority: 'high', dueDate: at(now, 5, '23:59'), estimatedMinutes: 45, careerGoalId: internship.id, tags: 'internship,application' }),
      T({ title: 'Improve CV: quantify impact of database project', category: 'career', priority: 'medium', dueDate: at(now, 3, '22:00'), estimatedMinutes: 20, careerGoalId: internship.id, tags: 'cv' }),
      T({ title: 'Build portfolio website hero & projects section', category: 'career', priority: 'medium', dueDate: at(now, 12, '22:00'), estimatedMinutes: 120, careerGoalId: internship.id, skillId: react.id, tags: 'portfolio,react' }),
      T({ title: 'LeetCode: 2 medium problems', category: 'career', priority: 'medium', dueDate: at(now, 0, '23:00'), estimatedMinutes: 45, recurrence: 'daily', skillId: dsa.id, tags: 'dsa' }),
      T({ title: 'Review Lecture 7 slides — TCP congestion control', courseId: cn.id, category: 'academic', priority: 'high', dueDate: at(now, 2, '21:00'), estimatedMinutes: 40, tags: 'revision,exam' }),
      T({ title: 'Solve CN past-paper questions (2023 & 2024 mid)', courseId: cn.id, category: 'academic', priority: 'high', dueDate: at(now, 3, '21:00'), estimatedMinutes: 60, tags: 'exam' }),
      T({ title: 'Design slides for sprint review presentation', courseId: se.id, category: 'academic', priority: 'high', status: 'in_progress', dueDate: at(now, 6, '20:00'), estimatedMinutes: 90, tags: 'presentation,team' }),
      T({ title: 'Read paper: Communication-Efficient Learning (FedAvg)', courseId: fyp.id, category: 'academic', priority: 'medium', dueDate: at(now, 8, '22:00'), estimatedMinutes: 60, careerGoalId: thesisGoal.id, tags: 'research,thesis' }),
      T({ title: 'Pay semester fee installment', category: 'personal', priority: 'high', dueDate: at(now, 4, '16:00'), estimatedMinutes: 15, tags: 'admin' }),
      T({ title: 'Weekly grocery & meal prep', category: 'personal', priority: 'low', dueDate: at(now, 2, '18:00'), estimatedMinutes: 60, recurrence: 'weekly', tags: 'life' }),
      T({ title: 'Prepare agenda for Computer Club meeting', category: 'organization', priority: 'medium', dueDate: at(now, 1, '17:00'), estimatedMinutes: 25, tags: 'club' }),
      T({ title: 'Back up thesis experiment notebooks', courseId: fyp.id, category: 'academic', priority: 'low', estimatedMinutes: 15, tags: 'thesis' }),
    ],
  });

  // Completed work over the last two weeks (drives productivity analytics).
  const completed: [string, number, string | null, string][] = [
    ['Finish DB Assignment 2 query write-up', -7, db.id, 'academic'],
    ['Watch AI lecture on CSPs', -10, ai.id, 'academic'],
    ['Update GitHub README for FYDP repo', -11, fyp.id, 'career'],
    ['Draft SE user stories for sprint 3', -9, se.id, 'academic'],
    ['Book mock interview with mentor', -8, null, 'career'],
    ['CN Lab 4: Wireshark HTTP analysis', -12, cn.id, 'academic'],
    ['Submit AI Lab 4', -4, ai.id, 'academic'],
    ['Thesis literature summary — 5 papers', -3, fyp.id, 'academic'],
    ['LeetCode: sliding window practice', -2, null, 'career'],
    ['Team stand-up notes for SE project', -2, se.id, 'academic'],
    ['Revise CN Application Layer (HTTP, DNS)', -4, cn.id, 'academic'],
    ['Renew library card', -1, null, 'personal'],
    ['Outline DB Assignment 3 ER diagram', -1, db.id, 'academic'],
    ['LeetCode: binary search problems', 0, null, 'career'],
  ];
  for (const [title, d, courseId, category] of completed) {
    const completedAt = d === 0 ? addMinutes(now, -45) : at(now, d, '20:15');
    await prisma.task.create({ data: { userId, title, courseId, category, status: 'done', priority: 'medium', estimatedMinutes: 40, dueDate: completedAt, completedAt } });
    await recordActivity(userId, completedAt, { tasksCompleted: 1 });
  }
  await recordActivity(userId, at(now, -7, '21:10'), { tasksCompleted: 1 });
  await recordActivity(userId, at(now, -4, '20:30'), { tasksCompleted: 1 });

  // Study sessions for the last 21 days. Computer Networks was last studied 4 days ago.
  const pattern: [number, string, number, string][] = [
    [-20, 'db', 60, '19:00'], [-19, 'ai', 45, '18:30'], [-18, 'cn', 50, '19:00'], [-17, 'se', 40, '20:00'],
    [-15, 'db', 90, '18:00'], [-14, 'fyp', 120, '10:00'], [-13, 'cn', 60, '19:00'], [-12, 'cn', 45, '20:00'],
    [-11, 'ai', 75, '18:00'], [-10, 'ai', 50, '19:30'], [-9, 'se', 60, '18:30'], [-8, 'fyp', 90, '10:00'],
    [-7, 'db', 100, '19:00'], [-6, 'fyp', 80, '11:00'], [-5, 'se', 45, '18:00'], [-4, 'cn', 70, '19:00'],
    [-4, 'ai', 50, '20:30'], [-3, 'fyp', 120, '10:30'], [-3, 'ai', 40, '19:00'], [-2, 'se', 60, '18:30'],
    [-2, 'db', 45, '20:00'], [-1, 'db', 75, '19:00'], [-1, 'fyp', 60, '21:00'],
  ];
  const byKey: Record<string, { id: string; name: string }> = { db, cn, se, ai, fyp };
  for (const [d, key, minutes, time] of pattern) {
    const course = byKey[key];
    const start = at(now, d, time);
    if (start > now) continue;
    await prisma.studySession.create({ data: { userId, courseId: course.id, title: `${course.name} study`, start, durationMinutes: minutes, type: minutes % 25 === 0 ? 'pomodoro' : 'focus' } });
    await recordActivity(userId, start, { studyMinutes: minutes, focusSessions: 1 });
  }

  const E = (title: string, type: string, start: Date, minutes: number, extra: Record<string, unknown> = {}) => ({ userId, title, type, start, end: addMinutes(start, minutes), ...extra });
  await prisma.event.createMany({
    data: [
      E('Gym — strength training', 'personal', at(now, 0, '07:00'), 60),
      E('Thesis meeting with Dr. Ayesha', 'academic', at(now, 2, '16:00'), 45, { courseId: fyp.id, location: 'Faculty Room 7th floor' }),
      E('SE team sprint planning', 'academic', at(now, 1, '19:30'), 60, { courseId: se.id, location: 'Google Meet' }),
      E('Spring Career & Internship Fair', 'career', at(now, 3, '10:00'), 240, { location: 'UIU Central Plaza', source: 'campus' }),
      E('Mock technical interview (peer)', 'career', at(now, 6, '20:00'), 60, { location: 'Discord' }),
      E('Family dinner', 'personal', at(now, 5, '20:00'), 120),
      E('Group revision: CN midterm', 'study', at(now, 2, '18:00'), 90, { courseId: cn.id, location: 'Library Room B' }),
    ],
  });

  await prisma.note.createMany({
    data: [
      { userId, courseId: cn.id, title: 'Lecture 7 — TCP Congestion Control', type: 'lecture', topic: 'Transport Layer', semester: '12th Semester', tags: 'tcp,congestion control,exam', content: '## Key ideas\n- Congestion window (cwnd) limits unacknowledged bytes in flight\n- Slow start: cwnd doubles every RTT until ssthresh\n- Congestion avoidance (AIMD): +1 MSS per RTT, halve on loss\n- Fast retransmit after 3 duplicate ACKs; fast recovery (TCP Reno)\n- TCP CUBIC is the Linux default\n## Exam tip\nDraw the cwnd vs. time graph for Tahoe vs Reno.' },
      { userId, courseId: cn.id, title: 'Transport Layer cheat sheet: TCP vs UDP', type: 'note', topic: 'Transport Layer', semester: '12th Semester', tags: 'tcp,udp,exam', content: 'TCP: connection-oriented, reliable, in-order, flow + congestion control, 3-way handshake.\nUDP: connectionless, no guarantees, 8-byte header, used by DNS, streaming, QUIC.' },
      { userId, courseId: db.id, title: 'Normalization summary (1NF → BCNF)', type: 'lecture', topic: 'Normalization', semester: '12th Semester', tags: 'normalization,fd,assignment', content: '- 1NF: atomic values\n- 2NF: no partial dependency on a composite key\n- 3NF: no transitive dependency on the key\n- BCNF: every determinant is a candidate key\nAlways list functional dependencies first, then compute closures.' },
      { userId, courseId: ai.id, title: 'Search algorithms comparison', type: 'note', topic: 'Search', semester: '12th Semester', tags: 'a*,heuristics,lab', content: 'A* is optimal with an admissible heuristic; consistent ⇒ no re-expansion.\nManhattan distance for 4-way grids, Euclidean/octile for 8-way.' },
      { userId, courseId: se.id, title: 'Scrum roles & ceremonies', type: 'note', topic: 'Agile', semester: '12th Semester', tags: 'scrum,agile', content: 'Roles: Product Owner, Scrum Master, Developers.\nEvents: Sprint planning, daily scrum, sprint review, retrospective.' },
      { userId, courseId: cn.id, title: 'Kurose & Ross — Computer Networking (8th ed.)', type: 'resource', topic: 'Textbook', semester: '12th Semester', tags: 'book', url: 'https://gaia.cs.umass.edu/kurose_ross/index.php', content: 'Chapters 2–4 are covered in the midterm.' },
      { userId, courseId: db.id, title: 'CS50 SQL lectures', type: 'link', topic: 'SQL', tags: 'sql,video', url: 'https://cs50.harvard.edu/sql/', content: 'Great refresher for joins and indexing.' },
      { userId, courseId: fyp.id, title: 'Thesis: related work on FedProx', type: 'research', topic: 'Federated Learning', tags: 'thesis,fedprox,research', content: 'FedProx adds a proximal term to handle system heterogeneity. Compare against FedAvg on non-IID splits (Dirichlet α=0.5).' },
      { userId, title: 'Portfolio website plan', type: 'project', topic: 'Portfolio', tags: 'portfolio,react,career', content: 'Stack: React + Vite + Tailwind. Sections: hero, projects (StudentOS, FYDP), skills, contact. Deploy on Vercel.' },
    ],
  });

  const hack = await prisma.organizationEvent.findFirst({ where: { title: 'UIU CSE Fest Hackathon 2026' } });
  const contest = await prisma.organizationEvent.findFirst({ where: { title: 'Intra-UIU Programming Contest' } });
  const fair = await prisma.organizationEvent.findFirst({ where: { title: 'Spring Career & Internship Fair' } });
  if (hack) {
    const cal = await prisma.event.create({ data: { userId, title: hack.title, type: 'career', start: hack.date, end: addMinutes(hack.date, 24 * 60), location: hack.location, source: 'campus' } });
    await prisma.orgEventInterest.create({ data: { userId, eventId: hack.id, status: 'registered', calendarEventId: cal.id } });
  }
  if (contest) await prisma.orgEventInterest.create({ data: { userId, eventId: contest.id, status: 'interested' } });
  if (fair) await prisma.orgEventInterest.create({ data: { userId, eventId: fair.id, status: 'saved' } });

  await prisma.notionConnection.create({
    data: { userId, mode: 'demo', status: 'connected', workspaceName: 'Demo Notion Workspace (simulated)', targetTitle: 'StudentOS Hub (demo)', targetType: 'database', lastSyncedAt: addMinutes(now, -95) },
  });
  await prisma.notionSyncLog.createMany({
    data: [
      { userId, mode: 'demo', direction: 'export', itemType: 'tasks', count: 12, message: 'Simulated: 12 new, 0 updated (demo mode — no data sent to Notion)', createdAt: addMinutes(now, -95) },
      { userId, mode: 'demo', direction: 'import', itemType: 'notes', count: 0, message: 'Simulated import from the demo workspace: 0 new', createdAt: addMinutes(now, -94) },
    ],
  });

  void orgs;
}
