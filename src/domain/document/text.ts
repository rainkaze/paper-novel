import type { Paragraph } from './types';

/** The canonical text addressed by reading positions and pagination offsets. */
export function getParagraphText(paragraph: Paragraph): string {
  return paragraph.runs.map((run) => run.text).join('');
}

/** Count Unicode code points, not UTF-16 code units. */
export function getCodePointLength(text: string): number {
  return Array.from(text).length;
}

/** Convert a code point offset to a JavaScript UTF-16 string index. */
export function codePointOffsetToUtf16Index(text: string, offset: number): number {
  assertOffset(offset, getCodePointLength(text));
  let utf16Index = 0;
  let codePointIndex = 0;
  for (const codePoint of text) {
    if (codePointIndex === offset) return utf16Index;
    utf16Index += codePoint.length;
    codePointIndex += 1;
  }
  return utf16Index;
}

/** Slice by code point offsets, preserving surrogate pairs. End offset is exclusive. */
export function sliceByCodePoints(text: string, start: number, end?: number): string {
  const length = getCodePointLength(text);
  assertOffset(start, length);
  const finalOffset = end ?? length;
  assertOffset(finalOffset, length);
  if (finalOffset < start) throw new RangeError('end offset must be greater than or equal to start offset');
  return Array.from(text).slice(start, finalOffset).join('');
}

function assertOffset(offset: number, length: number): void {
  if (!Number.isInteger(offset) || offset < 0 || offset > length) {
    throw new RangeError(`offset must be an integer between 0 and ${length}`);
  }
}
