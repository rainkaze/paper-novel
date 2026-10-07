import { describe, expect, it } from 'vitest';
import { buildDocument } from './content';
import { paginateExplicit } from './pagination';

describe('artificial narrative fixture', () => {
  it('contains the requested mixed content types', () => {
    const blocks = buildDocument(1);
    const text = blocks.map((block) => block.text).join('\n');
    expect(blocks.some((block) => block.type === 'heading')).toBe(true);
    expect(text).toContain('23:47:08');
    expect(text).toContain('observation remains inconclusive');
    expect(text).toContain('“你确定要把它写下来吗？”');
    expect(text).toContain('2026-10-07');
  });

  it('explicit pagination preserves text order without duplication', () => {
    const blocks = buildDocument(1);
    const pages = paginateExplicit(blocks, (candidate) => candidate.reduce((sum, block) => sum + block.text.length, 0) <= 180);
    const flattened = pages.flatMap((page) => page.columns.flat()).map((block) => block.text).join('');
    expect(flattened).toBe(blocks.map((block) => block.text).join(''));
  });
});
