import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { errorMessage } from '@/lib/async';
import type { Label, NovelFilter, NovelFilterSearch } from '@/sources/types';
import { Button, Spinner } from './Button';
import styles from './FilterSheet.module.scss';
import { NO_FILTER, RATINGS, SORTS, STATUSES } from './filterOptions';
import { Sheet } from './Sheet';

/** The sites ask for this many letters before they suggest tags. */
const TAG_MIN_LETTERS = 4;

// Each site's genres, fetched once per session.
const genresCache = new WeakMap<NovelFilterSearch, Label[]>();

const toggle = (labels: Label[], label: Label) =>
  labels.some((item) => item.id === label.id)
    ? labels.filter((item) => item.id !== label.id)
    : [...labels, label];

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  search: NovelFilterSearch;
  value: NovelFilter;
  onApply: (filter: NovelFilter) => void;
}

/** Choosing genres, tags, a lowest rating, a status and an order for a site's novels. */
export function FilterSheet({ open, onClose, search, value, onApply }: FilterSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Filter">
      {/* A fresh draft each time the sheet opens; closing without applying drops it. */}
      {open && <FilterForm search={search} value={value} onApply={onApply} />}
    </Sheet>
  );
}

function FilterForm({
  search,
  value,
  onApply,
}: Pick<FilterSheetProps, 'search' | 'value' | 'onApply'>) {
  const [draft, setDraft] = useState(value);
  const [genres, setGenres] = useState(() => genresCache.get(search));
  const [genresError, setGenresError] = useState<string>();
  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState<{ term: string; tags: Label[] }>();

  useEffect(() => {
    if (genresCache.has(search)) return;
    const controller = new AbortController();
    search.genres(controller.signal).then(
      (found) => {
        genresCache.set(search, found);
        setGenres(found);
      },
      (reason) => {
        if (!controller.signal.aborted) setGenresError(errorMessage(reason));
      },
    );
    return () => controller.abort();
  }, [search]);

  // Tag suggestions follow the typing, a moment after it pauses.
  const query = term.trim();
  useEffect(() => {
    if (query.length < TAG_MIN_LETTERS) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      search.findTags(query, controller.signal).then(
        (tags) => setSuggestions({ term: query, tags }),
        () => undefined,
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, query]);
  const shownTags =
    query.length >= TAG_MIN_LETTERS && suggestions?.term === query
      ? suggestions.tags.filter((tag) => !draft.tags.some((chosen) => chosen.id === tag.id))
      : [];

  // Each choice builds on the latest draft, so quick taps in a row all count.
  const set = (changes: Partial<NovelFilter> | ((current: NovelFilter) => Partial<NovelFilter>)) =>
    setDraft((current) => ({
      ...current,
      ...(typeof changes === 'function' ? changes(current) : changes),
    }));

  return (
    <div className={styles.form}>
      <section>
        <h3 className={styles.label}>Genres</h3>
        {genresError ? (
          <p className={styles.note}>{genresError}</p>
        ) : !genres ? (
          <Spinner size={18} label="Loading genres" />
        ) : (
          <div className={styles.chips}>
            {genres.map((genre) => (
              <button
                key={genre.id}
                type="button"
                className={styles.chip}
                aria-pressed={draft.genres.some((chosen) => chosen.id === genre.id)}
                onClick={() => set((current) => ({ genres: toggle(current.genres, genre) }))}
              >
                {genre.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className={styles.label}>Tags</h3>
        {draft.tags.length > 0 && (
          <div className={styles.chips}>
            {draft.tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={styles.chip}
                aria-pressed
                aria-label={`Remove ${tag.name}`}
                onClick={() => set((current) => ({ tags: toggle(current.tags, tag) }))}
              >
                {tag.name}
                <X aria-hidden />
              </button>
            ))}
          </div>
        )}
        <div className={styles.field}>
          <Search aria-hidden />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={`Type ${TAG_MIN_LETTERS} letters to find a tag`}
            aria-label="Find a tag"
          />
        </div>
        {shownTags.length > 0 && (
          <div className={styles.chips}>
            {shownTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={styles.chip}
                onClick={() => {
                  set((current) => ({ tags: [...current.tags, tag] }));
                  setTerm('');
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className={styles.label}>Rating</h3>
        <div className={styles.chips}>
          {RATINGS.map((rating) => (
            <button
              key={rating.value}
              type="button"
              className={styles.chip}
              aria-pressed={draft.minRating === rating.value}
              onClick={() => set({ minRating: rating.value })}
            >
              {rating.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className={styles.label}>Status</h3>
        <div className={styles.chips}>
          {STATUSES.map((status) => (
            <button
              key={status.value}
              type="button"
              className={styles.chip}
              aria-pressed={draft.status === status.value}
              onClick={() => set({ status: status.value })}
            >
              {status.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className={styles.label}>Sort by</h3>
        <div className={styles.chips}>
          {SORTS.map((sort) => (
            <button
              key={sort.value}
              type="button"
              className={styles.chip}
              aria-pressed={draft.sort === sort.value}
              onClick={() => set({ sort: sort.value })}
            >
              {sort.name}
            </button>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <Button onClick={() => setDraft(NO_FILTER)}>Reset</Button>
        <Button variant="primary" onClick={() => onApply(draft)}>
          Show novels
        </Button>
      </div>
    </div>
  );
}
