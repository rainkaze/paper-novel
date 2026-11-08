import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const FIXTURE_PATH = 'e2e/fixtures/雾中的车站.txt';
const DOCUMENT_TITLE = '雾中的车站';

async function pageState(page: Page) {
  const label = await page.locator('.pager span').textContent();
  const [current, total] = (label ?? '').split('/').map((part) => Number(part.trim()));
  return { current, total };
}

async function importFixture(page: Page) {
  await page.getByTestId('txt-file-input').setInputFiles(FIXTURE_PATH);
  await expect(page.getByTestId('current-document-title')).toContainText(DOCUMENT_TITLE);
  await expect(page.getByTestId('bookshelf-item').filter({ hasText: DOCUMENT_TITLE })).toBeVisible();
}

test('persists imported books and reopens them from the bookshelf', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.getByTestId('bookshelf-empty')).toBeVisible();
  await importFixture(page);
  await expect(page.getByTestId('txt-import-note')).toContainText('已保存到本地书架，刷新后仍会保留。');

  await page.reload();
  await expect(page.getByTestId('current-document-title')).toContainText(DOCUMENT_TITLE);
  await expect(page.getByTestId('bookshelf-item').filter({ hasText: DOCUMENT_TITLE })).toBeVisible();

  await page.getByTestId('restore-fixture-button').click();
  await expect(page.getByTestId('current-document-title')).toContainText('示例文本');
  await expect(page.getByTestId('bookshelf-item').filter({ hasText: DOCUMENT_TITLE })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('current-document-title')).toContainText(DOCUMENT_TITLE);

  await page.getByTestId('restore-fixture-button').click();
  await expect(page.getByTestId('current-document-title')).toContainText('示例文本');
  await page.getByTestId('bookshelf-item').filter({ hasText: DOCUMENT_TITLE }).getByTestId('bookshelf-open').click();
  await expect(page.getByTestId('current-document-title')).toContainText(DOCUMENT_TITLE);

  await page.getByRole('button', { name: '18px' }).click();
  await expect.poll(async () => (await pageState(page)).total).toBeGreaterThan(1);
  const total = (await pageState(page)).total;
  const pageTexts: string[] = [];
  for (let index = 1; index <= total; index += 1) {
    await expect.poll(async () => (await pageState(page)).current).toBe(index);
    pageTexts.push((await page.getByTestId('explicit-page-content').textContent()) ?? '');
    if (index < total) {
      await page.getByRole('button', { name: 'Next →' }).click();
    }
  }

  const normalize = (value: string) => value.replace(/\s+/g, '');
  expect(normalize(pageTexts.join(''))).toBe(normalize(readFileSync(FIXTURE_PATH, 'utf8')));
});

test('deletes a book and keeps an empty bookshelf after refresh', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByTestId('bookshelf-empty')).toBeVisible();
  await importFixture(page);

  const item = page.getByTestId('bookshelf-item').filter({ hasText: DOCUMENT_TITLE });
  await item.getByTestId('bookshelf-delete').click();
  await expect(page.getByTestId('bookshelf-confirm-delete')).toBeVisible();
  await page.getByTestId('bookshelf-confirm-delete').click();

  await expect(page.getByTestId('bookshelf-empty')).toBeVisible();
  await expect(page.getByTestId('bookshelf-item')).toHaveCount(0);
  await expect(page.getByTestId('current-document-title')).toContainText('示例文本');

  await page.reload();
  await expect(page.getByTestId('bookshelf-empty')).toBeVisible();
  await expect(page.getByTestId('bookshelf-item')).toHaveCount(0);
  await expect(page.getByTestId('current-document-title')).toContainText('示例文本');
});
