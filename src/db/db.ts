import { Dexie, type EntityTable } from 'dexie';

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

export const db = new Dexie('novel-reader') as Dexie & {
  novels: EntityTable<Novel, 'id'>;
  chapters: EntityTable<Chapter, 'url'>;
  contents: EntityTable<ChapterContent, 'url'>;
  categories: EntityTable<Category, 'id'>;
};

db.version(1).stores({
  novels: 'id, inLibrary',
  chapters: 'url, novelId, [novelId+index], [novelId+read], [novelId+downloaded]',
  contents: 'url',
  categories: '++id, order',
});

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
