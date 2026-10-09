import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseHtml } from '@/lib/html';
import chapterHtml from './__fixtures__/novelphoenix-chapter.html?raw';
import chaptersHtml from './__fixtures__/novelphoenix-chapters.html?raw';
import novelHtml from './__fixtures__/novelphoenix-novel.html?raw';
import searchHtml from './__fixtures__/novelphoenix-search.html?raw';
import { parseChapter, parseChapterPage, parseNovel, parseSearch } from './lightnovelpub';
import { novelphoenix } from './novelphoenix';

const { fetchDocument } = vi.hoisted(() => ({ fetchDocument: vi.fn() }));
vi.mock('@/lib/http', () => ({ fetchDocument }));

const NOVEL = 'https://novelphoenix.com/novel/the-glass-orchard';

describe('parseSearch', () => {
  it('reads results with absolute links and real cover images', () => {
    const url = 'https://novelphoenix.com/search?keyword=orchard&type=title';
    expect(parseSearch(parseHtml(searchHtml), url)).toEqual([
      {
        url: NOVEL,
        title: 'The Glass Orchard',
        coverUrl: 'https://novelphoenix.com/server-1/the-glass-orchard.jpg',
        info: '212 Chapters',
      },
      {
        url: 'https://novelphoenix.com/novel/orchard-keeper',
        title: 'Orchard Keeper',
        coverUrl: 'https://novelphoenix.com/server-2/orchard-keeper.jpg',
        info: '45 Chapters',
      },
    ]);
  });
});

describe('parseNovel', () => {
  it('reads the details', () => {
    expect(parseNovel(parseHtml(novelHtml), NOVEL)).toEqual({
      url: NOVEL,
      title: 'The Glass Orchard',
      author: 'Mira Vale',
      coverUrl: 'https://novelphoenix.com/server-1/the-glass-orchard.jpg',
      summary:
        'An orchard of glass trees grows wherever Ilse sleeps.\n\nNobody in the valley knows why.\n\n***\n\nUpdates on weekends.',
      genres: ['Fantasy', 'Mystery'],
      status: 'Completed',
    });
  });

  it('rejects a page without a novel', () => {
    expect(() => parseNovel(parseHtml('<p>Not found</p>'), NOVEL)).toThrow(/Could not find/);
  });
});

describe('parseChapterPage', () => {
  it('orders chapters by their position in the link, not the number in the title', () => {
    const url = `${NOVEL}/chapters?page=1`;
    const { chapters, pageCount } = parseChapterPage(parseHtml(chaptersHtml), url);
    expect(pageCount).toBe(3);
    expect(chapters).toEqual([
      { url: `${NOVEL}/chapter-1`, index: 1, title: 'Chapter 1', released: '2 years ago' },
      {
        url: `${NOVEL}/chapter-2`,
        index: 2,
        title: 'Chapter 1.5: Interlude',
        released: '2 years ago',
      },
      { url: `${NOVEL}/chapter-3`, index: 3, title: 'Chapter 2: Frost', released: '1 year ago' },
    ]);
  });
});

describe('parseChapter', () => {
  const chapter = parseChapter(parseHtml(chapterHtml));

  it('takes the title from the page header', () => {
    expect(chapter.title).toBe('Chapter 2: Frost');
  });

  it('keeps every story paragraph, with emphasis, and nothing else', () => {
    expect(chapter.paragraphs).toEqual([
      'The first frost came early that year, and the glass trees rang like bells.',
      'Ilse pressed her palm to the bark and whispered, "Not yet."',
      // The site closed this <p> mid-sentence; the stray rest of the sentence is joined back on.
      'She felt the orchard answer through her<b> [Rootsong]</b> and the ground hummed beneath her boots.',
      'This content has been misappropriated from Royal Road; report any instances of this story if found elsewhere.',
      '<i>Run,</i> said the voice in her head.',
      // Stray text that starts a new sentence becomes its own paragraph.
      'Bram stood at the gate, waiting.',
      'Fish &amp; chips cost less than 5 &lt; 6 coins.',
      'This story has been stolen from NovelPhoenix. If you read it on Amazon, please report it',
      'Line one\nLine two',
    ]);
  });

  it('rejects a page without chapter text', () => {
    expect(() => parseChapter(parseHtml('<main></main>'))).toThrow(/Could not find/);
  });
});

describe('novelKey', () => {
  it('maps novel and chapter links to the novel', () => {
    expect(novelphoenix.novelKey(NOVEL)).toBe('the-glass-orchard');
    expect(novelphoenix.novelKey(`${NOVEL}/chapter-12`)).toBe('the-glass-orchard');
    expect(novelphoenix.novelKey('https://novelphoenix.com/ranking')).toBeNull();
    expect(novelphoenix.novelKey('https://example.com/novel/the-glass-orchard')).toBeNull();
    expect(novelphoenix.novelUrl('the-glass-orchard')).toBe(NOVEL);
  });
});

describe('getChapterList', () => {
  const TOTAL = 212;
  const PAGE_SIZE = 100;

  function listPage(page: number): string {
    const pageCount = Math.ceil(TOTAL / PAGE_SIZE);
    const options = Array.from(
      { length: pageCount },
      (_, i) => `<option value="${NOVEL}/chapters?page=${i + 1}">range</option>`,
    ).join('');
    const items = [];
    for (let i = (page - 1) * PAGE_SIZE + 1; i <= Math.min(page * PAGE_SIZE, TOTAL); i++) {
      items.push(
        `<li><a href="/novel/the-glass-orchard/chapter-${i}"><span class="chapter-no">${i}</span><strong class="chapter-title">Chapter ${i}</strong></a></li>`,
      );
    }
    return `<div class="chapter-range-pager"><select>${options}</select></div><ul class="chapter-list">${items.join('')}</ul>`;
  }

  beforeEach(() => {
    fetchDocument.mockReset();
    fetchDocument.mockImplementation(async (url: string) =>
      parseHtml(listPage(Number(new URL(url).searchParams.get('page')))),
    );
  });

  const requestedPages = () =>
    fetchDocument.mock.calls.map(([url]) =>
      Number(new URL(url as string).searchParams.get('page')),
    );

  it('fetches every page for a new novel', async () => {
    const chapters = await novelphoenix.getChapterList(NOVEL, { knownCount: 0 });
    expect(chapters).toHaveLength(TOTAL);
    expect(chapters.at(-1)?.index).toBe(TOTAL);
    expect(requestedPages().sort()).toEqual([1, 2, 3]);
  });

  it('skips pages that only hold chapters it already has', async () => {
    const chapters = await novelphoenix.getChapterList(NOVEL, { knownCount: 212 });
    expect(requestedPages().sort()).toEqual([1, 3]);
    expect(chapters.map((c) => c.index)).toContain(212);
  });

  it('refetches the page holding the last known chapter', async () => {
    await novelphoenix.getChapterList(NOVEL, { knownCount: 150 });
    expect(requestedPages().sort()).toEqual([1, 2, 3]);
  });
});
