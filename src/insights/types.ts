/*
 * Shapes for learning the reader's taste; see docs/reader-insights.md. Nothing computes these
 * yet: they fix the plan's vocabulary so the parsers and tables can grow towards it.
 */

/** What a novel is: the traits taste is measured over. */
export interface NovelTraits {
  novelId: string;
  genres: string[];
  /** The site's tags, finer than genres; not parsed yet. */
  tags: string[];
  /** The site's average rating, 0–5; not parsed yet. */
  rating?: number;
  /** As the site writes it, e.g. "Ongoing", "Completed". */
  status?: string;
  chapterCount: number;
}

/** How much the reader engaged with one novel, derived from chapters, history and library. */
export interface NovelEngagement {
  novelId: string;
  chaptersRead: number;
  daysRead: number;
  firstReadAt?: number;
  lastReadAt?: number;
  inLibrary: boolean;
  /** When the novel was moved to "Dropped" or removed after reading some of it. */
  droppedAt?: number;
}

/** Learned preferences: positive weights are liked, negative disliked. */
export interface TasteProfile {
  genres: Record<string, number>;
  tags: Record<string, number>;
  /** The range of site ratings the read novels mostly fall in. */
  rating?: { min: number; max: number };
  /** Weight per status, e.g. whether completed novels are preferred. */
  status: Record<string, number>;
  /** When the profile was computed. */
  computedAt: number;
}
