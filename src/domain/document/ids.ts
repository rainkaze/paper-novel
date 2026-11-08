export type EntityIdKind = 'book' | 'chapter' | 'paragraph';

/** Generate a collision-resistant, entity-scoped ID independent of content and array order. */
export function createEntityId(kind: EntityIdKind): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) throw new Error('Secure random UUID support is required to generate document IDs.');
  return `${kind}_${uuid}`;
}

export const createBookId = (): string => createEntityId('book');
export const createChapterId = (): string => createEntityId('chapter');
export const createParagraphId = (): string => createEntityId('paragraph');
