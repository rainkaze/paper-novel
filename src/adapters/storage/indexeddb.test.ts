import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookDocument } from '../../domain/document/types';
import { DB_NAME, StorageError, deleteBook, getBook, listBooks, saveBook } from './indexeddb';

function makeDocument(overrides: Partial<BookDocument> = {}): BookDocument {
  return {
    schemaVersion: 1,
    bookId: 'book_test_1',
    metadata: { title: '测试书籍', authors: [] },
    source: { format: 'txt', fingerprint: 'txt:test:1' },
    contentHash: 'txt-test',
    chapters: [
      {
        chapterId: 'chapter_test_1',
        title: '第一章 起点',
        paragraphs: [
          { paragraphId: 'paragraph_1', kind: 'body', runs: [{ text: '第一段。' }] },
          { paragraphId: 'paragraph_2', kind: 'body', runs: [{ text: '第二段。' }] },
        ],
      },
    ],
    ...overrides,
  };
}

async function deleteDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  await deleteDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('IndexedDB book storage', () => {
  it('saves metadata and the full document, then reads both', async () => {
    const document = makeDocument();
    const saved = await saveBook(document);

    expect(saved).toMatchObject({
      id: 'book_test_1',
      title: '测试书籍',
      sourceType: 'txt',
      chapterCount: 1,
      characterCount: 8,
    });

    const summaries = await listBooks();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ id: 'book_test_1', title: '测试书籍' });
    expect(summaries[0]).not.toHaveProperty('document');

    const stored = await getBook('book_test_1');
    expect(stored?.document.chapters[0].paragraphs[0].runs[0].text).toBe('第一段。');
    expect(stored?.document.metadata.title).toBe('测试书籍');
  });

  it('overwrites an existing book instead of duplicating it', async () => {
    const first = await saveBook(makeDocument());
    const updated = makeDocument({
      metadata: { title: '测试书籍 第二版', authors: [] },
      chapters: [
        {
          chapterId: 'chapter_test_1',
          title: '第一章 起点',
          paragraphs: [
            { paragraphId: 'paragraph_1', kind: 'body', runs: [{ text: '第一段。' }] },
            { paragraphId: 'paragraph_2', kind: 'body', runs: [{ text: '第二段。' }] },
            { paragraphId: 'paragraph_3', kind: 'body', runs: [{ text: '新增段落。' }] },
          ],
        },
      ],
    });
    const second = await saveBook(updated);

    const summaries = await listBooks();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].title).toBe('测试书籍 第二版');
    expect(summaries[0].characterCount).toBe(13);
    expect(second.importedAt).toBe(first.importedAt);
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);

    const stored = await getBook('book_test_1');
    expect(stored?.document.chapters[0].paragraphs).toHaveLength(3);
  });

  it('lists books without the full document and deletes one', async () => {
    await saveBook(makeDocument({ bookId: 'book_a', metadata: { title: '甲书', authors: [] } }));
    await saveBook(makeDocument({ bookId: 'book_b', metadata: { title: '乙书', authors: [] } }));

    const before = await listBooks();
    expect(before).toHaveLength(2);
    for (const summary of before) {
      expect(summary).not.toHaveProperty('document');
    }

    await deleteBook('book_a');
    const after = await listBooks();
    expect(after.map((book) => book.id)).toEqual(['book_b']);
    expect(await getBook('book_a')).toBeNull();
    expect(await getBook('book_b')).not.toBeNull();
  });

  it('reports a readable error when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);

    await expect(listBooks()).rejects.toBeInstanceOf(StorageError);
    await expect(listBooks()).rejects.toThrow('当前浏览器不支持 IndexedDB，无法使用本地书架。');
  });

  it('reports a readable error when the database cannot be opened', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('open failed');
      },
    });

    await expect(listBooks()).rejects.toBeInstanceOf(StorageError);
    await expect(listBooks()).rejects.toThrow('无法打开本地书籍存储');
  });
});
