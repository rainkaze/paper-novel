import { expect, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';

const FIXTURE_PATH = 'e2e/fixtures/雾中的车站.txt';
const DOCUMENT_TITLE = '雾中的车站';

async function pageState(page: Page) {
  const label = await page.locator('.pager span').textContent();
  const [current, total] = (label ?? '').split('/').map((part) => Number(part.trim()));
  return { current, total };
}

test('imports a UTF-8 TXT document into memory and restores the fixture', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.getByTestId('reading-workspace')).toBeVisible();
  const fixtureSource = await page.getByTestId('fixture-source').textContent();
  await expect(page.getByTestId('current-document-title')).toContainText('示例文本');

  await page.getByTestId('txt-file-input').setInputFiles(FIXTURE_PATH);
  await expect(page.getByTestId('current-document-title')).toContainText(DOCUMENT_TITLE);
  await expect(page.getByTestId('front-matter-title')).toContainText(DOCUMENT_TITLE);
  await expect(page.getByTestId('txt-import-note')).toContainText('当前导入仅保存在内存中，刷新后恢复示例文本');
  await expect(page.getByTestId('txt-import-error')).toHaveCount(0);
  await expect(page.getByTestId('restore-fixture-button')).toBeEnabled();

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

  await page.getByRole('button', { name: '← Previous' }).click();
  await expect.poll(async () => (await pageState(page)).current).toBe(total - 1);

  await page.getByTestId('restore-fixture-button').click();
  await expect(page.getByTestId('current-document-title')).toContainText('示例文本');
  await expect(page.getByTestId('front-matter-title')).toContainText('An Empirical Study of Narrative Structure');
  await expect(page.getByTestId('txt-import-note')).toHaveCount(0);
  expect(await page.getByTestId('fixture-source').textContent()).toBe(fixtureSource);

  await page.getByTestId('txt-file-input').setInputFiles(FIXTURE_PATH);
  await expect(page.getByTestId('current-document-title')).toContainText(DOCUMENT_TITLE);
  await page.reload();
  await expect(page.getByTestId('current-document-title')).toContainText('示例文本');
  await expect(page.getByTestId('front-matter-title')).toContainText('An Empirical Study of Narrative Structure');
  await expect(page.getByTestId('txt-import-note')).toHaveCount(0);
  expect(await page.getByTestId('fixture-source').textContent()).toBe(fixtureSource);
});

test('shows a readable error for non-UTF-8 input', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('current-document-title')).toContainText('示例文本');

  await page.getByTestId('txt-file-input').setInputFiles({
    name: 'gbk.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from([0xb2, 0xe2, 0xca, 0xd4]),
  });

  await expect(page.getByTestId('txt-import-error')).toContainText('暂不支持非 UTF-8 编码，请转换后重试');
  await expect(page.getByTestId('current-document-title')).toContainText('示例文本');
  await expect(page.getByTestId('restore-fixture-button')).toBeDisabled();
});
