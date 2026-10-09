import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ensureNovel, novelPath } from '@/db/library';
import { errorMessage } from '@/lib/async';
import type { NovelSummary, Source } from '@/sources/types';

interface SiteResults {
  source: Source;
  novels: NovelSummary[];
  error?: string;
}

interface Finished {
  query: string;
  sites: SiteResults[];
}

// Kept between visits, by where the search ran, so going back from a novel shows the same results.
const remembered = new Map<string, Finished>();

/** Searching one site or several at once, and opening a result. */
export function useNovelSearch(key: string, targets: Source[]) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(() => remembered.get(key)?.query ?? '');
  const [results, setResults] = useState(() => remembered.get(key));
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string>();
  const [openError, setOpenError] = useState<string>();
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const changeQuery = (value: string) => {
    setQuery(value);
    // Emptying the field puts the page back as it was before the search.
    if (value.trim()) return;
    pending.current?.abort();
    remembered.delete(key);
    setResults(undefined);
    setSearching(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setSearching(true);
    setOpenError(undefined);
    const sites = await Promise.all(
      targets.map(async (source): Promise<SiteResults> => {
        try {
          return { source, novels: await source.search(text, controller.signal) };
        } catch (reason) {
          return { source, novels: [], error: errorMessage(reason) };
        }
      }),
    );
    if (controller.signal.aborted) return;
    const finished = { query: text, sites };
    remembered.set(key, finished);
    setResults(finished);
    setSearching(false);
  };

  const open = async (source: Source, novel: NovelSummary) => {
    setOpening(novel.url);
    setOpenError(undefined);
    try {
      navigate(novelPath(await ensureNovel(source, novel)));
    } catch (reason) {
      setOpenError(errorMessage(reason));
      setOpening(undefined);
    }
  };

  return { query, changeQuery, submit, searching, results, open, opening, openError };
}

export type NovelSearch = ReturnType<typeof useNovelSearch>;
