import type { Block } from './content';

export type PageColumn = Block[];
export type ExplicitPage = { columns: [PageColumn, PageColumn] };

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

export function paginateExplicit(blocks: Block[], measure: (blocks: Block[]) => boolean): ExplicitPage[] {
  const pages: ExplicitPage[] = [];
  let page: ExplicitPage = { columns: [[], []] };
  let column = 0;

  const pushColumn = () => {
    if (column === 0) column = 1;
    else {
      pages.push(page);
      page = { columns: [[], []] };
      column = 0;
    }
  };

  const addBlock = (block: Block) => {
    const target = page.columns[column] as Block[];
    if (measure([...target, block])) {
      target.push(block);
      return;
    }
    if (target.length > 0) pushColumn();
    const freshTarget = page.columns[column] as Block[];
    if (measure([...freshTarget, block])) {
      freshTarget.push(block);
      return;
    }
    if (block.type === 'paragraph' && block.text.length > 1) {
      const pieces = splitText(block.text, (text) => measure([...page.columns[column], { ...block, text }]));
      pieces.forEach((text, index) => addBlock({ ...block, id: `${block.id}-part-${index}`, text }));
    } else {
      freshTarget.push(block);
    }
  };

  blocks.forEach((block, index) => {
    const next = blocks[index + 1];
    if (block.type === 'heading' && next?.type === 'paragraph') {
      const target = page.columns[column];
      if (target.length > 0 && !measure([...target, block, next])) pushColumn();
    }
    addBlock(block);
  });
  if (page.columns[0].length || page.columns[1].length) pages.push(page);
  return pages;
}
