import { useState, type FormEvent } from 'react';
import { ChevronRight, Link2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/Button';
import forms from '@/components/forms.module.scss';
import { SearchForm, SearchResults } from '@/components/NovelSearch';
import { SiteLogo } from '@/components/SiteLogo';
import { TopBar } from '@/components/TopBar';
import { useNovelSearch } from '@/components/useNovelSearch';
import { novelFromLink, novelPath, sitePath } from '@/db/library';
import { errorMessage } from '@/lib/async';
import { usePageScroll } from '@/lib/scroll';
import { sources } from '@/sources';
import styles from './BrowsePage.module.scss';

export function BrowsePage() {
  const navigate = useNavigate();
  const search = useNovelSearch('all', sources);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string>();
  usePageScroll('browse', true);

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
      <TopBar display title="Browse" rune="raidho" />

      <SearchForm search={search} label="Search across sites" />

      <form className={forms.form} onSubmit={openLink}>
        <Link2 className={forms.fieldIcon} aria-hidden />
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
      {linkError && <p className={forms.error}>{linkError}</p>}

      <SearchResults search={search} />

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
