import { mapLimit } from '@/lib/async';
import { absoluteUrl, blockText, cleanText } from '@/lib/html';
import { fetchDocument, fetchText } from '@/lib/http';
import { extractParagraphs } from '@/lib/inline';
import {
  SourceError,
  type ChapterRef,
  type ChapterText,
  type Label,
  type NovelFilter,
  type NovelDetails,
  type NovelSummary,
  type Source,
} from './types';

/*
 * The site template NovelPhoenix and NovelFire both run (LightNovelPub's): the same pages and
 * markup, with novels under a different path.
 */

function imageUrl(img: Element | null, pageUrl: string): string | undefined {
  // Lazy-loaded images keep the real address in data-src and a placeholder in src.
  return (
    absoluteUrl(img?.getAttribute('data-src'), pageUrl) ??
    absoluteUrl(img?.getAttribute('src'), pageUrl)
  );
}

/** The position in a chapter link, e.g. 252 for …/chapter-252. */
function chapterIndex(url: string): number | undefined {
  const match = /\/chapter-(\d+)\/?(?:[?#]|$)/.exec(url);
  return match ? Number(match[1]) : undefined;
}

export function parseSearch(doc: Document, pageUrl: string): NovelSummary[] {
  const items = Array.from(doc.querySelectorAll('.novel-list li.novel-item')).filter(
    // The results page also shows unrelated lists, such as "Some Popular Novels".
    (item) => !item.closest('.popular-novels, .related, aside'),
  );
  return items.flatMap((item) => {
    const link = item.querySelector('a[href]');
    const url = absoluteUrl(link?.getAttribute('href'), pageUrl);
    if (!url) return [];
    const stats = Array.from(item.querySelectorAll('.novel-stats'))
      .map(cleanText)
      .filter((stat) => /chapter/i.test(stat));
    return [
      {
        url,
        title: cleanText(item.querySelector('.novel-title')) || link?.getAttribute('title') || url,
        coverUrl: imageUrl(item.querySelector('img'), pageUrl),
        info: stats[0],
      },
    ];
  });
}

/** A ranking page: 100 novels with their status and the ranking's own figure. */
export function parseRanking(doc: Document, pageUrl: string): NovelSummary[] {
  const items = Array.from(doc.querySelectorAll('li.novel-item')).filter(
    (item) => !item.closest('.popular-novels, aside'),
  );
  return items.flatMap((item): NovelSummary[] => {
    const link = item.querySelector('.title a[href], a[href]');
    const url = absoluteUrl(link?.getAttribute('href'), pageUrl);
    if (!url) return [];
    const rating = Number(item.querySelector('[data-rating]')?.getAttribute('data-rating'));
    const reads = /^([\d.,]+[KMB]?)\s+reads/i.exec(cleanText(item.querySelector('.numberOf')));
    return [
      {
        url,
        title: cleanText(item.querySelector('.title')) || link?.getAttribute('title') || url,
        coverUrl: imageUrl(item.querySelector('img'), pageUrl),
        status: cleanText(item.querySelector('.status')) || undefined,
        rating: rating > 0 ? rating : undefined,
        monthlyReads: reads?.[1],
      },
    ];
  });
}

/** The genres the advanced search page offers, as its checkboxes list them. */
export function parseFilterGenres(doc: Document): Label[] {
  return Array.from(doc.querySelectorAll('input[name="categories[]"]'), (input) => ({
    id: input.getAttribute('value') ?? '',
    name: cleanText(input.closest('label')),
  })).filter((genre) => genre.id && genre.name);
}

/** The answer to /ajax/getTags: `{ data: [{ id, name }] }`. */
export function parseTags(json: string): Label[] {
  const { data } = JSON.parse(json) as { data?: { id: number | string; name: string }[] };
  return (data ?? []).map((tag) => ({ id: String(tag.id), name: tag.name }));
}

const SORTS: Record<NovelFilter['sort'], string> = {
  'monthly-views': 'monthly-view',
  'total-views': 'total-view',
  rating: 'rating-score-top',
  rank: 'rank-top',
  updated: 'date',
};

const STATUSES: Record<NovelFilter['status'], string> = { all: '-1', ongoing: '0', completed: '1' };

export function filterUrl(base: string, filter: NovelFilter, page: number): string {
  const params = new URLSearchParams({
    ctgcon: 'and',
    totalchapter: '0',
    ratcon: 'min',
    rating: String(filter.minRating),
    status: STATUSES[filter.status],
    sort: SORTS[filter.sort],
    tagcon: 'and',
  });
  for (const genre of filter.genres) params.append('categories[]', genre.id);
  for (const tag of filter.tags) params.append('tags[]', tag.id);
  params.set('page', String(page));
  return `${base}/search-adv?${params}`;
}

/** A page of advanced search results, and whether the pager links to a later page. */
export function parseFilterResults(
  doc: Document,
  pageUrl: string,
): { novels: NovelSummary[]; hasMore: boolean } {
  const items = Array.from(doc.querySelectorAll('li.novel-item')).filter(
    (item) => !item.closest('.popular-novels, aside'),
  );
  const novels = items.flatMap((item): NovelSummary[] => {
    const link = item.querySelector('.novel-title a[href], a[href]');
    const url = absoluteUrl(link?.getAttribute('href'), pageUrl);
    if (!url) return [];
    const rating = parseFloat(cleanText(item.querySelector('.rating .text')));
    const chapters = Array.from(item.querySelectorAll('.novel-stats span'))
      .map(cleanText)
      .find((stat) => /chapters?$/i.test(stat));
    return [
      {
        url,
        title: cleanText(item.querySelector('.novel-title')) || link?.getAttribute('title') || url,
        coverUrl: imageUrl(item.querySelector('img'), pageUrl),
        info: chapters,
        status: cleanText(item.querySelector('.status')) || undefined,
        rating: rating > 0 ? rating : undefined,
      },
    ];
  });
  const page = Number(new URL(pageUrl).searchParams.get('page') ?? 1);
  // NovelFire's pager has only a "next" link; NovelPhoenix's numbers its pages too.
  const hasMore = Array.from(doc.querySelectorAll('a[rel="next"][href], .pagination a[href]')).some(
    (link) => Number(/[?&]page=(\d+)/.exec(link.getAttribute('href') ?? '')?.[1] ?? 0) > page,
  );
  return { novels, hasMore };
}

export function parseNovel(doc: Document, pageUrl: string): NovelDetails {
  const title = cleanText(doc.querySelector('.novel-info .novel-title, h1.novel-title'));
  if (!title) throw new SourceError('Could not find the novel on this page.');
  const status = Array.from(doc.querySelectorAll('.header-stats span')).find(
    (stat) => cleanText(stat.querySelector('small')).toLowerCase() === 'status',
  );
  const summary = doc.querySelector('.summary .content')?.cloneNode(true) as Element | undefined;
  summary?.querySelectorAll('.expand').forEach((el) => el.remove());
  return {
    url: pageUrl,
    title,
    author:
      cleanText(doc.querySelector('.novel-info .author [itemprop="author"]')) ||
      cleanText(doc.querySelector('.novel-info .author a')) ||
      undefined,
    coverUrl: imageUrl(doc.querySelector('figure.cover img'), pageUrl),
    summary: blockText(summary) || undefined,
    genres: Array.from(doc.querySelectorAll('.novel-info .categories li a')).map(cleanText),
    status: cleanText(status?.querySelector('strong')) || undefined,
  };
}

export function parseChapterPage(
  doc: Document,
  pageUrl: string,
): { chapters: ChapterRef[]; pageCount: number } {
  const chapters = Array.from(doc.querySelectorAll('ul.chapter-list li a[href]')).flatMap(
    (link): ChapterRef[] => {
      const url = absoluteUrl(link.getAttribute('href'), pageUrl);
      if (!url) return [];
      const index = chapterIndex(url) ?? Number(cleanText(link.querySelector('.chapter-no')));
      if (!Number.isFinite(index) || index <= 0) return [];
      return [
        {
          url,
          index,
          title:
            cleanText(link.querySelector('.chapter-title')) ||
            link.getAttribute('title') ||
            `Chapter ${index}`,
          released: cleanText(link.querySelector('.chapter-update')) || undefined,
        },
      ];
    },
  );
  // NovelPhoenix has a range picker with one option per page, and a "last" link as a fallback;
  // NovelFire has numbered page links, the last page among them.
  const options = doc.querySelectorAll('.chapter-range-pager select option').length;
  const pages = Array.from(
    doc.querySelectorAll('.chapter-range-pager a[aria-label="Last chapter range"], .pagination a'),
    (link) => Number(/[?&]page=(\d+)/.exec(link.getAttribute('href') ?? '')?.[1] ?? 0),
  );
  return { chapters, pageCount: Math.max(options, ...pages, 1) };
}

export function parseChapter(doc: Document): ChapterText {
  const container = doc.querySelector('#chapter-container #content, #content');
  if (!container) throw new SourceError('Could not find the chapter text on this page.');
  const title =
    cleanText(doc.querySelector('.titles .chapter-title')) ||
    cleanText(container.querySelector('h1, h2, h3'));
  const titleKey = title.toLowerCase();
  const paragraphs = extractParagraphs(
    container,
    (el) =>
      el.matches('.nf-ads, .ads, [class*="ads-"], [class*="-ads"], [id*="ads-"], [id*="-ads"]') ||
      // Some chapters repeat the title as a heading at the top of the text.
      (/^H[1-6]$/.test(el.tagName) && cleanText(el).toLowerCase() === titleKey),
  );
  if (paragraphs.length === 0) throw new SourceError('This chapter page has no text.');
  return { title, paragraphs };
}

export interface TemplateSite {
  id: string;
  name: string;
  /** e.g. https://novelphoenix.com */
  base: string;
  icon: string;
  /** The path segment before a novel's slug: "novel" for /novel/<slug>. */
  novelPath: string;
}

/** A source for a site on this template. */
export function lightNovelPubSource({ id, name, base, icon, novelPath }: TemplateSite): Source {
  const host = new URL(base).hostname;
  const hosts = [host, `www.${host}`];
  const novelPattern = new RegExp(`^/${novelPath}/([a-z0-9-]+)`, 'i');
  return {
    id,
    name,
    icon,
    hosts,

    novelKey(url) {
      try {
        const { hostname, pathname } = new URL(url);
        if (!hosts.includes(hostname)) return null;
        return novelPattern.exec(pathname)?.[1]?.toLowerCase() ?? null;
      } catch {
        return null;
      }
    },

    novelUrl(key) {
      return `${base}/${novelPath}/${key}`;
    },

    async search(query, signal) {
      const url = `${base}/search?keyword=${encodeURIComponent(query)}&type=title`;
      return parseSearch(await fetchDocument(url, signal), url);
    },

    async getNovel(url, signal) {
      return parseNovel(await fetchDocument(url, signal), url);
    },

    async getChapterList(novelUrl, { knownCount, signal }) {
      const pageUrl = (page: number) => `${novelUrl}/chapters?page=${page}`;
      const first = parseChapterPage(await fetchDocument(pageUrl(1), signal), pageUrl(1));
      // Pages hold a fixed number of chapters, so only the pages after the last known chapter can
      // hold anything new.
      const pageSize = Math.max(first.chapters.length, 1);
      const startPage = Math.max(2, Math.floor((knownCount - 1) / pageSize) + 1);
      const pages = [];
      for (let page = startPage; page <= first.pageCount; page++) pages.push(page);
      const rest = await mapLimit(pages, 3, async (page) => {
        const url = pageUrl(page);
        return parseChapterPage(await fetchDocument(url, signal), url).chapters;
      });
      return [...first.chapters, ...rest.flat()];
    },

    async getChapter(url, signal) {
      return parseChapter(await fetchDocument(url, signal));
    },

    lists: [
      { id: 'most-read', name: 'Most read' },
      { id: 'ratings', name: 'Top rated' },
    ],

    async getList(listId, signal) {
      const url = `${base}/ranking/${listId}`;
      return parseRanking(await fetchDocument(url, signal), url);
    },

    filter: {
      async genres(signal) {
        return parseFilterGenres(await fetchDocument(`${base}/search-adv`, signal));
      },
      async findTags(term, signal) {
        const url = `${base}/ajax/getTags?term=${encodeURIComponent(term)}`;
        return parseTags(await fetchText(url, signal));
      },
      async search(filter, page, signal) {
        const url = filterUrl(base, filter, page);
        return parseFilterResults(await fetchDocument(url, signal), url);
      },
    },
  };
}
