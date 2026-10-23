import { useSyncExternalStore } from 'react';
import { db, type Chapter, type Novel } from './db';

const CHECKED_KEY = 'novel-reader:library-checked';
const SEEN_KEY = 'novel-reader:updates-seen';
/** How far back the Updates page looks. */
const UPDATES_MS = 30 * 24 * 60 * 60 * 1000;

function readTime(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeTime(key: string, time: number): void {
  try {
    localStorage.setItem(key, String(time));
  } catch {
    // Only affects when the next check is due or which updates count as new.
  }
}

/** When the whole library was last checked for new chapters, or 0. */
export function lastLibraryCheck(): number {
  return readTime(CHECKED_KEY);
}

export function noteLibraryCheck(time = Date.now()): void {
  writeTime(CHECKED_KEY, time);
}

let seen = readTime(SEEN_KEY);
const seenListeners = new Set<() => void>();

/** Updates found after this time haven't been looked at yet. */
export function useUpdatesSeen(): number {
  return useSyncExternalStore(
    (listener) => {
      seenListeners.add(listener);
      return () => seenListeners.delete(listener);
    },
    () => seen,
  );
}

export function markUpdatesSeen(time = Date.now()): void {
  seen = time;
  writeTime(SEEN_KEY, time);
  seenListeners.forEach((listener) => listener());
}

/** Whether a check has found chapters since `since`. */
export async function hasUpdatesSince(since: number): Promise<boolean> {
  return (await db.chapters.where('foundAt').above(since).count()) > 0;
}

export interface Update {
  chapter: Chapter;
  novel: Novel;
}

/** Chapters found by library checks in the last 30 days, newest first, for library novels. */
export async function recentUpdates(now = Date.now()): Promise<Update[]> {
  const chapters = await db.chapters
    .where('foundAt')
    .above(now - UPDATES_MS)
    .reverse()
    .toArray();
  const novels = await db.novels.bulkGet([...new Set(chapters.map((c) => c.novelId))]);
  const byId = new Map(novels.flatMap((novel) => (novel?.inLibrary ? [[novel.id, novel]] : [])));
  return chapters.flatMap((chapter) => {
    const novel = byId.get(chapter.novelId);
    return novel ? [{ chapter, novel }] : [];
  });
}

export interface UpdateGroup {
  /** The local date the chapters were found, YYYY-MM-DD. */
  day: string;
  novel: Novel;
  /** Newest first. */
  chapters: Chapter[];
}

/**
 * Updates grouped by the day they were found and then by novel, so a novel with five new chapters
 * is one entry rather than five. Days and novels keep the newest-first order of `updates`.
 */
export function groupUpdates(
  updates: readonly Update[],
  dayOf: (time: number) => string,
): UpdateGroup[] {
  const groups: UpdateGroup[] = [];
  const byKey = new Map<string, UpdateGroup>();
  for (const { chapter, novel } of updates) {
    const day = dayOf(chapter.foundAt ?? 0);
    const key = `${day}|${novel.id}`;
    let group = byKey.get(key);
    if (!group) {
      group = { day, novel, chapters: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.chapters.push(chapter);
  }
  // One check finds a batch at the same moment, so order within a novel by position instead.
  for (const group of groups) group.chapters.sort((a, b) => b.index - a.index);
  return groups;
}
