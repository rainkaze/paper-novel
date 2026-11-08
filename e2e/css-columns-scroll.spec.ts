import { expect, test, type Page, type TestInfo } from '@playwright/test';

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_GAP = 28;
const COLUMN_GAP = 29;

async function openLongFixture(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.locator('.control-group select').selectOption('1');
  await expect(page.getByText('50,782 characters · artificial fixture')).toBeVisible();
  await page.getByRole('button', { name: 'CSS Columns' }).click();
  await expect(page.getByTestId('columns-viewport')).toBeVisible();
  await expect(page.getByTestId('logical-page').first()).toBeVisible();
}

async function measure(page: Page) {
  return page.getByTestId('columns-viewport').evaluate((viewport) => {
    const track = viewport.querySelector<HTMLElement>('[data-testid="page-track"]')!;
    const pages = [...track.querySelectorAll<HTMLElement>('[data-testid="logical-page"]')];
    const rect = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    return {
      viewport: rect(viewport),
      clientWidth: viewport.clientWidth,
      clientHeight: viewport.clientHeight,
      scrollWidth: viewport.scrollWidth,
      scrollHeight: viewport.scrollHeight,
      scrollLeft: viewport.scrollLeft,
      overflowY: getComputedStyle(viewport).overflowY,
      trackWidth: track.getBoundingClientRect().width,
      pageCount: pages.length,
      currentPageIndex: Number(viewport.parentElement?.querySelector('[data-testid="current-page"]')?.textContent?.split('/')[0] ?? '1') - 1,
      pages: pages.map((node) => {
        const content = node.querySelector<HTMLElement>('[data-testid="logical-page-content"]')!;
        return {
          ...rect(node),
          contentClientWidth: content.clientWidth,
          contentScrollWidth: content.scrollWidth,
          contentClientHeight: content.clientHeight,
          contentScrollHeight: content.scrollHeight,
          columns: [...node.querySelectorAll<HTMLElement>('[data-testid="logical-column"]')].map(rect),
        };
      }),
    };
  });
}

async function waitForPageAligned(page: Page, index: number) {
  await expect
    .poll(async () => {
      const metrics = await measure(page);
      const target = metrics.pages[index];
      return target ? Math.abs(target.left - metrics.viewport.left) : Number.POSITIVE_INFINITY;
    }, { timeout: 5_000 })
    .toBeLessThanOrEqual(1);
}

async function navigateAndAwait(page: Page, name: 'Next →' | '← Previous', expectedIndex: number) {
  await page.getByRole('button', { name }).click();
  await expect.poll(async () => (await measure(page)).currentPageIndex).toBe(expectedIndex);
  await waitForPageAligned(page, expectedIndex);
}

async function screenshotPage(page: Page, testInfo: TestInfo, name: string, index: number, position: 'top' | 'bottom') {
  await page.evaluate(({ pageIndex, placement }) => {
    const workspace = document.querySelector<HTMLElement>('[data-testid="reading-workspace"]')!;
    const target = document.querySelectorAll<HTMLElement>('[data-testid="logical-page"]')[pageIndex];
    if (!target) return;
    const pageTop = target.getBoundingClientRect().top - workspace.getBoundingClientRect().top + workspace.scrollTop;
    workspace.scrollTop = placement === 'top'
      ? Math.max(0, pageTop - 26)
      : Math.max(0, pageTop + target.offsetHeight + 70 - workspace.clientHeight);
  }, { pageIndex: index, placement: position });
  await page.waitForTimeout(120);
  await page.screenshot({ path: testInfo.outputPath(name) });
}

