import { describe, expect, it, vi } from 'vitest';
import { parseHtml } from '@/lib/html';
import chaptersHtml from './__fixtures__/novelfire-chapters.html?raw';
import { parseChapterPage } from './lightnovelpub';
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
