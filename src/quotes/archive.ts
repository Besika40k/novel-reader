import { db, type Novel } from '@/db/db';
import { absoluteUrl, cleanText } from '@/lib/html';
import { fetchDocument, fetchText } from '@/lib/http';
import { extractParagraphs, inlineToText } from '@/lib/inline';

// Royal Road removed most chapters of novels that went to Kindle ("stubbing"), and the aggregator
// copies of them lost their quotes. The Internet Archive kept Royal Road's own pages, with every
// quote, so those are the best source for putting quotes back.

/** A Royal Road chapter the Internet Archive has a copy of. */
export interface ArchivedChapter {
  /** Royal Road's chapter id, which stays the same when the novel's URL changes. */
  id: string;
  /** The chapter number in its URL ("chapter-250-surrounded"), when it has one. */
  number?: number;
  slug: string;
  /** Copies, newest first. */
  captures: { url: string; timestamp: string }[];
}

/** The Archive's list of a Royal Road novel's chapters, cached per novel. */
export interface ArchiveIndex {
  novelId: string;
  fictionId: string;
  chapters: ArchivedChapter[];
  fetchedAt: number;
}

const ROYAL_ROAD = 'https://www.royalroad.com';
const INDEX_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** The fiction id in a Royal Road novel or chapter link. */
export function royalRoadFictionId(link: string): string | null {
  return /royalroad\.com\/fiction\/(\d+)/i.exec(link)?.[1] ?? null;
}

/** The Archive's list of 200 OK copies of a fiction's chapter pages, one line per URL. */
export function cdxUrl(fictionId: string): string {
  const params = new URLSearchParams({
    url: `royalroad.com/fiction/${fictionId}/`,
    matchType: 'prefix',
    collapse: 'urlkey',
    fl: 'original,timestamp',
  });
  // Two filters, so they can't go through the record above.
  params.append('filter', 'statuscode:200');
  params.append('filter', 'original:.*/chapter/[0-9]+/[^?#]*$');
  return `https://web.archive.org/cdx/search/cdx?${params}`;
}

export function captureUrl(capture: { url: string; timestamp: string }): string {
  // "id_" asks for the page as it was served, without the Archive's toolbar.
  return `https://web.archive.org/web/${capture.timestamp}id_/${capture.url}`;
}

function chapterNumber(text: string): number | undefined {
  const match = /chapter[\s-]*(\d+)/i.exec(text) ?? /\d+/.exec(text);
  return match ? Number(match[1] ?? match[0]) : undefined;
}

/** Chapters from a CDX reply, grouped by chapter id. */
export function parseCdx(text: string): ArchivedChapter[] {
  const chapters = new Map<string, ArchivedChapter>();
  for (const line of text.split('\n')) {
    const [url, timestamp] = line.trim().split(/\s+/);
    const match = url && /\/chapter\/(\d+)\/([^/?#]+)/.exec(url);
    if (!match || !timestamp) continue;
    const [, id, slug] = match;
    let chapter = chapters.get(id);
    if (!chapter) {
      chapter = { id, number: chapterNumber(slug), slug, captures: [] };
      chapters.set(id, chapter);
    }
    chapter.captures.push({ url, timestamp });
  }
  for (const chapter of chapters.values()) {
    chapter.captures.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
  return [...chapters.values()];
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

/** The archived chapter with the same number as a chapter title, the closest title if several. */
export function findArchivedChapter(
  chapters: readonly ArchivedChapter[],
  title: string,
): ArchivedChapter | undefined {
  const number = chapterNumber(title);
  if (number === undefined) return undefined;
  const titleWords = words(title);
  const overlap = (chapter: ArchivedChapter) =>
    [...words(chapter.slug.replace(/-/g, ' '))].filter((word) => titleWords.has(word)).length;
  return chapters
    .filter((chapter) => chapter.number === number)
    .sort((a, b) => overlap(b) - overlap(a))[0];
}

/** The text of an archived Royal Road chapter page, as plain-text paragraphs. */
export function parseArchivedChapter(doc: Document): string[] {
  const container = doc.querySelector('.chapter-inner');
  if (!container) return [];
  return extractParagraphs(container).map(inlineToText);
}

/** The novel a Royal Road search finds under exactly this title, as a link. */
export function parseRoyalRoadSearch(doc: Document, title: string): string | undefined {
  const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const link = Array.from(doc.querySelectorAll('.fiction-title a[href]')).find(
    (a) => key(cleanText(a)) === key(title),
  );
  return absoluteUrl(link?.getAttribute('href'), ROYAL_ROAD);
}

export async function searchRoyalRoad(title: string): Promise<string | undefined> {
  const url = `${ROYAL_ROAD}/fictions/search?${new URLSearchParams({ title })}`;
  return parseRoyalRoadSearch(await fetchDocument(url), title);
}

async function archiveIndex(
  novel: Novel,
  fictionId: string,
  fresh: boolean,
): Promise<ArchiveIndex> {
  const cached = await db.archives.get(novel.id);
  if (cached?.fictionId === fictionId && !fresh) return cached;
  const index: ArchiveIndex = {
    novelId: novel.id,
    fictionId,
    chapters: parseCdx(await fetchText(cdxUrl(fictionId))),
    fetchedAt: Date.now(),
  };
  await db.archives.put(index);
  return index;
}

/**
 * The archived Royal Road text of a chapter, or undefined when the novel has no Royal Road link
 * or the Archive has no copy of the chapter.
 */
export async function archivedText(novel: Novel, title: string): Promise<string[] | undefined> {
  const fictionId = novel.royalRoadUrl ? royalRoadFictionId(novel.royalRoadUrl) : null;
  if (!fictionId) return undefined;
  let index = await archiveIndex(novel, fictionId, false);
  let chapter = findArchivedChapter(index.chapters, title);
  // New copies turn up now and then; look again for a missing chapter once a week.
  if (!chapter && Date.now() - index.fetchedAt > INDEX_MAX_AGE) {
    index = await archiveIndex(novel, fictionId, true);
    chapter = findArchivedChapter(index.chapters, title);
  }
  // Some copies are error pages saved with a 200; try older ones then.
  for (const capture of chapter?.captures.slice(0, 3) ?? []) {
    const paragraphs = parseArchivedChapter(await fetchDocument(captureUrl(capture)));
    if (paragraphs.length > 0) return paragraphs;
  }
  return undefined;
}
