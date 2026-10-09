import { Search } from 'lucide-react';
import { Button, Spinner } from './Button';
import forms from './forms.module.scss';
import { NovelRow } from './NovelRow';
import styles from './NovelSearch.module.scss';
import { SiteLogo } from './SiteLogo';
import type { NovelSearch } from './useNovelSearch';

export function SearchForm({ search, label }: { search: NovelSearch; label: string }) {
  return (
    <form className={forms.form} onSubmit={search.submit} role="search">
      <Search className={forms.fieldIcon} aria-hidden />
      <input
        type="search"
        enterKeyHint="search"
        value={search.query}
        onChange={(event) => search.changeQuery(event.target.value)}
        placeholder={label}
        aria-label={label}
      />
      <Button type="submit" variant="primary" disabled={search.searching || !search.query.trim()}>
        {search.searching ? <Spinner size={18} /> : 'Search'}
      </Button>
    </form>
  );
}

/** The results, under a heading per site when several were searched. */
export function SearchResults({ search }: { search: NovelSearch }) {
  const { results } = search;
  if (!results) return null;
  const grouped = results.sites.length > 1;
  const nothing = results.sites.every((site) => site.novels.length === 0 && !site.error);
  return (
    <section className={styles.results} aria-label="Results">
      {search.openError && (
        <p className={forms.error} role="alert">
          {search.openError}
        </p>
      )}
      {nothing ? (
        <p className={styles.note}>No novels match “{results.query}”.</p>
      ) : (
        results.sites.map(({ source, novels, error }) => (
          <div key={source.id} className={styles.site}>
            {grouped && (
              <h2 className={styles.siteName}>
                <SiteLogo source={source} size={20} />
                {source.name}
              </h2>
            )}
            {error ? (
              <p className={forms.error}>{error}</p>
            ) : novels.length === 0 ? (
              <p className={styles.none}>No matches.</p>
            ) : (
              <ul className={styles.list}>
                {novels.map((novel) => (
                  <li key={novel.url}>
                    <NovelRow
                      novel={novel}
                      details={novel.info}
                      busy={search.opening === novel.url}
                      disabled={search.opening !== undefined}
                      onOpen={() => search.open(source, novel)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </section>
  );
}
