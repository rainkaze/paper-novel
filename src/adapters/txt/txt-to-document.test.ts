import { describe, expect, it } from 'vitest';
import { getParagraphText } from '../../domain/document/text';
import { MAX_TXT_BYTES, txtToBookDocument } from './txt-to-document';

function encode(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodeWithBom(text: string): ArrayBuffer {
  const body = new TextEncoder().encode(text);
  const bytes = new Uint8Array(3 + body.length);
  bytes.set([0xef, 0xbb, 0xbf], 0);
  bytes.set(body, 3);
  return bytes.buffer;
}

describe('TXT to BookDocument adapter', () => {
  it('parses UTF-8 chapters, paragraphs and filename title', () => {
    const document = txtToBookDocument(encode('第一章 起点\n\n第一段。\n\n第二段。\n\n第二章 归途\n\n第三段。'), '我的测试书.txt');

    expect(document.schemaVersion).toBe(1);
    expect(document.metadata.title).toBe('我的测试书');
    expect(document.source.format).toBe('txt');
    expect(document.bookId).toMatch(/^book_/);
    expect(document.chapters.map((chapter) => chapter.title)).toEqual(['第一章 起点', '第二章 归途']);
    expect(document.chapters[0].paragraphs.map(getParagraphText)).toEqual(['第一段。', '第二段。']);
    expect(document.chapters[1].paragraphs.map(getParagraphText)).toEqual(['第三段。']);
  });

  it('treats a file without chapter headings as one chapter', () => {
    const document = txtToBookDocument(encode('只有一段文字。\n\n又一段文字。'), '无章节.txt');

    expect(document.chapters).toHaveLength(1);
    expect(document.chapters[0].title).toBe('正文');
    expect(document.chapters[0].paragraphs.map(getParagraphText)).toEqual(['只有一段文字。', '又一段文字。']);
  });

  it('keeps text before the first heading in a leading chapter', () => {
    const document = txtToBookDocument(encode('书名页\n\n第一章 起点\n\n正文。'), '前言.txt');

    expect(document.chapters.map((chapter) => chapter.title)).toEqual(['正文', '第一章 起点']);
    expect(document.chapters[0].paragraphs.map(getParagraphText)).toEqual(['书名页']);
  });

  it('recognizes English and prologue chapter headings', () => {
    const document = txtToBookDocument(encode('Chapter 1 Arrival\n\nBody.\n\n序章\n\nPrologue.'), 'chapters.txt');

    expect(document.chapters.map((chapter) => chapter.title)).toEqual(['Chapter 1 Arrival', '序章']);
  });

  it('splits paragraphs on newlines and filters blank lines', () => {
    const document = txtToBookDocument(encode('第一章 起点\r\n\r\n  第一段。  \r\n\t\r\n第二段。\r\n'), '换行.txt');

    expect(document.chapters[0].paragraphs.map(getParagraphText)).toEqual(['第一段。', '第二段。']);
    for (const paragraph of document.chapters[0].paragraphs) {
      expect(getParagraphText(paragraph)).not.toContain('\r');
    }
  });

  it('marks dialogue paragraphs', () => {
    const document = txtToBookDocument(encode('“你好。”他说。'), '对话.txt');

    expect(document.chapters[0].paragraphs[0].kind).toBe('dialogue');
  });

  it('strips a UTF-8 BOM before parsing', () => {
    const document = txtToBookDocument(encodeWithBom('第一章 起点\n\n正文。'), 'bom.txt');

    expect(document.chapters[0].title).toBe('第一章 起点');
    expect(document.chapters[0].paragraphs.map(getParagraphText)).toEqual(['正文。']);
  });

  it('derives the title from the basename only', () => {
    const document = txtToBookDocument(encode('正文。'), 'D:\\books\\我的小说.TXT');

    expect(document.metadata.title).toBe('我的小说');
  });

  it('rejects an empty file', () => {
    expect(() => txtToBookDocument(new ArrayBuffer(0), 'empty.txt')).toThrow('TXT 文件为空，请选择包含正文的文件。');
  });

  it('rejects a file with no readable text', () => {
    expect(() => txtToBookDocument(encode('   \n\n\t  '), 'blank.txt')).toThrow('TXT 文件中没有可读取的正文。');
  });

  it('rejects non-UTF-8 bytes instead of guessing GBK', () => {
    const gbkBytes = new Uint8Array([0xb2, 0xe2, 0xca, 0xd4]).buffer;

    expect(() => txtToBookDocument(gbkBytes, 'gbk.txt')).toThrow('暂不支持非 UTF-8 编码，请转换后重试');
  });

  it('rejects files larger than 10MB', () => {
    expect(() => txtToBookDocument(new ArrayBuffer(MAX_TXT_BYTES + 1), 'large.txt')).toThrow('TXT 文件超过 10MB 限制，请选择更小的文件。');
  });

  it('creates unique entity IDs', () => {
    const document = txtToBookDocument(encode('第一章 起点\n\n第一段。\n\n第二段。'), 'ids.txt');
    const ids = [
      document.bookId,
      ...document.chapters.map((chapter) => chapter.chapterId),
      ...document.chapters.flatMap((chapter) => chapter.paragraphs.map((paragraph) => paragraph.paragraphId)),
    ];

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toMatch(/^book_/);
    expect(ids[1]).toMatch(/^chapter_/);
    expect(ids[2]).toMatch(/^paragraph_/);
  });
});
