import { useRef, useState, type FormEvent } from 'react';
import { ChevronRight, Link2, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button, Spinner } from '@/components/Button';
import { NovelRow } from '@/components/NovelRow';
import { SiteLogo } from '@/components/SiteLogo';
import { TopBar } from '@/components/TopBar';
import { ensureNovel, novelFromLink, novelPath, sitePath } from '@/db/library';
import { errorMessage } from '@/lib/async';
import { usePageScroll } from '@/lib/scroll';
import { sources } from '@/sources';
import type { NovelSummary } from '@/sources/types';
import styles from './BrowsePage.module.scss';

interface SearchResult {
  sourceId: string;
  query: string;
  results: NovelSummary[];
}

// Kept between visits so going back from a novel shows the same results.
let lastSearch: SearchResult | undefined;

function rememberSearch(search: SearchResult) {
  lastSearch = search;
}

export function BrowsePage() {
  const navigate = useNavigate();
  const [sourceId, setSourceId] = useState(lastSearch?.sourceId ?? sources[0].id);
  const [query, setQuery] = useState(lastSearch?.query ?? '');
  const [searched, setSearched] = useState(lastSearch);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string>();
  const [opening, setOpening] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  usePageScroll('browse', true);

  const source = sources.find((candidate) => candidate.id === sourceId) ?? sources[0];

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setSearching(true);
    setError(undefined);
    try {
      const found = await source.search(text, controller.signal);
      const result = { sourceId: source.id, query: text, results: found };
      rememberSearch(result);
      setSearched(result);
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorMessage(reason));
    } finally {
      if (pending.current === controller) setSearching(false);
    }
  };

  const open = async (result: NovelSummary) => {
    setOpening(result.url);
    try {
      navigate(novelPath(await ensureNovel(source, result)));
    } catch (reason) {
      setError(errorMessage(reason));
      setOpening(undefined);
    }
  };

  const openLink = async (event: FormEvent) => {
    event.preventDefault();
    setLinkError(undefined);
    try {
      navigate(novelPath(await novelFromLink(link)));
    } catch (reason) {
      setLinkError(errorMessage(reason));
    }
  };

  return (
    <>
      <TopBar display title="Browse" />

      {sources.length > 1 && (
        <div className={styles.sources} role="group" aria-label="Site">
          {sources.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className={styles.source}
              aria-pressed={candidate.id === source.id}
              onClick={() => setSourceId(candidate.id)}
            >
              {candidate.name}
            </button>
          ))}
        </div>
      )}

      <form className={styles.form} onSubmit={search} role="search">
        <Search className={styles.fieldIcon} aria-hidden />
        <input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${source.name}`}
          aria-label={`Search ${source.name}`}
        />
        <Button type="submit" variant="primary" disabled={searching || !query.trim()}>
          {searching ? <Spinner size={18} /> : 'Search'}
        </Button>
      </form>

      <form className={styles.form} onSubmit={openLink}>
        <Link2 className={styles.fieldIcon} aria-hidden />
        <input
          type="url"
          inputMode="url"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="Paste a novel or chapter link"
          aria-label="Novel or chapter link"
        />
        <Button type="submit" disabled={!link.trim()}>
          Open
        </Button>
      </form>
      {linkError && <p className={styles.error}>{linkError}</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {searched && (
        <section className={styles.results} aria-label="Results">
          {searched.results.length === 0 ? (
            <p className={styles.note}>No novels match “{searched.query}”.</p>
          ) : (
            <ul className={styles.list}>
              {searched.results.map((result) => (
                <li key={result.url}>
                  <NovelRow
                    novel={result}
                    details={result.info}
                    busy={opening === result.url}
                    disabled={opening !== undefined}
                    onOpen={() => open(result)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={styles.sites} aria-labelledby="sites">
        <h2 id="sites" className={styles.label}>
          Sites
        </h2>
        <ul className={styles.list}>
          {sources
            .filter((candidate) => candidate.lists.length > 0)
            .map((candidate) => (
              <li key={candidate.id}>
                <Link to={sitePath(candidate.id)} className={styles.site}>
                  <SiteLogo source={candidate} />
                  <span className={styles.siteName}>{candidate.name}</span>
                  <span className={styles.siteHost}>{candidate.hosts[0]}</span>
                  <ChevronRight aria-hidden />
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}