test('explicit logical pages scroll accurately and preserve the complete long fixture', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await openLongFixture(page, 1280, 720);
  const viewport = page.getByTestId('columns-viewport');
  const track = page.getByTestId('page-track');

  const initial = await measure(page);
  expect(initial.pageCount).toBeGreaterThan(2);
  expect(initial.currentPageIndex).toBe(0);
  expect(initial.scrollLeft).toBeCloseTo(0, 0);
  expect(initial.overflowY).toBe('hidden');
  expect(initial.scrollHeight).toBeLessThanOrEqual(initial.clientHeight + 1);
  expect(initial.scrollWidth).toBe(initial.trackWidth);
  expect(initial.trackWidth).toBeCloseTo(initial.pageCount * PAGE_WIDTH + (initial.pageCount - 1) * PAGE_GAP, 0);
  expect(initial.pages[0].left).toBeGreaterThanOrEqual(initial.viewport.left - 1);

  for (const logicalPage of initial.pages) {
    expect(logicalPage.width).toBeCloseTo(PAGE_WIDTH, 0);
    expect(logicalPage.height).toBeCloseTo(PAGE_HEIGHT, 0);
    expect(logicalPage.columns).toHaveLength(2);
    expect(logicalPage.columns[0].width).toBeCloseTo(320.5, 0);
    expect(logicalPage.columns[0].width + logicalPage.columns[1].width + COLUMN_GAP).toBeCloseTo(670, 0);
    expect(logicalPage.columns[0].left).toBeLessThan(logicalPage.columns[1].left);
    expect(logicalPage.contentScrollWidth).toBeLessThanOrEqual(logicalPage.contentClientWidth + 1);
    expect(logicalPage.contentScrollHeight).toBeLessThanOrEqual(logicalPage.contentClientHeight + 1);
  }
  for (let index = 1; index < initial.pages.length; index += 1) {
    expect(initial.pages[index].left - initial.pages[index - 1].right).toBeCloseTo(PAGE_GAP, 0);
  }
  await screenshotPage(page, testInfo, '1280-first.png', 0, 'top');

  await navigateAndAwait(page, 'Next →', 1);
  const second = await measure(page);
  expect(second.currentPageIndex).toBe(1);
  expect(second.scrollLeft).toBeGreaterThan(initial.scrollLeft);
  expect(second.pages[1].left - second.viewport.left).toBeCloseTo(0, 0);

  await navigateAndAwait(page, 'Next →', 2);
  const third = await measure(page);
  expect(third.currentPageIndex).toBe(2);
  expect(third.scrollLeft).toBeGreaterThan(second.scrollLeft);
  expect(third.pages[2].left - third.viewport.left).toBeCloseTo(0, 0);
  await screenshotPage(page, testInfo, '1280-middle.png', 2, 'top');

  while (await page.getByRole('button', { name: 'Next →' }).isEnabled()) {
    await navigateAndAwait(page, 'Next →', (await measure(page)).currentPageIndex + 1);
  }
  const last = await measure(page);
  expect(last.currentPageIndex).toBe(last.pageCount - 1);
  expect(last.scrollLeft).toBeCloseTo(last.scrollWidth - last.clientWidth, 0);
  expect(last.pages.at(-1)!.right).toBeLessThanOrEqual(last.viewport.right + 1);
  expect(last.pages.at(-1)!.left).toBeCloseTo(last.viewport.left, 0);
  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled();
  await screenshotPage(page, testInfo, '1280-last.png', last.pageCount - 1, 'bottom');

  await navigateAndAwait(page, '← Previous', last.pageCount - 2);
  expect((await measure(page)).currentPageIndex).toBe(last.pageCount - 2);
  while (await page.getByRole('button', { name: '← Previous' }).isEnabled()) {
    await navigateAndAwait(page, '← Previous', (await measure(page)).currentPageIndex - 1);
  }
  const firstAgain = await measure(page);
  expect(firstAgain.currentPageIndex).toBe(0);
  expect(firstAgain.scrollLeft).toBeCloseTo(0, 0);
  expect(firstAgain.pages[0].left).toBeCloseTo(firstAgain.viewport.left, 0);
  await expect(page.getByRole('button', { name: '← Previous' })).toBeDisabled();

  await viewport.evaluate((node, gap) => { node.scrollLeft = node.clientWidth + gap; }, PAGE_GAP);
  await expect.poll(async () => (await measure(page)).currentPageIndex).toBe(1);
  await waitForPageAligned(page, 1);
  await navigateAndAwait(page, '← Previous', 0);

  const sourceText = await page.getByTestId('fixture-source').textContent();
  const normalize = (value: string) => value.replace(/\s+/g, '');
  const seenCounts = new Set<number>([initial.pageCount]);
  for (const size of ['12px', '14px', '16px', '18px']) {
    const previousCount = (await measure(page)).pageCount;
    await page.getByRole('button', { name: size }).click();
    await expect.poll(async () => (await measure(page)).pageCount, { timeout: 10_000 }).not.toBe(previousCount);
    const sized = await measure(page);
    seenCounts.add(sized.pageCount);
    expect(sized.currentPageIndex).toBe(0);
    expect(sized.scrollLeft).toBeCloseTo(0, 0);
    expect(sized.pageCount).toBeGreaterThan(2);
    expect(sized.pages).toHaveLength(sized.pageCount);
    expect(sized.trackWidth).toBeCloseTo(sized.pageCount * PAGE_WIDTH + (sized.pageCount - 1) * PAGE_GAP, 0);
    for (const logicalPage of sized.pages) {
      expect(logicalPage.height).toBeCloseTo(PAGE_HEIGHT, 0);
      expect(logicalPage.columns).toHaveLength(2);
      expect(logicalPage.contentScrollWidth).toBeLessThanOrEqual(logicalPage.contentClientWidth + 1);
      expect(logicalPage.contentScrollHeight).toBeLessThanOrEqual(logicalPage.contentClientHeight + 1);
    }
    await navigateAndAwait(page, 'Next →', 1);
    expect((await measure(page)).scrollLeft).toBeGreaterThan(0);
    while (await page.getByRole('button', { name: 'Next →' }).isEnabled()) {
      await navigateAndAwait(page, 'Next →', (await measure(page)).currentPageIndex + 1);
    }
    expect((await measure(page)).currentPageIndex).toBe(sized.pageCount - 1);
    while (await page.getByRole('button', { name: '← Previous' }).isEnabled()) {
      await navigateAndAwait(page, '← Previous', (await measure(page)).currentPageIndex - 1);
    }
  }

  const previousCount = (await measure(page)).pageCount;
  await page.getByRole('button', { name: '14px' }).click();
  await expect.poll(async () => (await measure(page)).pageCount, { timeout: 10_000 }).not.toBe(previousCount);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const wideFirst = await measure(page);
  expect(wideFirst.currentPageIndex).toBe(0);
  expect(wideFirst.scrollLeft).toBeCloseTo(0, 0);
  expect(wideFirst.pages[0].left).toBeGreaterThanOrEqual(wideFirst.viewport.left - 1);
  expect(wideFirst.pages[0].right).toBeCloseTo(wideFirst.viewport.right, 0);
  await screenshotPage(page, testInfo, '1920-first.png', 0, 'top');

  while (await page.getByRole('button', { name: 'Next →' }).isEnabled()) {
    await navigateAndAwait(page, 'Next →', (await measure(page)).currentPageIndex + 1);
  }
  const wideLast = await measure(page);
  expect(wideLast.currentPageIndex).toBe(wideLast.pageCount - 1);
  expect(wideLast.pages.at(-1)!.right).toBeLessThanOrEqual(wideLast.viewport.right + 1);
  expect(wideLast.pages.at(-1)!.left).toBeCloseTo(wideLast.viewport.left, 0);
  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled();
  await screenshotPage(page, testInfo, '1920-last.png', wideLast.pageCount - 1, 'bottom');

  const renderedPagesText = await page.locator('[data-testid="logical-page-content"]').evaluateAll((nodes) => nodes.map((node) => node.textContent ?? '').join(''));
  expect(normalize(renderedPagesText)).toBe(normalize(sourceText ?? ''));

  const finalMetrics = await measure(page);
  expect(finalMetrics.scrollHeight).toBeLessThanOrEqual(finalMetrics.clientHeight + 1);
  const workspace = page.getByTestId('reading-workspace');
  const control = page.locator('.control-panel');
  await workspace.evaluate((node) => { node.scrollTop = 0; });
  const controlAtTop = await control.boundingBox();
  await workspace.evaluate((node) => { node.scrollTop = 650; });
  const workspaceScrollTop = await workspace.evaluate((node) => node.scrollTop);
  const controlAfter = await control.boundingBox();
  expect(workspaceScrollTop).toBeCloseTo(650, 0);
  expect(controlAfter!.y).toBeCloseTo(controlAtTop!.y, 0);
  expect(await track.count()).toBe(1);
  expect(seenCounts.size).toBeGreaterThan(2);
});
