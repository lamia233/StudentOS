import { expect, test, type Page } from '@playwright/test';

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true }).click();

test.describe.configure({ mode: 'serial' });

test('competition demo flow', async ({ page }) => {
  // 1-3. Landing → Try Demo → Dashboard
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('one smart workspace');
  await page.getByRole('button', { name: /try (the )?demo/i }).first().click();
  await page.waitForURL('**/app');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText(/Good (morning|afternoon|evening), Nusrat/)).toBeVisible();

  // 4. Today's priorities
  await expect(page.getByRole('heading', { name: "Today's priorities" })).toBeVisible();

  // 5-6. Deadline Radar shows the assignment due tomorrow
  await nav(page, 'Deadline Radar');
  await expect(page.getByRole('heading', { name: 'Deadline Radar' })).toBeVisible();
  await expect(page.getByText('Database Assignment 3: ER Diagram & Normalization').first()).toBeVisible();
  await expect(page.getByText('Tomorrow').first()).toBeVisible();

  // 7-8. Smart Study Planner → generate weekly plan
  await nav(page, 'Study Planner');
  await page.getByRole('button', { name: 'Generate weekly plan' }).first().click();
  await expect(page.getByText(/scheduled from \d+ items/)).toBeVisible();

  // 9-10. Calendar shows the upcoming exam
  await nav(page, 'Calendar');
  await page.getByRole('tab', { name: 'Week' }).click();
  await page.getByRole('tab', { name: 'Month' }).click();
  await expect(page.getByText(/Computer Networks/i).first()).toBeVisible();

  // 11-12. Career dashboard: internship goal progress
  await nav(page, 'Career');
  await expect(page.getByRole('img', { name: /internship.*% complete/i }).first()).toBeVisible();

  // 13-14. Focus Mode: start a session
  await nav(page, 'Focus Mode');
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByText('Focusing')).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Paused')).toBeVisible();

  // 15-16. Productivity analytics
  await nav(page, 'Productivity');
  await expect(page.getByText('Productivity score')).toBeVisible();
  await expect(page.getByText('Completion', { exact: true })).toBeVisible();

  // 17-18. Notion demo sync (clearly simulated)
  await nav(page, 'Notion');
  await expect(page.getByText('Demo mode — simulated sync')).toBeVisible();
  await page.getByRole('button', { name: 'Run demo sync' }).click();
  await expect(page.getByText(/nothing was sent to Notion/)).toBeVisible();

  // 19-21. Assistant answers from real data
  await nav(page, 'Assistant');
  await page.getByRole('button', { name: 'What should I prioritize today?' }).click();
  await expect(page.getByText(/I'd prioritize/)).toBeVisible();
  await expect(page.getByText('Computed from your StudentOS data', { exact: false })).toBeVisible();
});

test('register, create and complete a task', async ({ page }) => {
  const email = `e2e-${Date.now()}@test.dev`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('E2E Student');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  await page.getByLabel('University').fill('Test University');
  await page.getByLabel('Degree').fill('BSc in CSE');
  await page.getByLabel('Current semester').fill('Spring 2027');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await page.waitForURL('**/app');

  await page.goto('/app/tasks');
  await page.getByRole('button', { name: /new task/i }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Read chapter 4');
  await page.getByRole('button', { name: 'Create task' }).click();
  await page.getByRole('tab', { name: /all open/i }).click();
  await expect(page.getByText('Read chapter 4')).toBeVisible();
  await page.getByRole('button', { name: 'Complete Read chapter 4' }).click();
  await page.getByRole('tab', { name: /completed/i }).click();
  await expect(page.getByText('Read chapter 4')).toBeVisible();
});
