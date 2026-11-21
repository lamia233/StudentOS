import { expect, test } from '@playwright/test';

test('mobile dashboard and bottom navigation', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /demo account/i }).click();
  await page.waitForURL('**/app');
  await expect(page.getByText(/Good (morning|afternoon|evening), Nusrat/)).toBeVisible();
  const bottom = page.getByRole('navigation', { name: 'Quick' });
  await bottom.getByRole('link', { name: 'Tasks' }).click();
  await expect(page).toHaveURL(/\/app\/tasks/);
});
