import { describe, expect, it, vi } from 'vitest';
import { parseHtml } from '@/lib/html';
import chaptersHtml from './__fixtures__/novelfire-chapters.html?raw';
import filterHtml from './__fixtures__/novelfire-filter.html?raw';
import rankingHtml from './__fixtures__/novelfire-ranking.html?raw';
import {
  filterUrl,
  parseChapterPage,
  parseFilterGenres,
  parseFilterResults,
  parseRanking,
  parseTags,
} from './lightnovelpub';
import { novelfire } from './novelfire';

const { fetchDocument } = vi.hoisted(() => ({ fetchDocument: vi.fn() }));
vi.mock('@/lib/http', () => ({ fetchDocument }));

const NOVEL = 'https://novelfire.net/book/the-salt-cartographer';

describe('novelKey', () => {
  it('maps book and chapter links to the novel', () => {
    expect(novelfire.novelKey(NOVEL)).toBe('the-salt-cartographer');
    expect(novelfire.novelKey(`${NOVEL}/chapter-7`)).toBe('the-salt-cartographer');
    expect(novelfire.novelKey('https://www.novelfire.net/book/the-salt-cartographer')).toBe(
      'the-salt-cartographer',
    );
    expect(novelfire.novelKey('https://novelfire.net/ranking')).toBeNull();
    expect(novelfire.novelKey('https://novelphoenix.com/book/the-salt-cartographer')).toBeNull();
    expect(novelfire.novelUrl('the-salt-cartographer')).toBe(NOVEL);
  });
});

describe('parseChapterPage', () => {
  it('reads chapters and the page count from the numbered page links', () => {
    const url = `${NOVEL}/chapters?page=1`;
    const { chapters, pageCount } = parseChapterPage(parseHtml(chaptersHtml), url);
    expect(pageCount).toBe(10);
    expect(chapters).toEqual([
      { url: `${NOVEL}/chapter-1`, index: 1, title: 'Chapter 1', released: '1 year ago' },
      {
        url: `${NOVEL}/chapter-2`,
        index: 2,
        title: 'Chapter 2: Low Tide',
        released: '1 year ago',
      },
    ]);
  });
});

describe('getChapterList', () => {
  it('fetches the list pages of a book', async () => {
    fetchDocument.mockImplementation(async () => parseHtml(chaptersHtml));
    await novelfire.getChapterList(NOVEL, { knownCount: 0 });
    const pages = fetchDocument.mock.calls.map(([url]) => url as string);
    expect(pages[0]).toBe(`${NOVEL}/chapters?page=1`);
    expect(pages).toHaveLength(10);
  });
});

describe('parseRanking', () => {
  it('reads each novel with its status and the ranking figure', () => {
    const url = 'https://novelfire.net/ranking/most-read';
    expect(parseRanking(parseHtml(rankingHtml), url)).toEqual([
      {
        url: NOVEL,
        title: 'The Salt Cartographer',
        coverUrl: 'https://novelfire.net/server-1/the-salt-cartographer.jpg',
        status: 'Ongoing',
        rating: undefined,
        monthlyReads: '305.4K',
      },
      {
        url: 'https://novelfire.net/book/lantern-hours',
        title: 'Lantern Hours',
        coverUrl: 'https://novelfire.net/server-2/lantern-hours.jpg',
        status: 'Completed',
        rating: 4.8,
        monthlyReads: undefined,
      },
    ]);
  });
});

describe('advanced search', () => {
  const doc = parseHtml(filterHtml);

  it('reads the genres it filters by', () => {
    expect(parseFilterGenres(doc)).toEqual([
      { id: '3', name: 'Action' },
      { id: '5', name: 'Comedy' },
    ]);
  });

  it('reads tag suggestions', () => {
    const json = '{"status":200,"data":[{"id":1336,"name":"Regression"}]}';
    expect(parseTags(json)).toEqual([{ id: '1336', name: 'Regression' }]);
  });

  it('builds the search address from a filter', () => {
    const url = new URL(
      filterUrl(
        'https://novelfire.net',
        {
          genres: [{ id: '3', name: 'Action' }],
          tags: [{ id: '1336', name: 'Regression' }],
          minRating: 4,
          status: 'ongoing',
          sort: 'monthly-views',
        },
        2,
      ),
    );
    expect(url.pathname).toBe('/search-adv');
    expect(url.searchParams.getAll('categories[]')).toEqual(['3']);
    expect(url.searchParams.getAll('tags[]')).toEqual(['1336']);
    expect(url.searchParams.get('rating')).toBe('4');
    expect(url.searchParams.get('status')).toBe('0');
    expect(url.searchParams.get('sort')).toBe('monthly-view');
    expect(url.searchParams.get('page')).toBe('2');
  });

  it('reads a page of results and whether more follow', () => {
    const url = 'https://novelfire.net/search-adv?sort=monthly-view&page=1';
    expect(parseFilterResults(doc, url)).toEqual({
      novels: [
        {
          url: NOVEL,
          title: 'The Salt Cartographer',
          coverUrl: 'https://novelfire.net/server-1/the-salt-cartographer.jpg',
          info: '513 Chapters',
          status: 'Ongoing',
          rating: 4.1,
        },
      ],
      hasMore: true,
    });
    const last = 'https://novelfire.net/search-adv?sort=monthly-view&page=2';
    expect(parseFilterResults(doc, last).hasMore).toBe(false);
  });
});
