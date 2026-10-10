import { useEffect, useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { errorMessage } from '@/lib/async';
import type { NovelFilter, NovelFilterSearch, NovelSummary } from '@/sources/types';
import { Button, Spinner } from './Button';
import styles from './FilteredNovels.module.scss';
import { FilterSheet } from './FilterSheet';
import { NO_FILTER, SORTS } from './filterOptions';
import { NovelRow } from './NovelRow';

interface Results {
  filter: NovelFilter;
  novels: NovelSummary[];
  page: number;
  hasMore: boolean;
}

// The last filter and its results per site, so going back from a novel shows them at once.
const saved = new Map<string, Results>();

function summary(filter: NovelFilter): string {
  return [
    ...filter.genres.map((genre) => genre.name),
    ...filter.tags.map((tag) => `#${tag.name}`),
    filter.minRating > 0 && `${filter.minRating}+ ★`,
    filter.status !== 'all' && (filter.status === 'ongoing' ? 'Ongoing' : 'Completed'),
    `by ${SORTS.find((sort) => sort.value === filter.sort)?.name.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

interface FilteredNovelsProps {
  /** Whose results these are, for keeping them between visits. */
  siteId: string;
  search: NovelFilterSearch;
  opening?: string;
  describe: (novel: NovelSummary) => ReactNode;
  onOpen: (novel: NovelSummary) => void;
}

/** A site's novels narrowed down by its advanced search, a page at a time. */
export function FilteredNovels({ siteId, search, opening, describe, onOpen }: FilteredNovelsProps) {
  const [results, setResults] = useState(() => saved.get(siteId));
  const [filter, setFilter] = useState(() => results?.filter ?? NO_FILTER);
  const [loading, setLoading] = useState(results === undefined);
  const [error, setError] = useState<string>();
  const [sheetOpen, setSheetOpen] = useState(false);

  const keep = (next: Results) => {
    saved.set(siteId, next);
    setResults(next);
  };

  // The first visit shows the site's novels by monthly views until a filter is chosen.
  useEffect(() => {
    if (saved.has(siteId)) return;
    const controller = new AbortController();
    search.search(NO_FILTER, 1, controller.signal).then(
      (page) => {
        const first = { filter: NO_FILTER, ...page, page: 1 };
        saved.set(siteId, first);
        setResults(first);
        setLoading(false);
      },
      (reason) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(reason));
        setLoading(false);
      },
    );
    return () => controller.abort();
  }, [siteId, search]);

  const load = async (next: NovelFilter, page: number) => {
    setLoading(true);
    setError(undefined);
    try {
      const found = await search.search(next, page);
      const before = page > 1 && results ? results.novels : [];
      // Pages can overlap when the site's order shifts between requests.
      const seen = new Set(before.map((novel) => novel.url));
      const novels = [...before, ...found.novels.filter((novel) => !seen.has(novel.url))];
      keep({ filter: next, novels, page, hasMore: found.hasMore });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const apply = (next: NovelFilter) => {
    setSheetOpen(false);
    setFilter(next);
    window.scrollTo(0, 0);
    void load(next, 1);
  };

  return (
    <>
      <div className={styles.bar}>
        <p className={styles.summary}>{summary(filter)}</p>
        <Button icon={<SlidersHorizontal />} onClick={() => setSheetOpen(true)}>
          Filter
        </Button>
      </div>

      {results && results.novels.length === 0 && !loading ? (
        <p className={styles.note}>No novels match this filter.</p>
      ) : (
        results && (
          <ul className={styles.novels}>
            {results.novels.map((novel) => (
              <li key={novel.url}>
                <NovelRow
                  novel={novel}
                  details={describe(novel)}
                  busy={opening === novel.url}
                  disabled={opening !== undefined}
                  onOpen={() => onOpen(novel)}
                />
              </li>
            ))}
          </ul>
        )
      )}

      <div className={styles.status} role={error ? 'alert' : undefined}>
        {error && <p>{error}</p>}
        {loading ? (
          <Spinner label="Loading novels" />
        ) : error ? (
          <Button
            variant="primary"
            onClick={() => void load(filter, results ? results.page + 1 : 1)}
          >
            Try again
          </Button>
        ) : (
          results?.hasMore && (
            <Button onClick={() => void load(filter, results.page + 1)}>Load more</Button>
          )
        )}
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        search={search}
        value={filter}
        onApply={apply}
      />
    </>
  );
}
