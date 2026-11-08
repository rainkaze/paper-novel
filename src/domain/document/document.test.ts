import { describe, expect, it } from 'vitest';
import { createBookId, createChapterId, createParagraphId } from './ids';
import {
  codePointOffsetToUtf16Index,
  getCodePointLength,
  getParagraphText,
  sliceByCodePoints,
} from './text';
import type { BookDocument, Paragraph } from './types';

describe('document text helpers', () => {
  it('joins runs in order, preserving mixed Chinese and English text', () => {
    const paragraph: Paragraph = {
      paragraphId: 'p-test',
      kind: 'body',
      runs: [{ text: '雨停以后，' }, { text: 'the station' }, { text: ' 仍然亮着。' }],
    };
    expect(getParagraphText(paragraph)).toBe('雨停以后，the station 仍然亮着。');
  });

  it('represents an intentional blank paragraph with no runs', () => {
    const paragraph: Paragraph = { paragraphId: 'p-blank', kind: 'blank', runs: [] };
    expect(getParagraphText(paragraph)).toBe('');
    expect(paragraph.kind).toBe('blank');
  });

  it('counts emoji as one code point and converts offsets to UTF-16 indices', () => {
    const text = 'A😀中';
    expect(getCodePointLength(text)).toBe(3);
    expect(codePointOffsetToUtf16Index(text, 0)).toBe(0);
    expect(codePointOffsetToUtf16Index(text, 1)).toBe(1);
    expect(codePointOffsetToUtf16Index(text, 2)).toBe(3);
    expect(codePointOffsetToUtf16Index(text, 3)).toBe(4);
  });

  it('slices at code point boundaries without splitting surrogate pairs', () => {
    expect(sliceByCodePoints('A😀中', 1, 2)).toBe('😀');
    expect(sliceByCodePoints('A😀中', 0, 3)).toBe('A😀中');
    expect(() => sliceByCodePoints('A😀中', 1, 5)).toThrow(RangeError);
  });
});

describe('document identity and schema', () => {
  it('generates distinct typed IDs for repeated text paragraphs', () => {
    const repeatedText = '同一句话。';
    const first = { paragraphId: createParagraphId(), kind: 'body' as const, runs: [{ text: repeatedText }] };
    const second = { paragraphId: createParagraphId(), kind: 'body' as const, runs: [{ text: repeatedText }] };
    expect(first.paragraphId).not.toBe(second.paragraphId);
    expect(first.paragraphId).toMatch(/^paragraph_/);
  });

  it('keeps book identity independent from content version changes', () => {
    const bookId = createBookId();
    const before: BookDocument = {
      schemaVersion: 1,
      bookId,
      metadata: { title: '测试书', authors: [] },
      source: { format: 'fixture', fingerprint: 'fixture:sample' },
      contentHash: 'version-one',
      chapters: [{ chapterId: createChapterId(), title: '第一章', paragraphs: [] }],
    };
    const after = { ...before, contentHash: 'version-two' };
    expect(after.bookId).toBe(before.bookId);
    expect(after.contentHash).not.toBe(before.contentHash);
    expect(before.schemaVersion).toBe(1);
    expect(before.metadata.authors).toEqual([]);
  });
});
