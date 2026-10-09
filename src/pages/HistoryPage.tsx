import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { Cover } from '@/components/Cover';
import { TopBar } from '@/components/TopBar';
import { localDay } from '@/db/db';
import { recentHistory, resumePath, type HistoryItem } from '@/db/library';
import { usePageScroll } from '@/lib/scroll';
import styles from './HistoryPage.module.scss';

const DAYS = 7;

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

function dayLabel(day: string, readAt: number): string {
  const now = Date.now();
  if (day === localDay(now)) return 'Today';
  if (day === localDay(now - 24 * 60 * 60 * 1000)) return 'Yesterday';
  return weekday.format(readAt);
}

function byDay(items: HistoryItem[]): HistoryItem[][] {
  const days: HistoryItem[][] = [];
  for (const item of items) {
    const last = days.at(-1);
    if (last && last[0].day === item.day) last.push(item);
    else days.push([item]);
  }
  return days;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const items = useLiveQuery(() => recentHistory(DAYS), []);
  usePageScroll('history', items !== undefined);

  const resume = async (novelId: string) => navigate(await resumePath(novelId));

  return (
    <>
      <TopBar display title="History" rune="dagaz" />
      {items === undefined ? null : items.length === 0 ? (
        <p className={styles.note}>Chapters you read in the last week show up here.</p>
      ) : (
        byDay(items).map((day) => (
          <section key={day[0].day} className={styles.day}>
            <h2 className={styles.label}>{dayLabel(day[0].day, day[0].readAt)}</h2>
            <ul className={styles.list}>
              {day.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.entry}
                    onClick={() => void resume(item.novelId)}
                  >
                    <Cover
                      src={item.novel.coverData ?? item.novel.coverUrl}
                      title={item.novel.title}
                      className={styles.thumb}
                    />
                    <span className={styles.text}>
                      <span className={styles.title}>{item.novel.title}</span>
                      <span className={styles.chapter}>{item.chapter?.title}</span>
                    </span>
                    <span className={styles.time}>{clock.format(item.readAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
