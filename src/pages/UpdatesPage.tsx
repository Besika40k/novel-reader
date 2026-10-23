import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { IconButton, Spinner } from '@/components/Button';
import { Cover } from '@/components/Cover';
import { TopBar } from '@/components/TopBar';
import { localDay } from '@/db/db';
import { readerPath, updateLibrary } from '@/db/library';
import { markUpdatesSeen, recentUpdates, type Update } from '@/db/updates';
import { toast } from '@/lib/toast';
import styles from './UpdatesPage.module.scss';

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function dayLabel(day: string, today: string, yesterday: string): string {
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return dayFormat.format(new Date(`${day}T12:00`));
}

/** Updates grouped by the day they were found, keeping the newest-first order. */
function byDay(updates: Update[]): [string, Update[]][] {
  const days: [string, Update[]][] = [];
  for (const update of updates) {
    const day = localDay(update.chapter.foundAt ?? 0);
    const last = days.at(-1);
    if (last && last[0] === day) last[1].push(update);
    else days.push([day, [update]]);
  }
  return days;
}

export function UpdatesPage() {
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const now = Date.now();
    return {
      updates: await recentUpdates(now),
      today: localDay(now),
      yesterday: localDay(now - 24 * 60 * 60 * 1000),
    };
  }, []);
  const [checking, setChecking] = useState(false);

  // Opening the page counts as having seen what's on it.
  useEffect(() => () => markUpdatesSeen(), []);

  const check = async () => {
    setChecking(true);
    try {
      const { added, failed } = await updateLibrary();
      const found = added ? `${added} new chapter${added === 1 ? '' : 's'}` : 'No new chapters';
      toast(
        failed ? `${found}. ${failed} could not be checked.` : found,
        failed ? 'error' : 'info',
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={styles.page}>
      <TopBar
        back="/"
        title="Updates"
        actions={
          <IconButton label="Check for new chapters" disabled={checking} onClick={check}>
            {checking ? <Spinner /> : <RefreshCw />}
          </IconButton>
        }
      />
      {data === undefined ? null : data.updates.length === 0 ? (
        <p className={styles.note}>
          New chapters found in your library in the last 30 days show up here.
        </p>
      ) : (
        byDay(data.updates).map(([day, updates]) => (
          <section key={day}>
            <h2 className={styles.label}>{dayLabel(day, data.today, data.yesterday)}</h2>
            <ul className={styles.list}>
              {updates.map(({ chapter, novel }) => (
                <li key={chapter.url}>
                  <button
                    type="button"
                    className={styles.entry}
                    data-read={chapter.read === 1 || undefined}
                    onClick={() => navigate(readerPath(novel.id, chapter.index))}
                  >
                    <Cover
                      src={novel.coverData ?? novel.coverUrl}
                      title={novel.title}
                      className={styles.thumb}
                    />
                    <span className={styles.text}>
                      <span className={styles.title}>{novel.title}</span>
                      <span className={styles.chapter}>{chapter.title}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
