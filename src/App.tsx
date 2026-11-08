import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { buildDocument, testSizes } from './content';
import type { Block } from './content-types';
import { paginateExplicit, type ExplicitPage } from './pagination';

type Mode = 'columns' | 'explicit';
type FontSize = 12 | 14 | 16 | 18;

const abstract = '本文以一段虚构的现场记录为视觉占位文本，观察叙事内容在学术论文式页面中的阅读节奏。本文不对故事进行改写、总结或学术化解释；标题、作者、摘要与关键词仅用于验证页面结构。';

function PaperChrome({ children, pageNumber, className = '', testId }: { children: ReactNode; pageNumber?: number; className?: string; testId?: string }) {
  return <article className={`paper ${className}`} data-testid={testId}>
    <header className="running-head"><span>JOURNAL OF NARRATIVE SYSTEMS</span><span>PAPERNOVEL · VISUAL STUDY</span></header>
    {children}
    <footer className="paper-footer"><span>Research Department · Academic Layout Spike</span><span>{pageNumber ?? ''}</span></footer>
  </article>;
}

function FrontMatter() {
  return <div className="front-matter">
    <h1>An Empirical Study of Narrative Structure</h1>
    <p className="author">Research Department</p>
    <section className="abstract"><h2>Abstract</h2><p>{abstract}</p></section>
    <p className="keywords"><strong>Keywords:</strong> narrative structure; observation; reading interface; typography</p>
  </div>;
}

function BlockView({ block }: { block: Block }) {
  if (block.type === 'heading') return <h3 className="section-heading">{block.text}</h3>;
  if (block.type === 'blank') return <div className="blank-block" aria-hidden="true" />;
  return <p className="body-paragraph">{block.text}</p>;
}

function ExplicitPages({ pages, page, setPage }: { pages: ExplicitPage[]; page: number; setPage: (page: number) => void }) {
  const current = pages[page];
  return <>
    <PaperChrome pageNumber={page + 1} className="explicit-paper">
      <div className="paper-columns explicit-columns">
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
  const blocks = useMemo(() => buildDocument(testSizes[sizeIndex].repeat), [sizeIndex]);

  const measureRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    const measure = (candidate: Block[]) => {
      node.replaceChildren(...candidate.map((block) => {
        const element = document.createElement(block.type === 'heading' ? 'h3' : 'p');
        element.className = block.type === 'heading' ? 'section-heading' : block.type === 'blank' ? 'blank-block' : 'body-paragraph';
        element.textContent = block.text;
        return element;
      }));
      return node.scrollHeight <= node.clientHeight + 1;
    };
    setExplicitPages(paginateExplicit(blocks, measure));
  }, [blocks, fontSize]);

  const totalCharacters = blocks.reduce((sum, block) => sum + block.text.length, 0);
  return <div className="app-shell" style={{ '--body-size': `${fontSize}px` } as CSSProperties}>
    <aside className="control-panel">
      <div className="brand"><span className="brand-mark">PN</span><div><strong>PaperNovel</strong><small>Academic Layout Spike</small></div></div>
      <div className="control-group"><label>Pagination prototype</label><div className="segmented"><button className={mode === 'explicit' ? 'active' : ''} onClick={() => { setMode('explicit'); setPage(0); }}>Explicit pages</button><button className={mode === 'columns' ? 'active' : ''} onClick={() => { setMode('columns'); setPage(0); }}>CSS Columns</button></div></div>
      <div className="control-group"><label>Test document</label><select value={sizeIndex} onChange={(event) => { setSizeIndex(Number(event.target.value)); setPage(0); }}>{testSizes.map((size, index) => <option value={index} key={size.label}>{size.label}</option>)}</select><small className="muted">{totalCharacters.toLocaleString()} characters · artificial fixture</small></div>
      <div className="control-group"><label>Body font size</label><div className="font-buttons">{([12, 14, 16, 18] as FontSize[]).map((size) => <button className={fontSize === size ? 'active' : ''} onClick={() => { setFontSize(size); setPage(0); }} key={size}>{size}px</button>)}</div></div>
      <div className="experiment-note"><span className="status-dot" /> Local-only prototype<br /><small>No EPUB, TXT, storage or network features are enabled.</small></div>
      <div className="metrics"><div><span>Mode</span><strong>{mode === 'explicit' ? 'Measured pages' : 'CSS columns'}</strong></div><div><span>Pages</span><strong>{explicitPages.length || '…'}</strong></div><div><span>Viewport</span><strong>Chrome target</strong></div></div>
    </aside>
    <main className="reading-workspace" data-testid="reading-workspace">
      <div className="workspace-topline"><span>Spike 1 / Paper-like reading surface</span><span>Experiment mode · {mode === 'explicit' ? 'B' : 'A'}</span></div>
      <div className="paper-stack">
        <PaperChrome className="front-paper"><FrontMatter /></PaperChrome>
        {mode === 'explicit' ? <ExplicitPages pages={explicitPages.length ? explicitPages : [{ columns: [[], []] }]} page={Math.min(page, Math.max(0, explicitPages.length - 1))} setPage={setPage} /> : <CssColumns pages={explicitPages.length ? explicitPages : [{ columns: [[], []] }]} page={Math.min(page, Math.max(0, explicitPages.length - 1))} setPage={setPage} />}
      </div>
    </main>
    <div className="measure-host paper-column" ref={measureRef} style={{ '--body-size': `${fontSize}px` } as CSSProperties} aria-hidden="true" />
    <pre className="fixture-source" data-testid="fixture-source" aria-hidden="true">{blocks.map((block) => block.text).join('')}</pre>
  </div>;
}
