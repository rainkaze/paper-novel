import { createBookId, createChapterId, createParagraphId } from '../../domain/document/ids';
import type { BookDocument, Chapter, Paragraph } from '../../domain/document/types';

export const MAX_TXT_BYTES = 10 * 1024 * 1024;
const MAX_REPLACEMENT_RATIO = 0.01;

const CHAPTER_HEADING = /^\s*(第[一二三四五六七八九十百千0-9]+[章节回卷]|Chapter\s+\d+\b|序章(?=\s|$|[：:、.．])|前言(?=\s|$|[：:、.．])|后记(?=\s|$|[：:、.．])|尾声(?=\s|$|[：:、.．]))/i;

function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function toParagraphs(lines: string[]): Paragraph[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text) => ({
      paragraphId: createParagraphId(),
      kind: /^[“"『「]/.test(text) ? 'dialogue' : 'body',
      runs: [{ text }],
    }));
}

function toChapter(title: string, lines: string[]): Chapter {
  return {
    chapterId: createChapterId(),
    title,
    paragraphs: toParagraphs(lines),
  };
}

/** Convert a UTF-8 TXT file into the in-memory BookDocument model. */
export function txtToBookDocument(buffer: ArrayBuffer, filename: string): BookDocument {
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength === 0) {
    throw new Error('TXT 文件为空，请选择包含正文的文件。');
  }
  if (bytes.byteLength > MAX_TXT_BYTES) {
    throw new Error('TXT 文件超过 10MB 限制，请选择更小的文件。');
  }

  const hasBom = bytes.byteLength >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const contentBytes = hasBom ? bytes.subarray(3) : bytes;
  const decoded = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(contentBytes);
  const replacements = decoded.match(/\uFFFD/g)?.length ?? 0;
  if (replacements > 0 && replacements / decoded.length > MAX_REPLACEMENT_RATIO) {
    throw new Error('暂不支持非 UTF-8 编码，请转换后重试');
  }

  const normalized = decoded.replace(/\r\n?/g, '\n');
  if (normalized.trim().length === 0) {
    throw new Error('TXT 文件中没有可读取的正文。');
  }

  const baseName = (filename.split(/[\\/]/).pop() ?? filename).replace(/\.txt$/i, '').trim();
  const title = baseName || '未命名文档';
  const lines = normalized.split('\n');
  const chapters: Chapter[] = [];
  const preamble: string[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  const flushChapter = () => {
    if (currentTitle !== null) chapters.push(toChapter(currentTitle, currentLines));
    currentTitle = null;
    currentLines = [];
  };

  for (const line of lines) {
    if (CHAPTER_HEADING.test(line)) {
      flushChapter();
      currentTitle = line.trim();
    } else if (currentTitle !== null) {
      currentLines.push(line);
    } else {
      preamble.push(line);
    }
  }
  flushChapter();

  const preambleParagraphs = toParagraphs(preamble);
  if (preambleParagraphs.length > 0) {
    chapters.unshift({ chapterId: createChapterId(), title: '正文', paragraphs: preambleParagraphs });
  }
  if (chapters.length === 0) {
    chapters.push(toChapter('正文', lines));
  }
  const hash = hashText(normalized);
  return {
    schemaVersion: 1,
    bookId: createBookId(),
    metadata: {
      title,
      authors: [],
    },
    source: {
      format: 'txt',
      fingerprint: `txt:${baseName}:${bytes.byteLength}:${hash}`,
    },
    contentHash: `txt-${hash}`,
    chapters,
  };
}
