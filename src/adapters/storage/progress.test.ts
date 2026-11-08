import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookDocument, ReadingPosition } from '../../domain/document/types';
import type { ReadingProgressRecord } from '../../reading/reading-progress';
import {
  BOOKS_STORE,
  DB_NAME,
  DB_VERSION,
  DOCUMENTS_STORE,
  META_STORE,
  deleteBook,
  deleteProgress,
  getBook,
  getProgress,
  listBooks,
  listProgress,
  saveBook,
  saveProgress,
} from './indexeddb';

function makeDocument(bookId = 'book_test_1', title = '测试书籍'): BookDocument {
  return {
    schemaVersion: 1,
    bookId,
    metadata: { title, authors: [] },
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
  };
}

function makePosition(bookId = 'book_test_1'): ReadingPosition {
  return {
    bookId,
    chapterId: 'chapter_test_1',
    paragraphId: 'paragraph_1',
    characterOffset: 1,
    affinity: 'forward',
  };
}

function makeProgress(overrides: Partial<ReadingProgressRecord> = {}): ReadingProgressRecord {
  return {
    bookId: 'book_test_1',
    position: makePosition(),
    mode: 'explicit',
    fontSize: 14,
    page: 1,
    pageCount: 3,
    updatedAt: 1,
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

describe('IndexedDB reading progress storage', () => {
  it('saves, reads, lists and deletes progress', async () => {
    const saved = await saveProgress(makeProgress({ page: 2, pageCount: 5 }));

    expect(saved.updatedAt).toBeGreaterThan(0);
    const loaded = await getProgress('book_test_1');
    expect(loaded?.page).toBe(2);
    expect(loaded?.pageCount).toBe(5);
    expect(loaded?.position.characterOffset).toBe(1);
    expect(await listProgress()).toHaveLength(1);

    await deleteProgress('book_test_1');
    expect(await getProgress('book_test_1')).toBeNull();
    expect(await listProgress()).toHaveLength(0);
  });

  it('refreshes updatedAt when saving the same book twice', async () => {
    const first = await saveProgress(makeProgress({ page: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await saveProgress(makeProgress({ page: 3, pageCount: 6 }));

    expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
    const records = await listProgress();
    expect(records).toHaveLength(1);
    expect(records[0].page).toBe(3);
    expect(records[0].pageCount).toBe(6);
  });

  it('deletes the matching progress when deleting a book', async () => {
    await saveBook(makeDocument());
    await saveProgress(makeProgress());

    await deleteBook('book_test_1');

    expect(await listBooks()).toHaveLength(0);
    expect(await getBook('book_test_1')).toBeNull();
    expect(await getProgress('book_test_1')).toBeNull();
    expect(await listProgress()).toHaveLength(0);
  });

  it('upgrades a v1 database to v2 without losing books or documents', async () => {
    const document = makeDocument('book_legacy', '旧版书籍');
    const metadata = {
      id: 'book_legacy',
      title: '旧版书籍',
      sourceType: 'txt' as const,
      importedAt: 1,
      updatedAt: 2,
      chapterCount: 1,
      characterCount: 8,
    };

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore(BOOKS_STORE, { keyPath: 'id' }).put(metadata);
        database.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' }).put({ id: document.bookId, document });
        database.createObjectStore(META_STORE, { keyPath: 'key' }).put({ key: 'schemaVersion', value: 1 });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const books = await listBooks();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('旧版书籍');
    const stored = await getBook('book_legacy');
    expect(stored?.document.chapters[0].paragraphs[0].runs[0].text).toBe('第一段。');

    await saveProgress(makeProgress({ bookId: 'book_legacy' }));
    expect((await getProgress('book_legacy'))?.page).toBe(1);

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(database.version).toBe(DB_VERSION);
    const schemaVersion = await new Promise<number>((resolve, reject) => {
      const transaction = database.transaction(META_STORE, 'readonly');
      const request = transaction.objectStore(META_STORE).get('schemaVersion');
      request.onsuccess = () => resolve(request.result.value as number);
      request.onerror = () => reject(request.error);
    });
    database.close();
    expect(schemaVersion).toBe(2);
  });

  it('reports a readable error when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);

    await expect(saveProgress(makeProgress())).rejects.toThrow('当前浏览器不支持 IndexedDB，无法使用本地书架。');
    await expect(listProgress()).rejects.toThrow('当前浏览器不支持 IndexedDB，无法使用本地书架。');
  });
});
