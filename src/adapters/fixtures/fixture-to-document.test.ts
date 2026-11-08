import { describe, expect, it } from 'vitest';
import { buildBookDocument, buildDocument } from '../../content';
import { documentToBlocks } from './fixture-to-document';

describe('fixture BookDocument compatibility adapter', () => {
  it('creates a multi-chapter document and preserves headings in order', () => {
    const document = buildBookDocument(2);
    expect(document.schemaVersion).toBe(1);
    expect(document.chapters.length).toBe(7);
    expect(document.chapters.map((chapter) => chapter.title)).toEqual([
      '1 引言：纸张边缘的微光',
      '2 相关观察与现场记录',
      '3 方法：把不确定性排列整齐',
      '4 结果：门仍然留在原处',
      '5 讨论与结论',
      '6 附录：重复观察 1',
      '7 附录：重复观察 2',
    ]);
  });

  it('round-trips all fixture text, order, blank blocks, and repeated source text', () => {
    const document = buildBookDocument(20);
    const converted = documentToBlocks(document);
    const legacy = buildDocument(20);
    expect(converted.map((block) => `${block.type}:${block.text}`).join('\n'))
      .toBe(legacy.map((block) => `${block.type}:${block.text}`).join('\n'));
    expect(converted.filter((block) => block.type === 'blank')).toHaveLength(1);
    expect(converted.map((block) => block.text).join('')).toContain('observation remains inconclusive');
    expect(converted.map((block) => block.text).join('')).toContain('23:47:08');
    const repeatedParagraph = '后来，林岑发现窗外已经天亮。新的光线覆盖了旧的阴影，却没有抹掉它们的边界。他把这一段写进记录，又在下一页重复了一遍，因为重复本身也是一种观察。 1 引言：纸张边缘的微光';
    const repeatedBlocks = converted.filter((block) => block.text === repeatedParagraph);
    expect(repeatedBlocks.length).toBeGreaterThan(1);
    expect(new Set(repeatedBlocks.map((block) => block.id)).size).toBe(repeatedBlocks.length);
  });

  it('joins multiple runs while converting a document into legacy blocks', () => {
    const document = buildBookDocument(0);
    document.chapters[0].paragraphs[0].runs = [{ text: '中英' }, { text: ' mixed ' }, { text: '文本' }];
    expect(documentToBlocks(document)[1].text).toBe('中英 mixed 文本');
  });
});
