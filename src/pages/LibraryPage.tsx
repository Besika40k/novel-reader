import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Compass, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button, IconButton, Spinner } from '@/components/Button';
import { Cover } from '@/components/Cover';
import { TopBar } from '@/components/TopBar';
import { db } from '@/db/db';
import { libraryNovels, novelPath, updateLibrary } from '@/db/library';
import { usePageScroll } from '@/lib/scroll';
import { toast } from '@/lib/toast';
import styles from './LibraryPage.module.scss';

const CATEGORY_KEY = 'novel-reader:library-category';

function savedCategory(): number | 'all' {
  try {
    const value = localStorage.getItem(CATEGORY_KEY);
    return value && value !== 'all' ? Number(value) : 'all';
  } catch {
    return 'all';
  }
}

export function LibraryPage() {
  const navigate = useNavigate();
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []);
  const novels = useLiveQuery(() => libraryNovels(), []);
  const [selected, setSelected] = useState(savedCategory);
  const [updating, setUpdating] = useState(false);
  usePageScroll('library', novels !== undefined);

  // A deleted category falls back to showing everything.
  const active = categories?.some((c) => c.id === selected) ? selected : 'all';
  const shown = novels?.filter((novel) => active === 'all' || novel.categoryId === active) ?? [];

  const select = (value: number | 'all') => {
    setSelected(value);
    try {
      localStorage.setItem(CATEGORY_KEY, String(value));
    } catch {
      // Remembering the tab is only a convenience.
    }
  };

  const update = async () => {
    setUpdating(true);
    try {
      const { added, failed } = await updateLibrary();
      const found = added ? `${added} new chapter${added === 1 ? '' : 's'}` : 'No new chapters';
      toast(
        failed ? `${found}. ${failed} could not be checked.` : found,
        failed ? 'error' : 'info',
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <TopBar
        display
        title="Library"
        actions={
          <IconButton
            label="Check all novels for new chapters"
            disabled={updating || !novels?.length}
            onClick={update}
          >
            {updating ? <Spinner /> : <RefreshCw />}
          </IconButton>
        }
      />

      {novels && novels.length > 0 && categories && (
        <nav className={styles.tabs} aria-label="Categories">
          {[{ id: 'all' as const, name: 'All' }, ...categories].map((category) => {
            const count =
              category.id === 'all'
                ? novels.length
                : novels.filter((novel) => novel.categoryId === category.id).length;
            return (
              <button
                key={category.id}
                type="button"
                className={styles.tab}
                aria-pressed={active === category.id}
                onClick={() => select(category.id)}
              >
                {category.name}
                <span className={styles.tabCount}>{count}</span>
              </button>
            );
          })}
        </nav>
      )}

      {novels === undefined ? null : novels.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Your library is empty</p>
          <p>Find a novel in Browse, or paste a link to one, and add it here.</p>
          <Button variant="primary" icon={<Compass />} onClick={() => navigate('/browse')}>
            Browse
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <p className={styles.note}>Nothing in this category yet.</p>
      ) : (
        <ul className={styles.grid}>
          {shown.map((novel) => (
            <li key={novel.id}>
              <Link to={novelPath(novel.id)} className={styles.card}>
                <div className={styles.coverWrap}>
                  <Cover src={novel.coverData ?? novel.coverUrl} title={novel.title} />
                  {novel.unread > 0 && (
                    <span className={styles.badge} aria-label={`${novel.unread} unread`}>
                      {novel.unread}
                    </span>
                  )}
                </div>
                <span className={styles.title}>{novel.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
