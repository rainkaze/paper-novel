import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { buildDocument, testSizes } from './content';
import { documentToBlocks } from './adapters/fixtures/fixture-to-document';
import { deleteBook, getBook, listBooks, saveBook, type BookSummary } from './adapters/storage/indexeddb';
import { txtToBookDocument } from './adapters/txt/txt-to-document';
import type { Block } from './content-types';
import type { BookDocument } from './domain/document/types';
import { paginateExplicit, type ExplicitPage } from './pagination';

type Mode = 'columns' | 'explicit';
type FontSize = 12 | 14 | 16 | 18;

const abstract = '本文以一段虚构的现场记录为视觉占位文本，观察叙事内容在学术论文式页面中的阅读节奏。本文不对故事进行改写、总结或学术化解释；标题、作者、摘要与关键词仅用于验证页面结构。';

function formatImportedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function PaperChrome({ children, pageNumber, className = '', testId }: { children: ReactNode; pageNumber?: number; className?: string; testId?: string }) {
  return <article className={`paper ${className}`} data-testid={testId}>
    <header className="running-head"><span>JOURNAL OF NARRATIVE SYSTEMS</span><span>PAPERNOVEL · VISUAL STUDY</span></header>
    {children}
    <footer className="paper-footer"><span>Research Department · Academic Layout Spike</span><span>{pageNumber ?? ''}</span></footer>
  </article>;
}

function FrontMatter({ title, imported, saved }: { title: string; imported: boolean; saved: boolean }) {
  return <div className="front-matter">
    <h1 data-testid="front-matter-title">{title}</h1>
    <p className="author">{imported ? (saved ? '本地 TXT · 本地书架' : '本地 TXT · 内存导入') : 'Research Department'}</p>
    {imported
      ? <p className="import-cover-note">{saved ? '已保存到本地书架，刷新后仍会保留。' : '当前书籍仅保存在内存中，刷新后会丢失。'}</p>
      : <>
        <section className="abstract"><h2>Abstract</h2><p>{abstract}</p></section>
        <p className="keywords"><strong>Keywords:</strong> narrative structure; observation; reading interface; typography</p>
      </>}
  </div>;
}

function BlockView({ block }: { block: Block }) {
  if (block.type === 'heading') return <h3 className="section-heading">{block.text}</h3>;
  if (block.type === 'blank') return <div className="blank-block" aria-hidden="true" />;
  return <p className={block.continuation ? 'body-paragraph continuation' : 'body-paragraph'}>{block.text}</p>;
}

function ExplicitPages({ pages, page, setPage }: { pages: ExplicitPage[]; page: number; setPage: (page: number) => void }) {
  const current = pages[page];
  return <>
    <PaperChrome pageNumber={page + 1} className="explicit-paper" testId="explicit-page">
      <div className="paper-columns explicit-columns" data-testid="explicit-page-content">
        {current.columns.map((column, index) => <div className="paper-column" key={index}>{column.map((block) => <BlockView block={block} key={block.id} />)}</div>)}
      </div>
    </PaperChrome>
    <nav className="pager" aria-label="Page navigation">
      <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>← Previous</button>
      <span>{page + 1} / {pages.length}</span>
      <button onClick={() => setPage(Math.min(pages.length - 1, page + 1))} disabled={page === pages.length - 1}>Next →</button>
    </nav>
  </>;
}

