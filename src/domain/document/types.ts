export type Id = string;

export interface BookDocument {
  schemaVersion: 1;
  bookId: Id;
  metadata: {
    title: string;
    authors: string[];
    language?: string;
  };
  source: {
    format: 'txt' | 'epub' | 'fixture';
    fingerprint: string;
  };
  contentHash: string;
  chapters: Chapter[];
}

export interface Chapter {
  chapterId: Id;
  title: string;
  paragraphs: Paragraph[];
}

export interface Paragraph {
  paragraphId: Id;
  kind: 'body' | 'dialogue' | 'blank';
  runs: TextRun[];
}

export interface TextRun {
  text: string;
  marks?: Array<'emphasis' | 'strong'>;
}

export interface ReadingPosition {
  bookId: Id;
  chapterId: Id;
  paragraphId: Id;
  /** Unicode code point offset into getParagraphText(paragraph). */
  characterOffset: number;
  affinity: 'forward' | 'backward';
}

export interface ReadingProgress {
  position: ReadingPosition;
  contentHash: string;
  updatedAt: number;
}
