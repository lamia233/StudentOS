import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the real API + Vite dev server.
 * Existing servers on :4000/:5173 are reused; otherwise `npm run dev` is started from the repo root.
 * Set PW_CHROME_PATH to use a locally installed Chrome instead of `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...(process.env.PW_CHROME_PATH ? { launchOptions: { executablePath: process.env.PW_CHROME_PATH } } : {}),
  },
  projects: [
    { name: 'desktop', testIgnore: /mobile\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: '..',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
