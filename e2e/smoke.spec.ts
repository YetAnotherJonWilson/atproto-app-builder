import { test, expect } from '@playwright/test';
import JSZip from 'jszip';

test('landing → wizard → add requirement → download valid zip', async ({ page }) => {
  const consoleErrors: string[] = [];
  const networkFailures: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('response', (res) => {
    const status = res.status();
    if (status < 400) return;
    const url = res.url();
    if (!url.startsWith('http://localhost')) return;
    if (url.includes('/@vite/') || url.includes('/@fs/') || url.endsWith('/favicon.ico')) return;
    networkFailures.push(`${status} ${res.request().method()} ${url}`);
  });

  // ── Landing page ────────────────────────────────────────────────────
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'RecLaIm The Web' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'CENTRALIZED', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'DECENTRALIZED' })).toBeVisible();

  await page.getByRole('button', { name: /Start Building/ }).click();

  // ── App-name dialog ─────────────────────────────────────────────────
  const appNameInput = page.getByRole('textbox', { name: 'e.g., My Recipe App' });
  await expect(appNameInput).toBeVisible();
  await appNameInput.fill('Smoke Test App');
  await page.getByRole('button', { name: /Let.*s go/ }).click();

  await expect(page).toHaveURL(/\/wizard\?section=requirements/);
  await expect(page.getByRole('heading', { name: 'the App Wizard' })).toBeVisible();

  // ── Welcome dialog (first-visit) ────────────────────────────────────
  // Dismiss via stable id, and wait deterministically so we don't race.
  const welcomeDismiss = page.locator('#welcome-dismiss');
  await expect(welcomeDismiss).toBeVisible();
  await welcomeDismiss.click();
  await expect(welcomeDismiss).toHaveCount(0);

  // ── Requirements panel ──────────────────────────────────────────────
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

  // ── Navigate through remaining panels ───────────────────────────────
  await sidebar.getByRole('heading', { name: 'Data' }).click();
  await expect(page).toHaveURL(/section=data/);
  await expect(page.getByRole('heading', { name: 'Define Data' })).toBeVisible();

  await sidebar.getByRole('heading', { name: 'Components' }).click();
  await expect(page).toHaveURL(/section=components/);

  await sidebar.getByRole('heading', { name: 'Views' }).click();
  await expect(page).toHaveURL(/section=views/);

  // ── Generate panel + ZIP download ───────────────────────────────────
  await sidebar.getByRole('heading', { name: 'Generate' }).click();
  await expect(page).toHaveURL(/section=generate/);
  await expect(page.getByRole('heading', { name: 'App Identity' })).toBeVisible();

  const downloadBtn = page.locator('#gen-download-btn');
  await expect(downloadBtn).toBeEnabled();
  await downloadBtn.click();

  // Confirmation dialog → kick off the download.
  const confirmBtn = page.locator('#gen-confirm-btn');
  await expect(confirmBtn).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    confirmBtn.click(),
  ]);

  // Unzip in memory — Playwright cleans the download file on context close,
  // and we never write it out, so nothing accumulates on disk.
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const buf = Buffer.concat(chunks);
  const zip = await JSZip.loadAsync(buf);

  const fileNames = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const required = [
    'package.json',
    'index.html',
    'vite.config.ts',
    'tsconfig.json',
    'styles.css',
    'src/main.ts',
    'src/router.ts',
    'src/atproto/auth.ts',
    'README.md',
  ];
  for (const name of required) {
    expect(fileNames, `zip missing ${name}`).toContain(name);
  }

  const pkgJsonEntry = zip.file('package.json');
  expect(pkgJsonEntry, 'package.json missing').not.toBeNull();
  const pkgJson = JSON.parse(await pkgJsonEntry!.async('string'));
  expect(pkgJson.name).toBeTruthy();
  expect(typeof pkgJson.name).toBe('string');

  const indexHtml = await zip.file('index.html')!.async('string');
  expect(indexHtml).toContain('Smoke Test App');

  // ── Persistence check ───────────────────────────────────────────────
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'App Name *' })).toHaveValue(
    'Smoke Test App',
  );
  await expect(
    page.locator('.sidebar-section[data-section="requirements"] .sidebar-item'),
  ).toContainText(/I need to know how this/);

  expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
  expect(networkFailures, `network failures: ${networkFailures.join(' | ')}`).toEqual([]);
});
