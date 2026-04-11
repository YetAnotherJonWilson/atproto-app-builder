import { test, expect } from '@playwright/test';

test('landing → wizard → add requirement → all panels render', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'RecLaIm The Web' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'CENTRALIZED', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'DECENTRALIZED' })).toBeVisible();

  await page.getByRole('button', { name: /Start Building/ }).click();

  const appNameInput = page.getByRole('textbox', { name: 'e.g., My Recipe App' });
  await expect(appNameInput).toBeVisible();
  await appNameInput.fill('Smoke Test App');
  await page.getByRole('button', { name: /Let.*s go/ }).click();

  await expect(page).toHaveURL(/\/wizard\?section=requirements/);
  await expect(page.getByRole('heading', { name: 'the App Wizard' })).toBeVisible();

  const welcome = page.getByRole('button', { name: /Got it/ });
  if (await welcome.isVisible().catch(() => false)) {
    await welcome.click();
  }

  await expect(page.getByRole('heading', { name: 'Define Requirements' })).toBeVisible();
  await page.getByRole('button', { name: /Add Your First Requirement/ }).click();

  const description = page.getByRole('textbox', { name: /I need to know how this/ });
  await description.fill('I need to know how this app protects my data');
  await page.getByRole('button', { name: 'Add Requirement' }).click();

  const reqList = page.locator('#req-list');
  await expect(
    reqList.getByText('I need to know how this app protects my data'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible();

  const sidebar = page.locator('aside, [role="complementary"]').first();
  await expect(sidebar.getByRole('heading', { name: 'Requirements' })).toBeVisible();
  await expect(sidebar.getByText(/Know: I need to know how this/)).toBeVisible();

  await sidebar.getByRole('heading', { name: 'Data' }).click();
  await expect(page).toHaveURL(/section=data/);
  await expect(page.getByRole('heading', { name: 'Define Data' })).toBeVisible();

  await sidebar.getByRole('heading', { name: 'Components' }).click();
  await expect(page).toHaveURL(/section=components/);

  await sidebar.getByRole('heading', { name: 'Views' }).click();
  await expect(page).toHaveURL(/section=views/);

  await sidebar.getByRole('heading', { name: 'Generate' }).click();
  await expect(page).toHaveURL(/section=generate/);
  await expect(page.getByRole('heading', { name: 'App Identity' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download ZIP' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'App Name *' })).toHaveValue(
    'Smoke Test App',
  );
  await expect(
    page.locator('.sidebar-section[data-section="requirements"] .sidebar-item'),
  ).toContainText(/I need to know how this/);

  expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
