import { expect, test, type Page, type TestInfo } from '@playwright/test';

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const CONTENT_WIDTH = 670;
const CONTENT_HEIGHT = 985;
const COLUMN_WIDTH = 320.5;
const MAX_BOTTOM_GAP = 90;

async function openLongFixture(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.locator('.control-group select').selectOption('1');
  await expect(page.getByText('50,782 characters · artificial fixture')).toBeVisible();
  await expect(page.getByTestId('explicit-page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explicit pages' })).toHaveClass(/active/);
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const paper = document.querySelector<HTMLElement>('[data-testid="explicit-page"]')!;
    const content = paper.querySelector<HTMLElement>('[data-testid="explicit-page-content"]')!;
    const footer = paper.querySelector<HTMLElement>('.paper-footer')!;
    const pageNumber = footer.querySelector<HTMLElement>('span:last-child')!;
    const pager = document.querySelector<HTMLElement>('.pager')!;
    const columns = [...paper.querySelectorAll<HTMLElement>('.paper-column')];
    const rect = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const textBottom = Math.max(...columns.map((column) => Math.max(...[...column.children].map((child) => child.getBoundingClientRect().bottom))));
    const paperRect = paper.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const pageNumberRect = pageNumber.getBoundingClientRect();
    const pagerRect = pager.getBoundingClientRect();
    const label = document.querySelector<HTMLElement>('.pager span')!.textContent!;
    const [current, total] = label.split('/').map((part) => Number(part.trim()));
    return {
      label,
      currentPage: current,
      pageCount: total,
      paper: rect(paper),
      paperClientHeight: paper.clientHeight,
      paperScrollHeight: paper.scrollHeight,
      content: rect(content),
      contentClientHeight: content.clientHeight,
      contentScrollHeight: content.scrollHeight,
      contentClientWidth: content.clientWidth,
      contentScrollWidth: content.scrollWidth,
      columns: columns.map(rect),
      footer: rect(footer),
      pageNumber: rect(pageNumber),
      pager: rect(pager),
      textBottom,
      gapTextToContentBottom: contentRect.bottom - textBottom,
      gapContentToFooter: footerRect.top - contentRect.bottom,
      pagerGap: pagerRect.top - paperRect.bottom,
      footerInsidePaper: footerRect.bottom <= paperRect.bottom + 0.5 && footerRect.top >= paperRect.top,
      pageNumberInsidePaper: pageNumberRect.bottom <= paperRect.bottom + 0.5 && pageNumberRect.top >= footerRect.top,
      contentText: content.textContent ?? '',
    };
  });
}

type Metrics = Awaited<ReturnType<typeof measure>>;

function expectPageGeometry(metrics: Metrics, isLast: boolean) {
  expect(metrics.paper.width).toBeCloseTo(PAGE_WIDTH, 0);
  expect(metrics.paper.height).toBeCloseTo(PAGE_HEIGHT, 0);
  expect(metrics.paperScrollHeight).toBeLessThanOrEqual(metrics.paperClientHeight + 1);
  expect(metrics.content.width).toBeCloseTo(CONTENT_WIDTH, 0);
  expect(metrics.content.height).toBeCloseTo(CONTENT_HEIGHT, 0);
  expect(metrics.columns).toHaveLength(2);
  expect(metrics.columns[0].width).toBeCloseTo(COLUMN_WIDTH, 0);
  expect(metrics.columns[1].width).toBeCloseTo(COLUMN_WIDTH, 0);
  expect(metrics.columns[0].left).toBeLessThan(metrics.columns[1].left);
  expect(metrics.contentScrollWidth).toBeLessThanOrEqual(metrics.contentClientWidth + 1);
  expect(metrics.contentScrollHeight).toBeLessThanOrEqual(metrics.contentClientHeight + 1);
  expect(metrics.footerInsidePaper).toBe(true);
  expect(metrics.pageNumberInsidePaper).toBe(true);
  expect(metrics.gapContentToFooter).toBeGreaterThanOrEqual(0);
  expect(metrics.pagerGap).toBeGreaterThanOrEqual(8);
  expect(metrics.contentText.length).toBeGreaterThan(0);
  if (!isLast) {
    expect(metrics.gapTextToContentBottom).toBeLessThanOrEqual(MAX_BOTTOM_GAP);
  }
}