function CssColumns({ pages, page, setPage }: { pages: ExplicitPage[]; page: number; setPage: (page: number) => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pageCount = pages.length;

  const scrollToPage = useCallback((index: number, behavior: 'auto' | 'instant' | 'smooth') => {
    const viewport = viewportRef.current;
    const target = trackRef.current?.children.item(index) as HTMLElement | null;
    if (!viewport || !target) return;
    const left = viewport.scrollLeft + target.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
    viewport.scrollTo({ left, behavior });
  }, []);

  const navigate = (nextPage: number) => {
    if (nextPage < 0 || nextPage >= pageCount) return;
    scrollToPage(nextPage, 'auto');
    setPage(nextPage);
  };

  // Keep the logical page aligned whenever the page model or the requested page changes.
  useLayoutEffect(() => {
    scrollToPage(page, 'auto');
  }, [page, pageCount, scrollToPage]);

  // After a reader-driven horizontal scroll settles, follow the page that owns the viewport center.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let timer = 0;
    const syncPageWithScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const track = trackRef.current;
        if (!track) return;
        const viewportRect = viewport.getBoundingClientRect();
        const center = viewportRect.left + viewport.clientWidth / 2;
        let nearest = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;
        Array.from(track.children).forEach((child, index) => {
          const rect = child.getBoundingClientRect();
          const distance = Math.abs(rect.left + rect.width / 2 - center);
          if (distance < nearestDistance) {
            nearest = index;
            nearestDistance = distance;
          }
        });
        setPage(nearest);
      }, 120);
    };
    viewport.addEventListener('scroll', syncPageWithScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', syncPageWithScroll);
      window.clearTimeout(timer);
    };
  }, [setPage]);

  return <>
    <div className="horizontal-reader" data-testid="columns-viewport" ref={viewportRef}>
      <div className="horizontal-track" data-testid="page-track" ref={trackRef}>
        {pages.map((pageModel, pageIndex) => <PaperChrome pageNumber={pageIndex + 1} className="css-paper logical-page" testId="logical-page" key={pageIndex}>
          <div className="paper-columns explicit-columns" data-testid="logical-page-content">
            {pageModel.columns.map((column, index) => <div className="paper-column" data-testid="logical-column" key={index}>{column.map((block) => <BlockView block={block} key={block.id} />)}</div>)}
          </div>
        </PaperChrome>)}
      </div>
    </div>
    <nav className="pager" aria-label="Page navigation">
      <button onClick={() => navigate(page - 1)} disabled={page === 0}>← Previous</button>
      <span data-testid="current-page">{page + 1} / {pageCount}</span>
      <button onClick={() => navigate(page + 1)} disabled={page >= pageCount - 1}>Next →</button>
    </nav>
  </>;
}

