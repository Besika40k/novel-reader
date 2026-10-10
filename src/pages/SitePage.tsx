import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Button, Spinner } from '@/components/Button';
import { NovelRow } from '@/components/NovelRow';
import { SearchForm, SearchResults } from '@/components/NovelSearch';
import { SiteLogo } from '@/components/SiteLogo';
import { TopBar } from '@/components/TopBar';
import { useNovelSearch } from '@/components/useNovelSearch';
import { ensureNovel, novelPath } from '@/db/library';
import { errorMessage } from '@/lib/async';
import { usePageScroll } from '@/lib/scroll';
import { sources } from '@/sources';
import type { NovelSummary, Source } from '@/sources/types';
import styles from './SitePage.module.scss';

// Lists fetched in this session, by site and list, so going back from a novel shows them at once.
const fetched = new Map<string, NovelSummary[]>();
// The list last shown for each site.
const shownList = new Map<string, string>();

const listKey = (source: Source, listId: string) => `${source.id}/${listId}`;

type Figures = Pick<NovelSummary, 'status' | 'rating' | 'monthlyReads'>;

/** Everything the site's lists say about each novel: each list has its own figure. */
function figuresByUrl(lists: Record<string, NovelSummary[]>): Map<string, Figures> {
  const figures = new Map<string, Figures>();
  for (const novels of Object.values(lists)) {
    for (const { url, status, rating, monthlyReads } of novels) {
      const known = figures.get(url);
      figures.set(url, {
        status: status ?? known?.status,
        rating: rating ?? known?.rating,
        monthlyReads: monthlyReads ?? known?.monthlyReads,
      });
    }
  }
  return figures;
}

function describe({ status, rating, monthlyReads }: Figures): string {
  return [
    status,
    rating !== undefined && `★ ${rating.toFixed(1)}`,
    monthlyReads && `${monthlyReads} reads a month`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function SiteLists({ source }: { source: Source }) {
  const navigate = useNavigate();
  const [lists, setLists] = useState(() => {
    const known: Record<string, NovelSummary[]> = {};
    for (const list of source.lists) {
      const novels = fetched.get(listKey(source, list.id));
      if (novels) known[list.id] = novels;
    }
    return known;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  const [listId, setListId] = useState(() => shownList.get(source.id) ?? source.lists[0].id);
  const [opening, setOpening] = useState<string>();
  const search = useNovelSearch(source.id, [source]);
  const novels = lists[listId];
  const error = errors[listId];
  const figures = useMemo(() => figuresByUrl(lists), [lists]);
  usePageScroll(`site:${source.id}`, novels !== undefined);

  // Every list at once: they're one page each, and each adds its figure to the others' rows.
  useEffect(() => {
    const controller = new AbortController();
    for (const list of source.lists) {
      const key = listKey(source, list.id);
      if (fetched.has(key)) continue;
      source.getList(list.id, controller.signal).then(
        (found) => {
          fetched.set(key, found);
          setLists((current) => ({ ...current, [list.id]: found }));
        },
        (reason) => {
          if (controller.signal.aborted) return;
          setErrors((current) => ({ ...current, [list.id]: errorMessage(reason) }));
        },
      );
    }
    return () => controller.abort();
  }, [source, attempt]);

  const show = (id: string) => {
    shownList.set(source.id, id);
    setListId(id);
    window.scrollTo(0, 0);
  };

  const retry = () => {
    setErrors({});
    setAttempt((value) => value + 1);
  };

  const open = async (novel: NovelSummary) => {
    setOpening(novel.url);
    try {
      navigate(novelPath(await ensureNovel(source, novel)));
    } catch (reason) {
      setErrors((current) => ({ ...current, [listId]: errorMessage(reason) }));
      setOpening(undefined);
    }
  };

  return (
    <>
      <TopBar
        title={
          <span className={styles.heading}>
            <SiteLogo source={source} size={24} />
            {source.name}
          </span>
        }
        back="/browse"
      />
      <SearchForm search={search} label={`Search ${source.name}`} />
      <SearchResults search={search} />
      <div className={styles.lists} role="group" aria-label="List">
        {source.lists.map((list) => (
          <button
            key={list.id}
            type="button"
            className={styles.list}
            aria-pressed={list.id === listId}
            onClick={() => show(list.id)}
          >
            {list.name}
          </button>
        ))}
      </div>

      {error ? (
        <div className={styles.status} role="alert">
          <p>{error}</p>
          <Button variant="primary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : !novels ? (
        <div className={styles.status}>
          <Spinner label="Loading novels" />
        </div>
      ) : (
        <ul className={styles.novels}>
          {novels.map((novel) => (
            <li key={novel.url}>
              <NovelRow
                novel={novel}
                details={describe(figures.get(novel.url) ?? novel)}
                busy={opening === novel.url}
                disabled={opening !== undefined}
                onOpen={() => open(novel)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** A site's own lists of novels, such as its most read, to browse without searching. */
export function SitePage() {
  const { sourceId = '' } = useParams();
  const source = sources.find((candidate) => candidate.id === sourceId);
  if (!source?.lists.length) return <Navigate to="/browse" replace />;
  // Keyed by site, so moving to another site starts with that site's lists.
  return <SiteLists key={source.id} source={source} />;
}