async function screenshotPage(page: Page, testInfo: TestInfo, name: string, position: 'top' | 'bottom') {
  await page.evaluate(({ placement }) => {
    const workspace = document.querySelector<HTMLElement>('[data-testid="reading-workspace"]')!;
    const paper = document.querySelector<HTMLElement>('[data-testid="explicit-page"]')!;
    const pageTop = paper.getBoundingClientRect().top - workspace.getBoundingClientRect().top + workspace.scrollTop;
    workspace.scrollTop = placement === 'top'
      ? Math.max(0, pageTop - 26)
      : Math.max(0, pageTop + paper.offsetHeight + 70 - workspace.clientHeight);
  }, { placement: position });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.screenshot({ path: testInfo.outputPath(name) });
}

test('explicit pages fill the sheet and keep footer and pager clear', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await openLongFixture(page, 1280, 720);

  const initial = await measure(page);
  expect(initial.currentPage).toBe(1);
  expect(initial.pageCount).toBeGreaterThan(2);
  expectPageGeometry(initial, false);
  await expect(page.getByRole('button', { name: '← Previous' })).toBeDisabled();
  await screenshotPage(page, testInfo, '1280-first.png', 'top');

  const pageTexts: string[] = [initial.contentText];
  for (let index = 1; index < initial.pageCount; index += 1) {
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect.poll(async () => (await measure(page)).currentPage).toBe(index + 1);
    const metrics = await measure(page);
    const isLast = index === initial.pageCount - 1;
    expectPageGeometry(metrics, isLast);
    pageTexts.push(metrics.contentText);
    if (index === 2) {
      await screenshotPage(page, testInfo, '1280-middle.png', 'top');
    }
    if (isLast) {
      await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled();
      await screenshotPage(page, testInfo, '1280-last.png', 'top');
      await screenshotPage(page, testInfo, '1280-last-footer.png', 'bottom');
    }
  }
  expect(pageTexts).toHaveLength(initial.pageCount);

  for (let index = initial.pageCount - 1; index > 0; index -= 1) {
    await page.getByRole('button', { name: '← Previous' }).click();
    await expect.poll(async () => (await measure(page)).currentPage).toBe(index);
  }
  const firstAgain = await measure(page);
  expect(firstAgain.currentPage).toBe(1);
  await expect(page.getByRole('button', { name: '← Previous' })).toBeDisabled();

  const sourceText = await page.getByTestId('fixture-source').textContent();
  const normalize = (value: string) => value.replace(/\s+/g, '');
  expect(normalize(pageTexts.join(''))).toBe(normalize(sourceText ?? ''));

  for (const size of ['12px', '14px', '16px', '18px']) {
    const before = (await measure(page)).pageCount;
    await page.getByRole('button', { name: size }).click();
    await expect.poll(async () => (await measure(page)).pageCount, { timeout: 10_000 }).not.toBe(before);
    const sizedFirst = await measure(page);
    expect(sizedFirst.currentPage).toBe(1);
    expectPageGeometry(sizedFirst, false);
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect.poll(async () => (await measure(page)).currentPage).toBe(2);
    expectPageGeometry(await measure(page), false);
    await page.getByRole('button', { name: '← Previous' }).click();
    await expect.poll(async () => (await measure(page)).currentPage).toBe(1);
    if (size === '18px') {
      const total = sizedFirst.pageCount;
      for (let index = 1; index < total; index += 1) {
        await page.getByRole('button', { name: 'Next →' }).click();
        await expect.poll(async () => (await measure(page)).currentPage).toBe(index + 1);
        expectPageGeometry(await measure(page), index === total - 1);
      }
      for (let index = total - 1; index > 0; index -= 1) {
        await page.getByRole('button', { name: '← Previous' }).click();
        await expect.poll(async () => (await measure(page)).currentPage).toBe(index);
      }
    }
  }

  const beforeWide = (await measure(page)).pageCount;
  await page.getByRole('button', { name: '14px' }).click();
  await expect.poll(async () => (await measure(page)).pageCount, { timeout: 10_000 }).not.toBe(beforeWide);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const wideFirst = await measure(page);
  expect(wideFirst.currentPage).toBe(1);
  expectPageGeometry(wideFirst, false);
  expect(wideFirst.paper.left).toBeGreaterThan(0);
  await screenshotPage(page, testInfo, '1920-first.png', 'top');

  const wideTotal = wideFirst.pageCount;
  for (let index = 1; index < wideTotal; index += 1) {
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect.poll(async () => (await measure(page)).currentPage).toBe(index + 1);
  }
  const wideLast = await measure(page);
  expect(wideLast.currentPage).toBe(wideTotal);
  expectPageGeometry(wideLast, true);
  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled();
  await screenshotPage(page, testInfo, '1920-last.png', 'top');
  await screenshotPage(page, testInfo, '1920-last-footer.png', 'bottom');
});