export function App() {
  const [mode, setMode] = useState<Mode>('explicit');
  const [fontSize, setFontSize] = useState<FontSize>(14);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [explicitPages, setExplicitPages] = useState<ExplicitPage[]>([]);
  const [currentDocument, setCurrentDocument] = useState<BookDocument | null>(null);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [currentBookSaved, setCurrentBookSaved] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [shelfLoading, setShelfLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fixtureBlocks = useMemo(() => buildDocument(testSizes[sizeIndex].repeat), [sizeIndex]);
  const blocks = useMemo(() => currentDocument ? documentToBlocks(currentDocument) : fixtureBlocks, [currentDocument, fixtureBlocks]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const summaries = await listBooks();
        if (cancelled) return;
        setBooks(summaries);
        if (summaries.length > 0) {
          const stored = await getBook(summaries[0].id);
          if (cancelled) return;
          if (stored) {
            setCurrentDocument(stored.document);
            setCurrentBookId(stored.id);
            setCurrentBookSaved(true);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setStorageNotice(`本地书架不可用，当前仅能使用示例文本：${errorMessage(error, '未知错误')}`);
        }
      } finally {
        if (!cancelled) setShelfLoading(false);
      }
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  const handleImportTxt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const book = txtToBookDocument(await file.arrayBuffer(), file.name);
      setCurrentDocument(book);
      setCurrentBookId(book.bookId);
      setCurrentBookSaved(false);
      setImportError(null);
      setPendingDeleteId(null);
      setPage(0);
      try {
        const saved = await saveBook(book);
        setBooks((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
        setCurrentBookSaved(true);
        setStorageNotice(null);
      } catch (error) {
        setStorageNotice(`书籍已打开，但未能保存到本地书架：${errorMessage(error, '未知错误')}`);
      }
    } catch (error) {
      setImportError(errorMessage(error, '导入 TXT 失败，请重试。'));
    }
  };

  const restoreFixture = () => {
    setCurrentDocument(null);
    setCurrentBookId(null);
    setCurrentBookSaved(false);
    setImportError(null);
    setPendingDeleteId(null);
    setPage(0);
  };

  const openBook = async (id: string) => {
    try {
      const stored = await getBook(id);
      if (!stored) {
        setStorageNotice('这本书已不存在，请刷新书架后重试。');
        setBooks((previous) => previous.filter((item) => item.id !== id));
        if (currentBookId === id) restoreFixture();
        return;
      }
      setCurrentDocument(stored.document);
      setCurrentBookId(stored.id);
      setCurrentBookSaved(true);
      setImportError(null);
      setPendingDeleteId(null);
      setStorageNotice(null);
      setPage(0);
    } catch (error) {
      setStorageNotice(`打开书籍失败：${errorMessage(error, '未知错误')}`);
    }
  };

  const handleDeleteBook = async (id: string) => {
    setPendingDeleteId(null);
    try {
      await deleteBook(id);
      const remaining = books.filter((item) => item.id !== id);
      setBooks(remaining);
      if (currentBookId === id) {
        if (remaining.length === 0) {
          restoreFixture();
        } else {
          try {
            const next = await getBook(remaining[0].id);
            if (next) {
              setCurrentDocument(next.document);
              setCurrentBookId(next.id);
              setCurrentBookSaved(true);
              setPage(0);
            } else {
              restoreFixture();
            }
          } catch (error) {
            restoreFixture();
            setStorageNotice(`删除后打开下一本书失败：${errorMessage(error, '未知错误')}`);
            return;
          }
        }
      }
      setStorageNotice(null);
    } catch (error) {
      setStorageNotice(`删除书籍失败：${errorMessage(error, '未知错误')}`);
    }
  };

  const measureRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    const measure = (candidate: Block[]) => {
      node.replaceChildren(...candidate.map((block) => {
        const element = document.createElement(block.type === 'heading' ? 'h3' : 'p');
        element.className = block.type === 'heading' ? 'section-heading' : block.type === 'blank' ? 'blank-block' : block.continuation ? 'body-paragraph continuation' : 'body-paragraph';
        element.textContent = block.text;
        return element;
      }));
      return node.scrollHeight <= node.clientHeight + 1;
    };
    setExplicitPages(paginateExplicit(blocks, measure, { fillRemainder: mode === 'explicit' }));
  }, [blocks, fontSize, mode]);

  const totalCharacters = blocks.reduce((sum, block) => sum + block.text.length, 0);
  return <div className="app-shell" style={{ '--body-size': `${fontSize}px` } as CSSProperties}>
    <aside className="control-panel">
      <div className="brand"><span className="brand-mark">PN</span><div><strong>PaperNovel</strong><small>Academic Layout Spike</small></div></div>
      <div className="control-group"><label>Pagination prototype</label><div className="segmented"><button className={mode === 'explicit' ? 'active' : ''} onClick={() => { setMode('explicit'); setPage(0); }}>Explicit pages</button><button className={mode === 'columns' ? 'active' : ''} onClick={() => { setMode('columns'); setPage(0); }}>CSS Columns</button></div></div>
      <div className="control-group"><label>Test document</label><select value={sizeIndex} disabled={Boolean(currentDocument)} onChange={(event) => { setSizeIndex(Number(event.target.value)); setPage(0); }}>{testSizes.map((size, index) => <option value={index} key={size.label}>{size.label}</option>)}</select><small className="muted">{totalCharacters.toLocaleString()} characters · {currentDocument ? 'local TXT' : 'artificial fixture'}</small></div>
      <div className="control-group">
        <label>TXT document</label>
        <div className="import-actions">
          <button type="button" data-testid="txt-import-button" onClick={() => fileInputRef.current?.click()}>导入 TXT</button>
          <button type="button" data-testid="restore-fixture-button" onClick={restoreFixture} disabled={!currentDocument}>恢复示例文本</button>
          <input ref={fileInputRef} data-testid="txt-file-input" type="file" accept=".txt,text/plain" hidden onChange={handleImportTxt} />
        </div>
        <div className="import-title" data-testid="current-document-title">当前文档：{currentDocument ? currentDocument.metadata.title : '示例文本'}</div>
        {currentDocument && <small className="import-note" data-testid="txt-import-note">{currentBookSaved ? '已保存到本地书架，刷新后仍会保留。' : '当前书籍仅保存在内存中，刷新后会丢失。'}</small>}
        {importError && <p className="import-error" role="alert" data-testid="txt-import-error">{importError}</p>}
      </div>
      <div className="control-group" data-testid="bookshelf">
        <label>书架{books.length > 0 ? `（${books.length}）` : ''}</label>
        {shelfLoading ? (
          <p className="shelf-status" data-testid="bookshelf-loading">正在读取本地书架…</p>
        ) : books.length === 0 ? (
          <p className="shelf-empty" data-testid="bookshelf-empty">书架为空。导入 TXT 后会保存在这里。</p>
        ) : (
          <div className="bookshelf-list" data-testid="bookshelf-list">
            {books.map((book) => (
              <div className={`bookshelf-item${currentBookId === book.id ? ' active' : ''}`} data-testid="bookshelf-item" key={book.id}>
                <button type="button" className="bookshelf-title" data-testid="bookshelf-open" onClick={() => { void openBook(book.id); }}>{book.title}</button>
                <div className="bookshelf-meta">{book.chapterCount} 章 · {book.characterCount.toLocaleString('zh-CN')} 字 · {formatImportedAt(book.importedAt)}</div>
                {pendingDeleteId === book.id ? (
                  <div className="bookshelf-confirm">
                    <span>删除《{book.title}》？</span>
                    <button type="button" className="bookshelf-confirm-delete" data-testid="bookshelf-confirm-delete" onClick={() => { void handleDeleteBook(book.id); }}>确认删除</button>
                    <button type="button" className="bookshelf-cancel-delete" data-testid="bookshelf-cancel-delete" onClick={() => setPendingDeleteId(null)}>取消</button>
                  </div>
                ) : (
                  <div className="bookshelf-actions">
                    <button type="button" className="bookshelf-delete" data-testid="bookshelf-delete" onClick={() => setPendingDeleteId(book.id)}>删除</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {storageNotice && <p className="storage-notice" role="status" data-testid="storage-notice">{storageNotice}</p>}
      </div>
      <div className="control-group"><label>Body font size</label><div className="font-buttons">{([12, 14, 16, 18] as FontSize[]).map((size) => <button className={fontSize === size ? 'active' : ''} onClick={() => { setFontSize(size); setPage(0); }} key={size}>{size}px</button>)}</div></div>
      <div className="experiment-note"><span className="status-dot" /> 本地原型<br /><small>本地 IndexedDB 书架 · 暂无 EPUB 与阅读进度。</small></div>
      <div className="metrics"><div><span>Mode</span><strong>{mode === 'explicit' ? 'Measured pages' : 'CSS columns'}</strong></div><div><span>Pages</span><strong>{explicitPages.length || '…'}</strong></div><div><span>Viewport</span><strong>Chrome target</strong></div></div>
    </aside>
    <main className="reading-workspace" data-testid="reading-workspace">
      <div className="workspace-topline"><span>Spike 1 / Paper-like reading surface</span><span>Experiment mode · {mode === 'explicit' ? 'B' : 'A'}</span></div>
      <div className="paper-stack">
        <PaperChrome className="front-paper"><FrontMatter title={currentDocument ? currentDocument.metadata.title : 'An Empirical Study of Narrative Structure'} imported={Boolean(currentDocument)} saved={currentBookSaved} /></PaperChrome>
        {mode === 'explicit' ? <ExplicitPages pages={explicitPages.length ? explicitPages : [{ columns: [[], []] }]} page={Math.min(page, Math.max(0, explicitPages.length - 1))} setPage={setPage} /> : <CssColumns pages={explicitPages.length ? explicitPages : [{ columns: [[], []] }]} page={Math.min(page, Math.max(0, explicitPages.length - 1))} setPage={setPage} />}
      </div>
    </main>
    <div className="measure-host paper-column" ref={measureRef} style={{ '--body-size': `${fontSize}px` } as CSSProperties} aria-hidden="true" />
    <pre className="fixture-source" data-testid="fixture-source" aria-hidden="true">{blocks.map((block) => block.text).join('')}</pre>
  </div>;
}
