import type { Block } from './content';

export type PageColumn = Block[];
export type ExplicitPage = { columns: [PageColumn, PageColumn] };
export type PaginationOptions = {
  /** Fill the remaining column space of Explicit pages by splitting paragraphs at sentence boundaries. */
  fillRemainder?: boolean;
};

function splitText(text: string, fit: (candidate: string) => boolean): string[] {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let low = cursor + 1;
    let high = text.length;
    let best = low;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (fit(text.slice(cursor, middle))) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    const candidate = text.slice(cursor, best);
    const punctuation = Math.max(candidate.lastIndexOf('。'), candidate.lastIndexOf('！'), candidate.lastIndexOf('？'), candidate.lastIndexOf('；'));
    const cut = punctuation > candidate.length * 0.55 ? punctuation + 1 : best;
    chunks.push(text.slice(cursor, cut));
    cursor = cut;
  }
  return chunks;
}

function findFittingSentence(text: string, fit: (candidate: string) => boolean): { head: string; tail: string } | null {
  let low = 1;
  let high = text.length;
  let best = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (fit(text.slice(0, middle))) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (best === 0) return null;
  const candidate = text.slice(0, best);
  const boundary = /[。！？；]+[”’」』）】]*|[.!?;]+(?=\s|$)[”’」』）】]*/g;
  let cut = 0;
  for (const match of candidate.matchAll(boundary)) {
    cut = (match.index ?? 0) + match[0].length;
  }
  if (cut === 0 || cut < best * 0.55) return null;
  return { head: text.slice(0, cut), tail: text.slice(cut) };
}

export function paginateExplicit(blocks: Block[], measure: (blocks: Block[]) => boolean, options: PaginationOptions = {}): ExplicitPage[] {
  const fillRemainder = options.fillRemainder === true;
  const pages: ExplicitPage[] = [];
  let page: ExplicitPage = { columns: [[], []] };
  let column = 0;
  let partId = 0;

  const pushColumn = () => {
    if (column === 0) column = 1;
    else {
      pages.push(page);
      page = { columns: [[], []] };
      column = 0;
    }
  };

  const addParagraph = (block: Block, allowFillSplit: boolean) => {
    const target = page.columns[column] as Block[];
    if (measure([...target, block])) {
      target.push(block);
      return;
    }
    if (fillRemainder && allowFillSplit) {
      const split = findFittingSentence(block.text, (text) => measure([...target, { ...block, text, continuation: block.continuation }]));
      if (split) {
        target.push({ ...block, id: `${block.id}-part-${partId++}`, text: split.head, continuation: block.continuation });
        pushColumn();
        addParagraph({ ...block, id: `${block.id}-part-${partId++}`, text: split.tail, continuation: true }, false);
        return;
      }
    }
    if (target.length > 0) pushColumn();
    const freshTarget = page.columns[column] as Block[];
    if (measure([...freshTarget, block])) {
      freshTarget.push(block);
      return;
    }
    if (block.type === 'paragraph' && block.text.length > 1) {
      const pieces = splitText(block.text, (text) => measure([...page.columns[column], { ...block, text, continuation: block.continuation }]));
      pieces.forEach((text, index) => addParagraph({ ...block, id: `${block.id}-part-${partId++}`, text, continuation: fillRemainder && (index > 0 || block.continuation) }, false));
    } else {
      freshTarget.push(block);
    }
  };

  const addBlock = (block: Block, allowFillSplit: boolean) => {
    if (block.type === 'paragraph') {
      addParagraph(block, allowFillSplit);
      return;
    }
    const target = page.columns[column] as Block[];
    if (measure([...target, block])) {
      target.push(block);
      return;
    }
    if (target.length > 0) pushColumn();
    (page.columns[column] as Block[]).push(block);
  };

  blocks.forEach((block, index) => {
    const next = blocks[index + 1];
    const isFinal = index === blocks.length - 1;
    if (block.type === 'heading' && next?.type === 'paragraph') {
      const target = page.columns[column];
      if (target.length > 0 && !measure([...target, block, next])) {
        const nextIsFinal = index + 1 === blocks.length - 1;
        const keepHeading = fillRemainder && !nextIsFinal
          && findFittingSentence(next.text, (text) => measure([...target, block, { ...next, text, continuation: next.continuation }])) !== null;
        if (!keepHeading) pushColumn();
      }
    }
    addBlock(block, !isFinal);
  });
  if (page.columns[0].length || page.columns[1].length) pages.push(page);
  return pages;
}
