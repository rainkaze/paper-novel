import { getParagraphText } from '../../domain/document/text';
import type { BookDocument } from '../../domain/document/types';

export const DB_NAME = 'paper-novel-library';
export const DB_VERSION = 1;
export const BOOKS_STORE = 'books';
export const DOCUMENTS_STORE = 'documents';
export const META_STORE = 'meta';

export type BookSourceType = 'fixture' | 'txt';

export interface BookMetadata {
  id: string;
  title: string;
  sourceType: BookSourceType;
  importedAt: number;
  updatedAt: number;
  chapterCount: number;
  characterCount: number;
}

export type BookSummary = BookMetadata;

export interface StoredBook extends BookMetadata {
  document: BookDocument;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

interface DocumentRecord {
  id: string;
  document: BookDocument;
}

interface MetaRecord {
  key: string;
  value: unknown;
}

function toStorageError(error: unknown, fallback: string): StorageError {
  if (error instanceof StorageError) return error;
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'QuotaExceededError') {
    return new StorageError('本地存储空间不足，无法保存书籍，请删除一些书籍后重试。');
  }
  if (name === 'SecurityError') {
    return new StorageError('浏览器禁止了本地存储访问，无法使用书架。');
  }
  return new StorageError(`${fallback}${name ? `（${name}）` : ''}`);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageError('当前浏览器不支持 IndexedDB，无法使用本地书架。'));
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(toStorageError(error, '无法打开本地书籍存储。'));
      return;
    }

    let settled = false;
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BOOKS_STORE)) {
        database.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(DOCUMENTS_STORE)) {
        database.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' });
      }
      const metaStore = request.transaction?.objectStore(META_STORE);
      metaStore?.put({ key: 'schemaVersion', value: DB_VERSION } satisfies MetaRecord);
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(toStorageError(request.error, '无法打开本地书籍存储，请检查浏览器设置。'));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new StorageError('本地书籍存储被其他页面占用，请关闭其他标签页后重试。'));
    };
  });
}

async function withDatabase<T>(operation: (database: IDBDatabase) => Promise<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await operation(database);
  } catch (error) {
    throw toStorageError(error, '本地书籍存储操作失败。');
  } finally {
    database.close();
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toStorageError(request.error, '读取本地书籍存储失败。'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(toStorageError(transaction.error, '本地书籍存储事务已中止。'));
    transaction.onerror = () => reject(toStorageError(transaction.error, '写入本地书籍存储失败。'));
  });
}

function countCharacters(document: BookDocument): number {
  let total = 0;
  for (const chapter of document.chapters) {
    for (const paragraph of chapter.paragraphs) {
      total += Array.from(getParagraphText(paragraph)).length;
    }
  }
  return total;
}

function createMetadata(document: BookDocument, importedAt: number, now: number): BookMetadata {
  return {
    id: document.bookId,
    title: document.metadata.title.trim() || '未命名书籍',
    sourceType: document.source.format === 'txt' ? 'txt' : 'fixture',
    importedAt,
    updatedAt: now,
    chapterCount: document.chapters.length,
    characterCount: countCharacters(document),
  };
}

async function readMetadata(database: IDBDatabase, id: string): Promise<BookMetadata | null> {
  const transaction = database.transaction(BOOKS_STORE, 'readonly');
  const done = transactionDone(transaction);
  const record = await requestToPromise<BookMetadata | undefined>(transaction.objectStore(BOOKS_STORE).get(id));
  await done;
  return record ?? null;
}

/** 保存或覆盖一本书；元数据与完整文档在同一事务中写入。 */
export async function saveBook(document: BookDocument): Promise<BookMetadata> {
  if (!document.bookId) {
    throw new StorageError('书籍缺少唯一标识，无法保存。');
  }
  const existing = await withDatabase((database) => readMetadata(database, document.bookId));
  const now = Date.now();
  const metadata = createMetadata(document, existing?.importedAt ?? now, now);
  await withDatabase(async (database) => {
    const transaction = database.transaction([BOOKS_STORE, DOCUMENTS_STORE], 'readwrite');
    transaction.objectStore(BOOKS_STORE).put(metadata);
    transaction.objectStore(DOCUMENTS_STORE).put({ id: document.bookId, document } satisfies DocumentRecord);
    await transactionDone(transaction);
  });
  return metadata;
}

/** 只读取书架元数据，不加载完整正文。 */
export async function listBooks(): Promise<BookSummary[]> {
  return withDatabase(async (database) => {
    const transaction = database.transaction(BOOKS_STORE, 'readonly');
    const done = transactionDone(transaction);
    const records = await requestToPromise<BookMetadata[]>(transaction.objectStore(BOOKS_STORE).getAll());
    await done;
    return records
      .map((record) => ({
        id: record.id,
        title: record.title,
        sourceType: record.sourceType,
        importedAt: record.importedAt,
        updatedAt: record.updatedAt,
        chapterCount: record.chapterCount,
        characterCount: record.characterCount,
      }))
      .sort((left, right) => right.updatedAt - left.updatedAt || left.title.localeCompare(right.title, 'zh-CN'));
  });
}

/** 读取完整书籍；不存在时返回 null。 */
export async function getBook(id: string): Promise<StoredBook | null> {
  return withDatabase(async (database) => {
    const transaction = database.transaction([BOOKS_STORE, DOCUMENTS_STORE], 'readonly');
    const done = transactionDone(transaction);
    const [metadata, record] = await Promise.all([
      requestToPromise<BookMetadata | undefined>(transaction.objectStore(BOOKS_STORE).get(id)),
      requestToPromise<DocumentRecord | undefined>(transaction.objectStore(DOCUMENTS_STORE).get(id)),
    ]);
    await done;
    if (!metadata || !record) return null;
    return { ...metadata, document: record.document };
  });
}

/** 删除一本书及其正文；不存在时静默完成。 */
export async function deleteBook(id: string): Promise<void> {
  await withDatabase(async (database) => {
    const transaction = database.transaction([BOOKS_STORE, DOCUMENTS_STORE], 'readwrite');
    transaction.objectStore(BOOKS_STORE).delete(id);
    transaction.objectStore(DOCUMENTS_STORE).delete(id);
    await transactionDone(transaction);
  });
}
