import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { Cover } from '@/components/Cover';
import { TopBar } from '@/components/TopBar';
import { localDay } from '@/db/db';
import { novelPath } from '@/db/library';
import { readingStats } from '@/db/stats';
import { formatCount, formatDuration, genreShares, lastDays, streaks } from '@/lib/statsSummary';
import styles from './StatsPage.module.scss';

const DAYS = 30;
const dayName = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function dateOf(day: string): Date {
  return new Date(`${day}T12:00`);
}

export function StatsPage() {
  const stats = useLiveQuery(
    async () => ({ ...(await readingStats()), today: localDay(Date.now()) }),
    [],
  );

  if (!stats) return <TopBar back="/history" title="Statistics" />;

  const { rows, days, novels, today } = stats;
  const streak = streaks(days, today);
  const recent = lastDays(rows, DAYS, today);
  const peak = Math.max(1, ...recent.map((day) => day.chapters));
  const recentChapters = recent.reduce((sum, day) => sum + day.chapters, 0);
  const recentSeconds = recent.reduce((sum, day) => sum + day.seconds, 0);
  const genres = genreShares(
    novels.map(({ novel, read }) => ({ genres: novel.genres, read })),
    8,
  );
  const figures: [string, string][] = [
    ['Chapters read', formatCount(novels.reduce((sum, n) => sum + n.read, 0))],
    ['Words read', formatCount(rows.reduce((sum, row) => sum + row.words, 0))],
    ['Time reading', formatDuration(rows.reduce((sum, row) => sum + row.seconds, 0))],
    ['Current streak', plural(streak.current, 'day')],
    ['Longest streak', plural(streak.longest, 'day')],
    ['Days read', String(days.size)],
  ];

  return (
    <div className={styles.page}>
      <TopBar back="/history" title="Statistics" />

      <dl className={styles.figures}>
        {figures.map(([label, value]) => (
          <div key={label} className={styles.figure}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className={styles.section}>
        <h2 className={styles.heading}>Last 30 days</h2>
        <p className={styles.caption}>
          {plural(recentChapters, 'chapter')} · {formatDuration(recentSeconds)}
        </p>
        <ol className={styles.bars} aria-label="Chapters finished per day">
          {recent.map((day) => (
            <li
              key={day.day}
              className={styles.bar}
              title={`${dayName.format(dateOf(day.day))}: ${plural(day.chapters, 'chapter')}, ${formatDuration(day.seconds)}`}
            >
              <span style={{ height: `${(day.chapters / peak) * 100}%` }} />
            </li>
          ))}
        </ol>
        <div className={styles.axis}>
          <span>{dayName.format(dateOf(recent[0].day))}</span>
          <span>Today</span>
        </div>
      </section>

      {novels.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.heading}>Novels</h2>
          <ul className={styles.novels}>
            {novels.map(({ novel, read, total, seconds }) => (
              <li key={novel.id}>
                <Link to={novelPath(novel.id)} className={styles.novel}>
                  <Cover
                    src={novel.coverData ?? novel.coverUrl}
                    title={novel.title}
                    className={styles.thumb}
                  />
                  <span className={styles.text}>
                    <span className={styles.title}>{novel.title}</span>
                    <span className={styles.meta}>
                      {read} of {total} chapters
                      {seconds >= 60 && ` · ${formatDuration(seconds)}`}
                    </span>
                    <span className={styles.progress}>
                      <span style={{ width: `${total ? (read / total) * 100 : 0}%` }} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {genres.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.heading}>Genres</h2>
          <ul className={styles.genres}>
            {genres.map(({ genre, share }) => (
              <li key={genre} className={styles.genre}>
                <span className={styles.genreName}>{genre}</span>
                <span className={styles.genreBar}>
                  <span style={{ width: `${(share / genres[0].share) * 100}%` }} />
                </span>
                <span className={styles.share}>{Math.round(share * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.note}>
        Time, words and the daily chart count from version 0.7.0 on, for chapters finished in the
        reader. Chapters read includes everything marked read.
      </p>
    </div>
  );
}
