/** A novel as a search result lists it. */
export interface NovelSummary {
  url: string;
  title: string;
  coverUrl?: string;
  /** One short extra line, e.g. "910 Chapters". */
  info?: string;
  /** What a site's lists show, when they show it. */
  status?: string;
  rating?: number;
  /** Reads in the last month, as the site writes it, e.g. "305.4K". */
  monthlyReads?: string;
}

/** A genre or tag a site filters by. */
export interface Label {
  id: string;
  name: string;
}

export type FilterSort = 'monthly-views' | 'total-views' | 'rating' | 'rank' | 'updated';

/** What to filter a site's novels by. A novel must have every genre and every tag chosen. */
export interface NovelFilter {
  genres: Label[];
  tags: Label[];
  /** Lowest rating, 1–5, or 0 for any. */
  minRating: number;
  status: 'all' | 'ongoing' | 'completed';
  sort: FilterSort;
}

/** A site's advanced search. */
export interface NovelFilterSearch {
  genres(signal?: AbortSignal): Promise<Label[]>;
  /** Tags whose name contains the term; the sites want at least four letters. */
  findTags(term: string, signal?: AbortSignal): Promise<Label[]>;
  /** One page of matching novels, starting at 1. */
  search(
    filter: NovelFilter,
    page: number,
    signal?: AbortSignal,
  ): Promise<{ novels: NovelSummary[]; hasMore: boolean }>;
}

/** One of a site's own lists of novels, e.g. its most read. */
export interface NovelList {
  id: string;
  name: string;
}

export interface NovelDetails {
  url: string;
  title: string;
  author?: string;
  coverUrl?: string;
  /** Plain text, paragraphs separated by blank lines. */
  summary?: string;
  genres: string[];
  status?: string;
}

export interface ChapterRef {
  url: string;
  /**
   * Position on the source, starting at 1. Chapters are ordered by this, not by the number in
   * the title, which can skip or repeat.
   */
  index: number;
  title: string;
  /** The source's own release label, e.g. "2 years ago". */
  released?: string;
}

export interface ChapterText {
  title: string;
  /** Paragraphs as inline markup (src/lib/inline.ts), exactly as the source has them. */
  paragraphs: string[];
}

export interface ChapterListOptions {
  /** The last stored chapter's index, so a source can skip list pages it has seen. */
  knownCount: number;
  signal?: AbortSignal;
}

/**
 * One website. A source turns that site's pages into the shapes above; the library, downloads
 * and reader only ever work with those shapes, so adding a site means adding one source.
 */
export interface Source {
  id: string;
  name: string;
  /** The site's logo, bundled with the app. */
  icon: string;
  /** Hostnames the source owns, used to recognise pasted links. */
  hosts: string[];
  /** Stable, URL-safe key of the novel a novel or chapter link points to; null for other links. */
  novelKey(url: string): string | null;
  novelUrl(key: string): string;
  search(query: string, signal?: AbortSignal): Promise<NovelSummary[]>;
  getNovel(url: string, signal?: AbortSignal): Promise<NovelDetails>;
  /** May return only the end of the list when knownCount allows it; callers merge by URL. */
  getChapterList(novelUrl: string, options: ChapterListOptions): Promise<ChapterRef[]>;
  getChapter(url: string, signal?: AbortSignal): Promise<ChapterText>;
  /** The site's lists of novels to browse without searching; empty when it has none. */
  lists: NovelList[];
  getList(listId: string, signal?: AbortSignal): Promise<NovelSummary[]>;
  /** Filtering the site's novels, when it can. */
  filter?: NovelFilterSearch;
}

/** The page loaded but didn't contain what the parser expected, usually after a site redesign. */
export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceError';
  }
}
