import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { IconButton, Spinner } from '@/components/Button';
import { Cover } from '@/components/Cover';
import { TopBar } from '@/components/TopBar';
import { localDay } from '@/db/db';
import { novelPath, readerPath, updateLibrary } from '@/db/library';
import { groupUpdates, markUpdatesSeen, recentUpdates, type UpdateGroup } from '@/db/updates';
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

/** Chapters shown under a novel before "Show n more". */
const SHOWN = 3;

/** Groups split into runs of the same day, for the day headings. */
function byDay(groups: UpdateGroup[]): [string, UpdateGroup[]][] {
  const days: [string, UpdateGroup[]][] = [];
  for (const group of groups) {
    const last = days.at(-1);
    if (last && last[0] === group.day) last[1].push(group);
    else days.push([group.day, [group]]);
  }
  return days;
}

export function UpdatesPage() {
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const now = Date.now();
    return {
      groups: groupUpdates(await recentUpdates(now), localDay),
      today: localDay(now),
      yesterday: localDay(now - 24 * 60 * 60 * 1000),
    };
  }, []);
  const [checking, setChecking] = useState(false);
  // Groups opened with "Show n more", by `${day}|${novelId}`.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

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
      {data === undefined ? null : data.groups.length === 0 ? (
        <p className={styles.note}>
          New chapters found in your library in the last 30 days show up here.
        </p>
      ) : (
        byDay(data.groups).map(([day, groups]) => (
          <section key={day}>
            <h2 className={styles.label}>{dayLabel(day, data.today, data.yesterday)}</h2>
            {groups.map(({ novel, chapters }) => {
              const key = `${day}|${novel.id}`;
              const shown = open.has(key) ? chapters : chapters.slice(0, SHOWN);
              const more = chapters.length - shown.length;
              return (
                <div key={key} className={styles.group}>
                  <button
                    type="button"
                    className={styles.novel}
                    onClick={() => navigate(novelPath(novel.id))}
                  >
                    <Cover
                      src={novel.coverData ?? novel.coverUrl}
                      title={novel.title}
                      className={styles.thumb}
                    />
                    <span className={styles.text}>
                      <span className={styles.title}>{novel.title}</span>
                      <span className={styles.count}>
                        {chapters.length === 1
                          ? '1 new chapter'
                          : `${chapters.length} new chapters`}
                      </span>
                    </span>
                  </button>
                  <ul className={styles.chapters}>
                    {shown.map((chapter) => (
                      <li key={chapter.url}>
                        <button
                          type="button"
                          className={styles.chapter}
                          data-read={chapter.read === 1 || undefined}
                          onClick={() => navigate(readerPath(novel.id, chapter.index))}
                        >
                          {chapter.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {more > 0 && (
                    <button
                      type="button"
                      className={styles.more}
                      onClick={() => setOpen((keys) => new Set(keys).add(key))}
                    >
                      Show {more} more
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
