import { inlineToText } from '@/lib/inline';
import { db, localDay, type DayStats, type Novel } from './db';

/** Words in a chapter's paragraphs (inline markup). */
export function countWords(paragraphs: readonly string[]): number {
  let words = 0;
  for (const paragraph of paragraphs) {
    const text = inlineToText(paragraph).trim();
    if (text) words += text.split(/\s+/).length;
  }
  return words;
}

/** Adds to today's statistics for a novel. Call inside a transaction that includes `db.stats`. */
export async function addStats(
  novelId: string,
  add: Partial<Pick<DayStats, 'seconds' | 'chapters' | 'words'>>,
  now = Date.now(),
): Promise<void> {
  const day = localDay(now);
  const id = `${day}|${novelId}`;
  const row = (await db.stats.get(id)) ?? { id, novelId, day, seconds: 0, chapters: 0, words: 0 };
  await db.stats.put({
    ...row,
    seconds: row.seconds + (add.seconds ?? 0),
    chapters: row.chapters + (add.chapters ?? 0),
    words: row.words + (add.words ?? 0),
  });
}

/** Adds reading time; the reader calls it every minute or so and when it closes. */
export function addReadingTime(novelId: string, seconds: number): Promise<void> {
  if (seconds < 1) return Promise.resolve();
  return db.transaction('rw', db.stats, () => addStats(novelId, { seconds: Math.round(seconds) }));
}

export interface NovelReading {
  novel: Novel;
  /** Chapters marked read, by any means. */
  read: number;
  total: number;
  seconds: number;
}

export interface ReadingStats {
  rows: DayStats[];
  /** Days with any reading, from the statistics and the (shorter) history. */
  days: Set<string>;
  novels: NovelReading[];
}

/** Everything the statistics page shows. Only runs when that page is open. */
export async function readingStats(): Promise<ReadingStats> {
  const [rows, history, novels] = await Promise.all([
    db.stats.toArray(),
    db.history.toArray(),
    db.novels.toArray(),
  ]);
  const seconds = new Map<string, number>();
  for (const row of rows) seconds.set(row.novelId, (seconds.get(row.novelId) ?? 0) + row.seconds);
  const counted = await Promise.all(
    novels.map(async (novel) => ({
      novel,
      read: await db.chapters.where('[novelId+read]').equals([novel.id, 1]).count(),
      total: await db.chapters.where('novelId').equals(novel.id).count(),
      seconds: seconds.get(novel.id) ?? 0,
    })),
  );
  const days = new Set([
    ...rows.filter((row) => row.chapters > 0 || row.seconds >= 60).map((row) => row.day),
    ...history.map((entry) => entry.day),
  ]);
  return {
    rows,
    days,
    novels: counted.filter((n) => n.read > 0 || n.seconds > 0).sort((a, b) => b.read - a.read),
  };
}
