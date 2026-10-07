import { describe, expect, it } from 'vitest';
import { parseHtml } from '@/lib/html';
import {
  captureUrl,
  cdxUrl,
  findArchivedChapter,
  parseArchivedChapter,
  parseCdx,
  parseRoyalRoadSearch,
  royalRoadFictionId,
} from './archive';

const RR = 'https://www.royalroad.com/fiction/101';

// Lines as the CDX API returns them: the same chapter id under the novel's old and new URLs.
const CDX = [
  `${RR}/old-name/chapter/9001/chapter-1-start 20230101000000`,
  `${RR}/new-name/chapter/9001/chapter-1-start 20240101000000`,
  `${RR}/new-name/chapter/9002/chapter-2-the-road 20240102000000`,
  `${RR}/new-name/chapter/9003/chapter-2-part-two 20240103000000`,
  `${RR}/new-name/chapter/9004/epilogue 20240104000000`,
  `${RR}/new-name 20240105000000`,
  '',
].join('\n');

describe('royalRoadFictionId', () => {
  it('reads novel and chapter links', () => {
    expect(royalRoadFictionId(`${RR}/some-name`)).toBe('101');
    expect(royalRoadFictionId(`${RR}/some-name/chapter/9001/chapter-1`)).toBe('101');
    expect(royalRoadFictionId('https://novelphoenix.com/novel/some-name')).toBeNull();
  });
});

describe('cdxUrl and captureUrl', () => {
  it('ask the Archive for chapter pages and their original copies', () => {
    const url = new URL(cdxUrl('101'));
    expect(url.searchParams.get('url')).toBe('royalroad.com/fiction/101/');
    expect(url.searchParams.getAll('filter')).toEqual([
      'statuscode:200',
      'original:.*/chapter/[0-9]+/[^?#]*$',
    ]);
    expect(captureUrl({ url: `${RR}/a/chapter/1/b`, timestamp: '20240101000000' })).toBe(
      `https://web.archive.org/web/20240101000000id_/${RR}/a/chapter/1/b`,
    );
  });
});

describe('parseCdx', () => {
  it('groups copies by chapter id, newest first, with the number from the URL', () => {
    const chapters = parseCdx(CDX);
    expect(chapters.map(({ id, number }) => [id, number])).toEqual([
      ['9001', 1],
      ['9002', 2],
      ['9003', 2],
      ['9004', undefined],
    ]);
    expect(chapters[0].captures.map((capture) => capture.timestamp)).toEqual([
      '20240101000000',
      '20230101000000',
    ]);
  });
});

describe('findArchivedChapter', () => {
  const chapters = parseCdx(CDX);

  it('matches the number in the title, and the words when several share it', () => {
    expect(findArchivedChapter(chapters, 'Chapter 1: Start')?.id).toBe('9001');
    expect(findArchivedChapter(chapters, 'Chapter 2: The Road')?.id).toBe('9002');
    expect(findArchivedChapter(chapters, 'Chapter 2 - Part Two')?.id).toBe('9003');
  });

  it('finds nothing without a number or a copy', () => {
    expect(findArchivedChapter(chapters, 'Afterword')).toBeUndefined();
    expect(findArchivedChapter(chapters, 'Chapter 3: Later')).toBeUndefined();
  });
});

describe('parseArchivedChapter', () => {
  it('reads the chapter text as plain paragraphs', () => {
    const doc = parseHtml(`
      <div class="chapter-content-wrapper">
        <div class="chapter-inner chapter-content">
          <p>“Who’s there?” she asks.</p>
          <p>I keep <em>very</em> still.</p>
        </div>
        <div class="author-note">Thanks for reading!</div>
      </div>`);
    expect(parseArchivedChapter(doc)).toEqual(['“Who’s there?” she asks.', 'I keep very still.']);
    expect(parseArchivedChapter(parseHtml('<p>Page not found</p>'))).toEqual([]);
  });
});

describe('parseRoyalRoadSearch', () => {
  it('picks the result with exactly the same title', () => {
    const doc = parseHtml(`
      <div class="fiction-list-item">
        <h2 class="fiction-title"><a href="/fiction/202/the-tower-fan-story">The Tower - Fan Story</a></h2>
      </div>
      <div class="fiction-list-item">
        <h2 class="fiction-title"><a href="/fiction/101/the-tower">The Tower </a></h2>
      </div>`);
    expect(parseRoyalRoadSearch(doc, 'The Tower')).toBe(
      'https://www.royalroad.com/fiction/101/the-tower',
    );
    expect(parseRoyalRoadSearch(doc, 'Another Tower')).toBeUndefined();
  });
});
