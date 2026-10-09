import { Dexie } from 'dexie';
import { fetchDataUrl } from '@/lib/http';
import { getSource, sourceForUrl } from '@/sources';
import type { ChapterRef, NovelSummary, Source } from '@/sources/types';
import {
  chaptersOf,
  db,
  localDay,
  type Chapter,
  type ChapterContent,
  type HistoryEntry,
  type Novel,
} from './db';

export function novelPath(id: string): string {
  return `/novel/${encodeURIComponent(id)}`;
}

export function readerPath(novelId: string, index: number): string {
  return `/read/${encodeURIComponent(novelId)}/${index}`;
}

function titleFromKey(key: string): string {
  return key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Makes sure a novel has a record (outside the library until added) and returns its id. */
export async function ensureNovel(source: Source, summary: NovelSummary): Promise<string> {
  const key = source.novelKey(summary.url);
  if (!key) throw new Error('That link is not a novel page.');
  const id = `${source.id}:${key}`;
  const existing = await db.novels.get(id);
  if (!existing) {
    await db.novels.add({
      id,
      sourceId: source.id,
      url: source.novelUrl(key),
      title: summary.title || titleFromKey(key),
      coverUrl: summary.coverUrl,
      genres: [],
      inLibrary: 0,
      addedAt: Date.now(),
    });
  }
  return id;
}

/** Resolves a pasted novel or chapter link to a novel record. */
export async function novelFromLink(link: string): Promise<string> {
  const url = link.trim();
  const source = sourceForUrl(url);
  if (!source) throw new Error('No supported site recognises that link.');
  const key = source.novelKey(url);
  if (!key) throw new Error('That link is not a novel or chapter page.');
  return ensureNovel(source, { url: source.novelUrl(key), title: titleFromKey(key) });
}

/** Adds new chapters and updates titles of known ones, keeping reading state. Returns how many are new. */
async function mergeChapters(novelId: string, refs: ChapterRef[]): Promise<number> {
  return db.transaction('rw', db.chapters, async () => {
    const existing = await db.chapters.bulkGet(refs.map((ref) => ref.url));
    const rows: Chapter[] = refs.map((ref, i) => {
      const known = existing[i];
      if (known) return { ...known, index: ref.index, title: ref.title, released: ref.released };
      return { ...ref, novelId, read: 0, progress: 0, downloaded: 0 };
    });
    await db.chapters.bulkPut(rows);
    return existing.filter((row) => !row).length;
  });
}

const refreshing = new Map<string, Promise<number>>();
const refreshListeners = new Set<() => void>();

function notifyRefreshing() {
  refreshListeners.forEach((listener) => listener());
}

export function subscribeRefreshing(listener: () => void): () => void {
  refreshListeners.add(listener);
  return () => refreshListeners.delete(listener);
}

export function isRefreshing(novelId: string): boolean {
  return refreshing.has(novelId);
}

async function doRefresh(novelId: string): Promise<number> {
  const novel = await db.novels.get(novelId);
  if (!novel) throw new Error('This novel is no longer stored.');
  const source = getSource(novel.sourceId);
  const knownCount = await db.chapters.where('novelId').equals(novelId).count();
  const [details, refs] = await Promise.all([
    source.getNovel(novel.url),
    source.getChapterList(novel.url, { knownCount }),
  ]);
  const added = await mergeChapters(novelId, refs);
  await db.novels.update(novelId, {
    title: details.title,
    author: details.author,
    summary: details.summary,
    genres: details.genres,
    status: details.status,
    coverUrl: details.coverUrl ?? novel.coverUrl,
    checkedAt: Date.now(),
  });
  const coverUrl = details.coverUrl ?? novel.coverUrl;
  if (coverUrl && (!novel.coverData || coverUrl !== novel.coverUrl)) {
    // The cover is a nicety; a failed download must not fail the refresh.
    fetchDataUrl(coverUrl)
      .then((coverData) => db.novels.update(novelId, { coverData }))
      .catch(() => undefined);
  }
  // A brand-new novel's whole list counts as "added"; only report growth of a known list.
  return knownCount === 0 ? 0 : added;
}

/** Fetches a novel's details and chapter list. Returns the number of new chapters. */
export function refreshNovel(novelId: string): Promise<number> {
  const running = refreshing.get(novelId);
  if (running) return running;
  const task = doRefresh(novelId).finally(() => {
    refreshing.delete(novelId);
    notifyRefreshing();
  });
  refreshing.set(novelId, task);
  notifyRefreshing();
  return task;
}

/** Refreshes every library novel, one at a time. Returns the number of new chapters found. */
export async function updateLibrary(): Promise<{ added: number; failed: number }> {
  const novels = await db.novels.where('inLibrary').equals(1).toArray();
  let added = 0;
  let failed = 0;
  for (const novel of novels) {
    try {
      added += await refreshNovel(novel.id);
    } catch {
      failed += 1;
    }
  }
  return { added, failed };
}

export async function addToLibrary(novelId: string, categoryId: number): Promise<void> {
  await db.novels.update(novelId, { inLibrary: 1, categoryId, addedAt: Date.now() });
}

export async function removeFromLibrary(novelId: string): Promise<void> {
  await db.novels.update(novelId, { inLibrary: 0 });
}

export async function setCategory(novelId: string, categoryId: number): Promise<void> {
  await db.novels.update(novelId, { categoryId });
}

const loading = new Map<string, Promise<ChapterContent>>();

/** A chapter's text: from storage when downloaded, otherwise fetched and stored for offline use. */
export function loadChapterContent(url: string): Promise<ChapterContent> {
  const running = loading.get(url);
  if (running) return running;
  const task = (async () => {
    const stored = await db.contents.get(url);
    if (stored) return stored;
    const chapter = await db.chapters.get(url);
    if (!chapter) throw new Error('This chapter is no longer in the list.');
    const novel = await db.novels.get(chapter.novelId);
    if (!novel) throw new Error('This novel is no longer stored.');
    const text = await getSource(novel.sourceId).getChapter(url);
    const content: ChapterContent = {
      url,
      title: text.title || chapter.title,
      paragraphs: text.paragraphs,
      fetchedAt: Date.now(),
    };
    await db.transaction('rw', db.contents, db.chapters, async () => {
      await db.contents.put(content);
      await db.chapters.update(url, { downloaded: 1 });
    });
    return content;
  })().finally(() => loading.delete(url));
  loading.set(url, task);
  return task;
}

export async function deleteDownloads(urls: string[]): Promise<void> {
  await db.transaction('rw', db.contents, db.fixes, db.chapters, async () => {
    await db.contents.bulkDelete(urls);
    await db.fixes.bulkDelete(urls);
    await db.chapters.where('url').anyOf(urls).modify({ downloaded: 0 });
  });
}

/** Saves the reading position; reaching the end marks the chapter read. */
export async function saveProgress(url: string, progress: number): Promise<void> {
  const changes: Partial<Chapter> = { progress };
  if (progress >= 0.98) changes.read = 1;
  await db.chapters.update(url, changes);
}

export async function markRead(urls: string[], read: boolean): Promise<void> {
  await db.chapters
    .where('url')
    .anyOf(urls)
    .modify(read ? { read: 1 } : { read: 0, progress: 0 });
}

/** How long reading history is kept; the History tab shows the last week of it. */
const HISTORY_KEPT_MS = 30 * 24 * 60 * 60 * 1000;

export async function setLastRead(novelId: string, chapterUrl: string): Promise<void> {
  const now = Date.now();
  const day = localDay(now);
  await db.transaction('rw', db.novels, db.history, async () => {
    await db.novels.update(novelId, { lastReadUrl: chapterUrl, lastReadAt: now });
    await db.history.put({ id: `${day}|${novelId}`, novelId, day, chapterUrl, readAt: now });
    await db.history
      .where('readAt')
      .below(now - HISTORY_KEPT_MS)
      .delete();
  });
}

export interface HistoryItem extends HistoryEntry {
  novel: Novel;
  chapter?: Chapter;
}

/** What was read in the last `days` days, newest first: per day, each novel's last chapter. */
export async function recentHistory(days: number): Promise<HistoryItem[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const entries = await db.history
    .where('readAt')
    .aboveOrEqual(since.getTime())
    .reverse()
    .toArray();
  const [novels, chapters] = await Promise.all([
    db.novels.bulkGet(entries.map((entry) => entry.novelId)),
    db.chapters.bulkGet(entries.map((entry) => entry.chapterUrl)),
  ]);
  return entries.flatMap((entry, i) => {
    const novel = novels[i];
    return novel ? [{ ...entry, novel, chapter: chapters[i] }] : [];
  });
}

/** Where to pick a novel up again: the "continue" chapter, or the novel page without one. */
export async function resumePath(novelId: string): Promise<string> {
  const [novel, chapters] = await Promise.all([
    db.novels.get(novelId),
    chaptersOf(novelId).toArray(),
  ]);
  const chapter = continueChapter(chapters, novel?.lastReadUrl);
  return chapter ? readerPath(novelId, chapter.index) : novelPath(novelId);
}

export async function neighbour(
  novelId: string,
  index: number,
  direction: 'next' | 'previous',
): Promise<Chapter | undefined> {
  const chapters = db.chapters.where('[novelId+index]');
  return direction === 'next'
    ? chapters.between([novelId, index], [novelId, Dexie.maxKey], false, true).first()
    : chapters.between([novelId, Dexie.minKey], [novelId, index], true, false).last();
}

/**
 * Where "continue" should open: the last chapter opened if it isn't finished, else the chapter
 * after it, else the first unread one. Expects chapters in reading order.
 */
export function continueChapter(chapters: Chapter[], lastReadUrl?: string): Chapter | undefined {
  const lastIndex = chapters.findIndex((chapter) => chapter.url === lastReadUrl);
  if (lastIndex >= 0) {
    const last = chapters[lastIndex];
    if (!last.read) return last;
    return chapters[lastIndex + 1] ?? last;
  }
  return chapters.find((chapter) => !chapter.read) ?? chapters[0];
}

export async function unreadCount(novelId: string): Promise<number> {
  return db.chapters.where('[novelId+read]').equals([novelId, 0]).count();
}

export async function libraryNovels(): Promise<(Novel & { unread: number; total: number })[]> {
  const novels = await db.novels.where('inLibrary').equals(1).toArray();
  const counted = await Promise.all(
    novels.map(async (novel) => ({
      ...novel,
      unread: await unreadCount(novel.id),
      total: await chaptersOf(novel.id).count(),
    })),
  );
  return counted.sort(
    (a, b) =>
      (b.lastReadAt ?? b.addedAt) - (a.lastReadAt ?? a.addedAt) || a.title.localeCompare(b.title),
  );
}
