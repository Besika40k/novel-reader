import { Dexie } from 'dexie';
import { mapLimit } from '@/lib/async';
import { fetchDataUrl } from '@/lib/http';
import { addStats, countWords } from './stats';
import { noteLibraryCheck } from './updates';
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

/** A site's own lists of novels, in Browse. */
export function sitePath(sourceId: string): string {
  return `/browse/${encodeURIComponent(sourceId)}`;
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

/** A chapter title reduced to what tells chapters apart: "CH1134 Delair’s Perspective" and
 * "Chapter 1134 Delair's Perspective" give the same key. Titles without a number give none. */
export function titleKey(title: string): string | undefined {
  const key = title
    .toLowerCase()
    .replace(/^\s*(?:chapter|ch)\.?\s*(?=\d)/, 'chapter ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return /\d/.test(key) ? key : undefined;
}

/**
 * Chapters a site lists twice (its scraper sometimes copies a run of chapters again under
 * slightly different titles, as "CH1131" after "Chapter 1131"). Maps each later copy's URL to
 * the first copy's.
 */
export function findRepeats(
  chapters: Pick<Chapter, 'url' | 'index' | 'title'>[],
): Map<string, string> {
  const first = new Map<string, string>();
  const repeats = new Map<string, string>();
  for (const chapter of [...chapters].sort((a, b) => a.index - b.index)) {
    const key = titleKey(chapter.title);
    if (!key) continue;
    const kept = first.get(key);
    if (kept === undefined) first.set(key, chapter.url);
    else if (kept !== chapter.url) repeats.set(chapter.url, kept);
  }
  return repeats;
}

/**
 * Adds new chapters and updates titles of known ones, keeping reading state. New chapters get
 * `foundAt` when given, for the Updates page. Chapters the site lists twice are left out, and
 * stored ones removed with their reading state moved to the first copy. Returns how many are new.
 */
async function mergeChapters(
  novelId: string,
  refs: ChapterRef[],
  foundAt?: number,
): Promise<number> {
  return db.transaction('rw', [db.chapters, db.contents, db.novels], async () => {
    const stored = new Map((await chaptersOf(novelId).toArray()).map((row) => [row.url, row]));
    const rows = new Map<string, Chapter>(stored);
    let added = 0;
    for (const ref of refs) {
      const known = stored.get(ref.url);
      if (!known) added++;
      rows.set(
        ref.url,
        known
          ? { ...known, index: ref.index, title: ref.title, released: ref.released }
          : { ...ref, novelId, read: 0, progress: 0, downloaded: 0, foundAt },
      );
    }

    const repeats = findRepeats([...rows.values()]);
    for (const [url, keptUrl] of repeats) {
      const copy = rows.get(url)!;
      const kept = rows.get(keptUrl)!;
      if (!stored.has(url)) added--;
      rows.set(keptUrl, {
        ...kept,
        read: copy.read || kept.read,
        progress: Math.max(copy.progress, kept.progress),
        bookmarked: copy.bookmarked || kept.bookmarked,
      });
      rows.delete(url);
    }
    const removed = [...repeats.keys()].filter((url) => stored.has(url));
    if (removed.length > 0) {
      await db.chapters.bulkDelete(removed);
      await db.contents.bulkDelete(removed);
      const novel = await db.novels.get(novelId);
      const lastRead = novel?.lastReadUrl && repeats.get(novel.lastReadUrl);
      if (lastRead) await db.novels.update(novelId, { lastReadUrl: lastRead });
    }
    await db.chapters.bulkPut([...rows.values()]);
    return added;
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

/** How often a library check also refetches a novel's details (summary, genres, status, cover). */
const DETAILS_MS = 7 * 24 * 60 * 60 * 1000;
/** Sites a library check works on at once; novels from one site are checked one at a time. */
const SITES_AT_ONCE = 3;

/** Whether a library check should refetch a novel's details page as well as its chapter list. */
export function needsDetails(novel: Pick<Novel, 'detailsAt'>, now = Date.now()): boolean {
  return novel.detailsAt === undefined || now - novel.detailsAt >= DETAILS_MS;
}

async function doRefresh(novelId: string, withDetails: boolean): Promise<number> {
  const novel = await db.novels.get(novelId);
  if (!novel) throw new Error('This novel is no longer stored.');
  const source = getSource(novel.sourceId);
  // The last stored position, not the number stored: chapters a site lists twice aren't kept.
  const knownCount = (await chaptersOf(novelId).last())?.index ?? 0;
  const [details, refs] = await Promise.all([
    withDetails || knownCount === 0 ? source.getNovel(novel.url) : undefined,
    source.getChapterList(novel.url, { knownCount }),
  ]);
  // A brand-new novel's whole list isn't news; only growth of a known list is.
  const added = await mergeChapters(novelId, refs, knownCount ? Date.now() : undefined);
  const now = Date.now();
  if (!details) {
    await db.novels.update(novelId, { checkedAt: now });
    return added;
  }
  await db.novels.update(novelId, {
    title: details.title,
    author: details.author,
    summary: details.summary,
    genres: details.genres,
    status: details.status,
    coverUrl: details.coverUrl ?? novel.coverUrl,
    checkedAt: now,
    detailsAt: now,
  });
  const coverUrl = details.coverUrl ?? novel.coverUrl;
  if (coverUrl && (!novel.coverData || coverUrl !== novel.coverUrl)) {
    // The cover is a nicety; a failed download must not fail the refresh.
    fetchDataUrl(coverUrl)
      .then((coverData) => db.novels.update(novelId, { coverData }))
      .catch(() => undefined);
  }
  return knownCount === 0 ? 0 : added;
}

/**
 * Fetches a novel's chapter list and, unless `details` is false, its details page. Returns the
 * number of new chapters.
 */
export function refreshNovel(
  novelId: string,
  { details = true }: { details?: boolean } = {},
): Promise<number> {
  const running = refreshing.get(novelId);
  if (running) return running;
  const task = doRefresh(novelId, details).finally(() => {
    refreshing.delete(novelId);
    notifyRefreshing();
  });
  refreshing.set(novelId, task);
  notifyRefreshing();
  return task;
}

/**
 * Checks every library novel for new chapters. Only the chapter list is fetched, plus the details
 * page once a week, which halves the requests; different sites are checked side by side, one
 * novel at a time per site. Returns the number of new chapters found.
 */
export async function updateLibrary(): Promise<{ added: number; failed: number }> {
  noteLibraryCheck();
  const novels = await db.novels.where('inLibrary').equals(1).toArray();
  const bySite = new Map<string, Novel[]>();
  for (const novel of novels)
    bySite.set(novel.sourceId, [...(bySite.get(novel.sourceId) ?? []), novel]);
  let added = 0;
  let failed = 0;
  await mapLimit([...bySite.values()], SITES_AT_ONCE, async (siteNovels) => {
    for (const novel of siteNovels) {
      try {
        added += await refreshNovel(novel.id, { details: needsDetails(novel) });
      } catch {
        failed += 1;
      }
    }
  });
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

/** The next `count` chapters after `index` that aren't downloaded yet, in reading order. */
export async function chaptersAhead(
  novelId: string,
  index: number,
  count: number,
): Promise<Chapter[]> {
  const next = await db.chapters
    .where('[novelId+index]')
    .between([novelId, index + 1], [novelId, index + count], true, true)
    .toArray();
  return next.filter((chapter) => chapter.downloaded === 0);
}

export async function deleteDownloads(urls: string[]): Promise<void> {
  await db.transaction('rw', db.contents, db.fixes, db.chapters, async () => {
    await db.contents.bulkDelete(urls);
    await db.fixes.bulkDelete(urls);
    await db.chapters.where('url').anyOf(urls).modify({ downloaded: 0 });
  });
}

/**
 * Saves the reading position; reaching the end marks the chapter read and, the first time,
 * counts it in today's statistics.
 */
export async function saveProgress(url: string, progress: number): Promise<void> {
  await db.transaction('rw', db.chapters, db.contents, db.stats, async () => {
    const row = await db.chapters.get(url);
    if (!row) return;
    const finished = progress >= 0.98;
    await db.chapters.update(url, finished ? { progress, read: 1 } : { progress });
    if (!finished || row.read === 1) return;
    const content = await db.contents.get(url);
    await addStats(row.novelId, {
      chapters: 1,
      words: content ? countWords(content.paragraphs) : 0,
    });
  });
}

export async function setBookmark(url: string, bookmarked: boolean): Promise<void> {
  await db.chapters.update(url, { bookmarked: bookmarked ? 1 : 0 });
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

/** Removes one day's entry for a novel from the history. */
export async function deleteHistoryEntry(id: string): Promise<void> {
  await db.history.delete(id);
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
