import { getParagraphText } from '../../domain/document/text';
import type { BookDocument, Chapter, Paragraph } from '../../domain/document/types';
import type { Block } from '../../content-types';

/** Temporary compatibility view consumed by the Spike 1 reader and paginator. */
export function documentToBlocks(document: BookDocument): Block[] {
  const blocks: Block[] = [];
  for (const chapter of document.chapters) {
    blocks.push({ id: chapter.chapterId, type: 'heading', text: chapter.title });
    for (const paragraph of chapter.paragraphs) {
      blocks.push({
        id: paragraph.paragraphId,
        type: paragraph.kind === 'blank' ? 'blank' : 'paragraph',
        text: getParagraphText(paragraph),
      });
    }
  }
  return blocks;
}

/** Build a document from the existing hand-written fixture blocks without changing their text. */
export function blocksToFixtureDocument(blocks: Block[], repeatCount: number): BookDocument {
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | undefined;
  let chapterNumber = 0;
  let paragraphNumber = 0;

  for (const block of blocks) {
    if (block.type === 'heading') {
      currentChapter = {
        chapterId: `fixture-chapter-${chapterNumber++}`,
        title: block.text,
        paragraphs: [],
      };
      chapters.push(currentChapter);
      paragraphNumber = 0;
      continue;
    }

    if (!currentChapter) {
      currentChapter = {
        chapterId: `fixture-chapter-${chapterNumber++}`,
        title: '未分节内容',
        paragraphs: [],
      };
      chapters.push(currentChapter);
    }

    const paragraph: Paragraph = {
      paragraphId: `fixture-paragraph-${chapterNumber - 1}-${paragraphNumber++}`,
      kind: block.type === 'blank' ? 'blank' : block.text.startsWith('“') ? 'dialogue' : 'body',
      runs: block.type === 'blank' ? [] : [{ text: block.text }],
    };
    currentChapter.paragraphs.push(paragraph);
  }

  return {
    schemaVersion: 1,
    bookId: 'paper-novel-fixture',
    metadata: {
      title: 'An Empirical Study of Narrative Structure',
      authors: ['Research Department'],
      language: 'zh-CN',
    },
    source: { format: 'fixture', fingerprint: 'paper-novel:spike-1-fixture' },
    contentHash: `paper-novel-fixture-v1-repeat-${repeatCount}`,
    chapters,
  };
}
