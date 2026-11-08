import { expect, test, type Page } from '@playwright/test';

const BOOK_A = 'e2e/fixtures/夜航日志.txt';
const TITLE_A = '夜航日志';
const BOOK_B = 'e2e/fixtures/雾中的车站.txt';
const TITLE_B = '雾中的车站';

async function pageState(page: Page) {
  const label = await page.locator('.pager span').textContent();
  const [current, total] = (label ?? '').split('/').map((part) => Number(part.trim()));
  return { current, total, label: label ?? '' };
}

function shelfItem(page: Page, title: string) {
  return page.getByTestId('bookshelf-item').filter({ hasText: title });
}

function progressSpan(page: Page, title: string) {
  return shelfItem(page, title).getByTestId('bookshelf-progress');
}

async function importBook(page: Page, path: string, title: string) {
  await page.getByTestId('txt-file-input').setInputFiles(path);
  await expect(page.getByTestId('current-document-title')).toContainText(title);
  await expect(shelfItem(page, title)).toBeVisible();
}

async function waitForSavedProgress(page: Page, title: string) {
  await expect.poll(async () => {
    const state = await pageState(page);
    const text = (await shelfItem(page, title).getByTestId('bookshelf-progress').textContent())?.trim();
    return text === `第 ${state.current} / ${state.total} 页`;
  }).toBe(true);
}

async function currentPageText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const label = document.querySelector('.pager span')?.textContent ?? '';
    const current = Number(label.split('/')[0]);
    const explicit = document.querySelector('[data-testid="explicit-page-content"]');
    if (explicit) return explicit.textContent ?? '';
    const pages = document.querySelectorAll('[data-testid="logical-page-content"]');
    return pages[Math.max(0, (Number.isFinite(current) ? current : 1) - 1)]?.textContent ?? '';
  });
}

test('restores reading position, font size and view mode', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await expect(page.getByTestId('bookshelf-empty')).toBeVisible();
  await importBook(page, BOOK_A, TITLE_A);

  await page.getByRole('button', { name: '18px' }).click();
  await expect.poll(async () => (await pageState(page)).total).toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect.poll(async () => (await pageState(page)).current).toBe(2);
  await waitForSavedProgress(page, TITLE_A);
  await expect(progressSpan(page, TITLE_A)).toHaveAttribute('data-font-size', '18');

  const anchor = ((await page.locator('[data-testid="explicit-page-content"] .body-paragraph').first().textContent()) ?? '').slice(0, 24);
  expect(anchor.length).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByTestId('current-document-title')).toContainText(TITLE_A);
  await expect(page.getByRole('button', { name: '18px' })).toHaveClass(/active/);
  await expect.poll(async () => (await pageState(page)).current).toBe(2);
  await expect.poll(async () => (await currentPageText(page)).includes(anchor)).toBe(true);
  await waitForSavedProgress(page, TITLE_A);

  await page.getByRole('button', { name: '14px' }).click();
  await expect(page.getByRole('button', { name: '14px' })).toHaveClass(/active/);
  await expect.poll(async () => (await currentPageText(page)).includes(anchor)).toBe(true);
  await waitForSavedProgress(page, TITLE_A);
  await expect(progressSpan(page, TITLE_A)).toHaveAttribute('data-font-size', '14');
  const afterFont = await pageState(page);

  await page.reload();
  await expect(page.getByRole('button', { name: '14px' })).toHaveClass(/active/);
  await expect.poll(async () => (await pageState(page)).current).toBe(afterFont.current);
  await expect.poll(async () => (await currentPageText(page)).includes(anchor)).toBe(true);
  await waitForSavedProgress(page, TITLE_A);

  await page.getByRole('button', { name: 'CSS Columns' }).click();
  await expect(page.getByRole('button', { name: 'CSS Columns' })).toHaveClass(/active/);
  await expect.poll(async () => (await currentPageText(page)).includes(anchor)).toBe(true);
  await waitForSavedProgress(page, TITLE_A);
  await expect(progressSpan(page, TITLE_A)).toHaveAttribute('data-mode', 'css-columns');
  const afterMode = await pageState(page);

  await page.reload();
  await expect(page.getByRole('button', { name: 'CSS Columns' })).toHaveClass(/active/);
  await expect(page.getByRole('button', { name: '14px' })).toHaveClass(/active/);
  await expect.poll(async () => (await pageState(page)).current).toBe(afterMode.current);
  await expect.poll(async () => (await currentPageText(page)).includes(anchor)).toBe(true);
  await waitForSavedProgress(page, TITLE_A);
});

test('keeps independent progress per book and clears progress on deletion', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await expect(page.getByTestId('bookshelf-empty')).toBeVisible();

  await importBook(page, BOOK_A, TITLE_A);
  await page.getByRole('button', { name: '18px' }).click();
  await expect.poll(async () => (await pageState(page)).total).toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect.poll(async () => (await pageState(page)).current).toBe(2);
  await waitForSavedProgress(page, TITLE_A);
  await expect(progressSpan(page, TITLE_A)).toHaveAttribute('data-font-size', '18');
  const progressA = await pageState(page);

  await importBook(page, BOOK_B, TITLE_B);
  await page.getByRole('button', { name: '14px' }).click();
  await expect.poll(async () => (await pageState(page)).current).toBe(1);
  await waitForSavedProgress(page, TITLE_B);
  await expect(progressSpan(page, TITLE_B)).toHaveAttribute('data-font-size', '14');
  const progressB = await pageState(page);

  await shelfItem(page, TITLE_A).getByTestId('bookshelf-open').click();
  await expect(page.getByTestId('current-document-title')).toContainText(TITLE_A);
  await expect(page.getByRole('button', { name: '18px' })).toHaveClass(/active/);
  await expect.poll(async () => (await pageState(page)).current).toBe(progressA.current);
  await expect(shelfItem(page, TITLE_A).getByTestId('bookshelf-item-current')).toBeVisible();
  await expect(progressSpan(page, TITLE_A)).toHaveAttribute('data-font-size', '18');

  await shelfItem(page, TITLE_B).getByTestId('bookshelf-open').click();
  await expect(page.getByTestId('current-document-title')).toContainText(TITLE_B);
  await expect(page.getByRole('button', { name: '14px' })).toHaveClass(/active/);
  await expect.poll(async () => (await pageState(page)).current).toBe(progressB.current);
  await expect(progressSpan(page, TITLE_B)).toHaveAttribute('data-font-size', '14');

  await shelfItem(page, TITLE_A).getByTestId('bookshelf-delete').click();
  await page.getByTestId('bookshelf-confirm-delete').click();
  await expect(shelfItem(page, TITLE_A)).toHaveCount(0);

  await importBook(page, BOOK_A, TITLE_A);
  await expect.poll(async () => (await pageState(page)).current).toBe(1);
  await waitForSavedProgress(page, TITLE_A);
  await expect(progressSpan(page, TITLE_A)).toHaveAttribute('data-font-size', '14');
  expect((await pageState(page)).current).toBe(1);
});
