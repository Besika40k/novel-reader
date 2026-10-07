import { Dexie, type EntityTable } from 'dexie';
import type { ArchiveIndex } from '@/quotes/archive';

/** IndexedDB can't index booleans, so flags are stored as 0 or 1. */
export type Flag = 0 | 1;

export interface Novel {
  /** `${sourceId}:${key}`, see Source.novelKey. */
  id: string;
  sourceId: string;
  url: string;
  title: string;
  author?: string;
  coverUrl?: string;
  /** The cover as a data: URL, so the library looks right offline. */
  coverData?: string;
  summary?: string;
  genres: string[];
  status?: string;
  /** 1 for library novels; 0 for novels only opened from search or a link. */
  inLibrary: Flag;
  categoryId?: number;
  addedAt: number;
  /** When the details and chapter list were last fetched. */
  checkedAt?: number;
  lastReadUrl?: string;
  lastReadAt?: number;
  /** The novel on Royal Road, whose archived chapters are the best source for quotes. */
  royalRoadUrl?: string;
}

export interface Chapter {
  url: string;
  novelId: string;
  /** Position on the source; see ChapterRef.index. */
  index: number;
  title: string;
  released?: string;
  read: Flag;
  /** How far down the chapter the reader got, 0–1. */
  progress: number;
  /** 1 when the text is stored and readable offline. */
  downloaded: Flag;
}

/** A chapter's text exactly as the source served it. Fixes are applied when it's shown. */
export interface ChapterContent {
  url: string;
  title: string;
  paragraphs: string[];
  fetchedAt: number;
}

export interface Category {
  id: number;
  name: string;
  order: number;
}

/**
 * Dialogue quotes restored in a chapter, from an archived original or by an AI model, kept apart
 * from the source's text.
 */
export interface QuoteFix {
  url: string;
  /** Changed paragraphs, by their index in ChapterContent.paragraphs. */
  paragraphs: Record<number, string>;
  /** The last paragraph index the fix has gone through; AI fixing resumes after it. */
  through: number;
  /** Paragraphs the archived original didn't have; the rules handle them. */
  missed?: number[];
  complete: boolean;
  /** What did the work: AI models as "Provider model", or ARCHIVE_SOURCE. */
  models: string[];
  /** The prompt version (see src/quotes/fixer.ts); older fixes are redone. */
  version: number;
  createdAt: number;
}

export const db = new Dexie('novel-reader') as Dexie & {
  novels: EntityTable<Novel, 'id'>;
  chapters: EntityTable<Chapter, 'url'>;
  contents: EntityTable<ChapterContent, 'url'>;
  categories: EntityTable<Category, 'id'>;
  fixes: EntityTable<QuoteFix, 'url'>;
  archives: EntityTable<ArchiveIndex, 'novelId'>;
};

db.version(1).stores({
  novels: 'id, inLibrary',
  chapters: 'url, novelId, [novelId+index], [novelId+read], [novelId+downloaded]',
  contents: 'url',
  categories: '++id, order',
});
db.version(2).stores({ fixes: 'url' });
db.version(3).stores({ archives: 'novelId' });

db.on('populate', async (tx) => {
  await tx
    .table('categories')
    .bulkAdd(
      ['Reading', 'Plan to read', 'Completed', 'Dropped'].map((name, order) => ({ name, order })),
    );
});

/** All chapters of a novel, in reading order. */
export function chaptersOf(novelId: string) {
  return db.chapters
    .where('[novelId+index]')
    .between([novelId, Dexie.minKey], [novelId, Dexie.maxKey]);
}
