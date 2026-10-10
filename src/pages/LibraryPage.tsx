import { useEffect, useRef, useState, type TouchEvent } from 'react';
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

/** How far a finger has to travel sideways, in pixels, to switch categories. */
const SWIPE_DISTANCE = 60;

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
  // Which way the categories moved, so the new one slides in from that side.
  const [direction, setDirection] = useState<'next' | 'previous'>();
  const swipe = useRef<{ x: number; y: number; time: number }>(undefined);
  const tabs = useRef<HTMLElement>(null);
  const [updating, setUpdating] = useState(false);
  usePageScroll('library', novels !== undefined);

  // A deleted category falls back to showing everything.
  const active = categories?.some((c) => c.id === selected) ? selected : 'all';
  const shown = novels?.filter((novel) => active === 'all' || novel.categoryId === active) ?? [];

  const order: (number | 'all')[] = ['all', ...(categories ?? []).map((c) => c.id)];

  const select = (value: number | 'all') => {
    if (value === active) return;
    setDirection(order.indexOf(value) > order.indexOf(active) ? 'next' : 'previous');
    setSelected(value);
    window.scrollTo(0, 0);
    try {
      localStorage.setItem(CATEGORY_KEY, String(value));
    } catch {
      // Remembering the tab is only a convenience.
    }
  };

  // Keep the chosen category's tab in view when there are more than fit across.
  useEffect(() => {
    const nav = tabs.current;
    const tab = nav?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!nav || !tab) return;
    const left = tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2;
    nav.scrollTo({ left, behavior: 'smooth' });
  }, [active]);

  // Swiping sideways across the library moves to the next or previous category. The tabs scroll
  // sideways themselves, so swipes that start on them are left alone.
  const onTouchStart = (event: TouchEvent) => {
    const point = event.touches[0];
    const onTabs = (event.target as Element).closest('nav') !== null;
    swipe.current =
      event.touches.length === 1 && !onTabs
        ? { x: point.clientX, y: point.clientY, time: event.timeStamp }
        : undefined;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = swipe.current;
    swipe.current = undefined;
    if (!start) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    const sideways = Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > 2 * Math.abs(dy);
    if (!sideways || event.timeStamp - start.time > 800) return;
    const target = order[order.indexOf(active) + (dx < 0 ? 1 : -1)];
    if (target !== undefined) select(target);
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

      <div
        className={styles.swipeArea}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => (swipe.current = undefined)}
      >
        {novels && novels.length > 0 && categories && (
          <nav ref={tabs} className={styles.tabs} aria-label="Categories">
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
          <p key={active} className={styles.note} data-enter={direction}>
            Nothing in this category yet.
          </p>
        ) : (
          <ul key={active} className={styles.grid} data-enter={direction}>
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
      </div>
    </>
  );
}
