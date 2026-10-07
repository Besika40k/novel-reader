import { mapLimit } from '@/lib/async';
import { absoluteUrl, blockText, cleanText } from '@/lib/html';
import { fetchDocument } from '@/lib/http';
import { extractParagraphs } from '@/lib/inline';
import {
  SourceError,
  type ChapterRef,
  type ChapterText,
  type NovelDetails,
  type NovelSummary,
  type Source,
} from './types';

const BASE = 'https://novelphoenix.com';
const HOSTS = ['novelphoenix.com', 'www.novelphoenix.com'];

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
  // The range picker lists one option per page; the "last" link is a fallback.
  const options = doc.querySelectorAll('.chapter-range-pager select option').length;
  const lastHref = doc
    .querySelector('.chapter-range-pager a[aria-label="Last chapter range"]')
    ?.getAttribute('href');
  const lastPage = Number(/[?&]page=(\d+)/.exec(lastHref ?? '')?.[1] ?? 0);
  return { chapters, pageCount: Math.max(options, lastPage, 1) };
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

export const novelphoenix: Source = {
  id: 'novelphoenix',
  name: 'NovelPhoenix',
  hosts: HOSTS,

  novelKey(url) {
    try {
      const { hostname, pathname } = new URL(url);
      if (!HOSTS.includes(hostname)) return null;
      return /^\/novel\/([a-z0-9-]+)/i.exec(pathname)?.[1]?.toLowerCase() ?? null;
    } catch {
      return null;
    }
  },

  novelUrl(key) {
    return `${BASE}/novel/${key}`;
  },

  async search(query, signal) {
    const url = `${BASE}/search?keyword=${encodeURIComponent(query)}&type=title`;
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
};
