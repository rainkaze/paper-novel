import type { Block } from '../content-types';
import type { BookDocument, ReadingPosition } from '../domain/document/types';
import type { ExplicitPage } from '../pagination';

export type ReaderMode = 'css-columns' | 'explicit';
export type ReaderFontSize = 12 | 14 | 16 | 18;

export interface ReadingProgressRecord {
  bookId: string;
  position: ReadingPosition;
  mode: ReaderMode;
  fontSize: ReaderFontSize;
  /** 1-based page number. */
  page: number;
  pageCount: number;
  updatedAt: number;
}

interface ParagraphMeta {
  chapterId: string;
  offset: number;
  length: number;
  text: string;
}

export interface ReadingIndex {
  bookId: string;
  paragraphs: Map<string, ParagraphMeta>;
  blockStarts: Map<string, number>;
  totalLength: number;
}

/** 构建从阅读位置到逻辑页所需的纯文本索引；不修改文档或分页结果。 */
export function buildReadingIndex(document: BookDocument, blocks: Block[]): ReadingIndex {
  const chapterByParagraph = new Map<string, string>();
  for (const chapter of document.chapters) {
    for (const paragraph of chapter.paragraphs) {
      chapterByParagraph.set(paragraph.paragraphId, chapter.chapterId);
    }
  }

  const paragraphs = new Map<string, ParagraphMeta>();
  const blockStarts = new Map<string, number>();
  let cursor = 0;
  for (const block of blocks) {
    blockStarts.set(block.id, cursor);
    if (block.type !== 'heading') {
      const chapterId = chapterByParagraph.get(block.id) ?? '';
      const length = Array.from(block.text).length;
      paragraphs.set(block.id, { chapterId, offset: cursor, length, text: block.text });
      cursor += length;
    } else {
      cursor += Array.from(block.text).length;
    }
  }
  return { bookId: document.bookId, paragraphs, blockStarts, totalLength: cursor };
}

function blockStart(block: Block, index: ReadingIndex): number | null {
  if (block.type === 'heading') {
    return index.blockStarts.get(block.id) ?? null;
  }
  const meta = index.paragraphs.get(block.originId ?? block.id);
  if (!meta) return null;
  const utf16Offset = Math.min(Math.max(block.originOffset ?? 0, 0), meta.text.length);
  return meta.offset + Array.from(meta.text.slice(0, utf16Offset)).length;
}

function pageStart(page: ExplicitPage | undefined, index: ReadingIndex): number | null {
  if (!page) return null;
  for (const column of page.columns) {
    for (const block of column) {
      const start = blockStart(block, index);
      if (start !== null) return start;
    }
  }
  return null;
}

/** 取一页起始位置处（优先第一个正文段落）的 ReadingPosition。 */
export function getPositionForPage(pages: ExplicitPage[], pageIndex: number, index: ReadingIndex): ReadingPosition | null {
  const page = pages[pageIndex];
  if (!page) return null;
  for (const column of page.columns) {
    for (const block of column) {
      if (block.type !== 'paragraph') continue;
      const paragraphId = block.originId ?? block.id;
      const meta = index.paragraphs.get(paragraphId);
      if (!meta) continue;
      const utf16Offset = Math.min(Math.max(block.originOffset ?? 0, 0), meta.text.length);
      return {
        bookId: index.bookId,
        chapterId: meta.chapterId,
        paragraphId,
        characterOffset: Array.from(meta.text.slice(0, utf16Offset)).length,
        affinity: 'forward',
      };
    }
  }
  return null;
}

/** 查找包含指定阅读位置的最接近逻辑页；位置无效或超出文档时回到第 1 页。 */
export function findPageForPosition(pages: ExplicitPage[], index: ReadingIndex, position: ReadingPosition): number {
  if (!pages.length || position.bookId !== index.bookId) return 0;
  const meta = index.paragraphs.get(position.paragraphId);
  if (!meta || meta.chapterId !== position.chapterId) return 0;
  if (!Number.isInteger(position.characterOffset) || position.characterOffset < 0 || position.characterOffset > meta.length) {
    return 0;
  }

  const target = meta.offset + position.characterOffset;
  if (target > index.totalLength) return 0;
  let best = 0;
  for (let current = 0; current < pages.length; current += 1) {
    const start = pageStart(pages[current], index);
    if (start !== null && start <= target) best = current;
  }
  return best;
}

export function getProgressLabel(progress: ReadingProgressRecord | undefined): string {
  if (!progress || progress.pageCount < 1) return '未开始';
  const page = Math.min(Math.max(progress.page, 1), progress.pageCount);
  return `第 ${page} / ${progress.pageCount} 页`;
}

export function createProgressRecord(args: {
  bookId: string;
  pages: ExplicitPage[];
  pageIndex: number;
  index: ReadingIndex;
  mode: ReaderMode;
  fontSize: ReaderFontSize;
}): ReadingProgressRecord | null {
  if (!args.pages.length) return null;
  const pageIndex = Math.min(Math.max(args.pageIndex, 0), args.pages.length - 1);
  const position = getPositionForPage(args.pages, pageIndex, args.index);
  if (!position) return null;
  return {
    bookId: args.bookId,
    position,
    mode: args.mode,
    fontSize: args.fontSize,
    page: pageIndex + 1,
    pageCount: args.pages.length,
    updatedAt: Date.now(),
  };
}

export function toStoredMode(mode: 'columns' | 'explicit'): ReaderMode {
  return mode === 'columns' ? 'css-columns' : 'explicit';
}

export function fromStoredMode(mode: ReaderMode): 'columns' | 'explicit' {
  return mode === 'css-columns' ? 'columns' : 'explicit';
}

export function isReaderMode(value: unknown): value is ReaderMode {
  return value === 'css-columns' || value === 'explicit';
}

export function isReaderFontSize(value: unknown): value is ReaderFontSize {
  return value === 12 || value === 14 || value === 16 || value === 18;
}
