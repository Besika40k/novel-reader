import { memo } from 'react';
import { ArrowDownToLine, Bookmark, CircleAlert, CircleCheck, Clock } from 'lucide-react';
import type { Chapter } from '@/db/db';
import type { JobState } from '@/downloads/queue';
import { IconButton, Spinner } from './Button';
import styles from './ChapterRow.module.scss';

interface ChapterRowProps {
  chapter: Chapter;
  job?: JobState;
  current: boolean;
  flash: boolean;
  onOpen: (chapter: Chapter) => void;
  onActions: (chapter: Chapter) => void;
  onDownload: (chapter: Chapter) => void;
}

export const ChapterRow = memo(function ChapterRow({
  chapter,
  job,
  current,
  flash,
  onOpen,
  onActions,
  onDownload,
}: ChapterRowProps) {
  const reading = readingPercent(chapter);
  const classes = [styles.row, chapter.read && styles.read, current && styles.current];
  return (
    <li
      id={`chapter-${chapter.index}`}
      className={classes.filter(Boolean).join(' ')}
      data-flash={flash}
    >
      <button
        type="button"
        className={styles.open}
        onClick={() => onOpen(chapter)}
        // Long-press on the phone (right-click on desktop) opens the chapter's actions.
        onContextMenu={(event) => {
          event.preventDefault();
          onActions(chapter);
        }}
      >
        <span className={styles.title}>
          {chapter.bookmarked === 1 && <Bookmark className={styles.mark} aria-label="Bookmarked" />}
          {chapter.title}
        </span>
        <span className={styles.sub}>
          {[chapter.released, reading !== undefined && `${reading}% read`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </button>
      <DownloadState chapter={chapter} job={job} onDownload={onDownload} onActions={onActions} />
    </li>
  );
}, sameRow);

/** The "n% read" a row shows for a chapter that's started but not finished. */
function readingPercent(chapter: Chapter): number | undefined {
  return !chapter.read && chapter.progress > 0.01 ? Math.round(chapter.progress * 100) : undefined;
}

/**
 * Whether a row would look the same. The database hands back new chapter objects on every change
 * (a finished download, a saved reading position), so comparing by reference redrew all of a
 * long list each time; this compares what the row shows instead.
 */
function sameRow(a: ChapterRowProps, b: ChapterRowProps): boolean {
  const x = a.chapter;
  const y = b.chapter;
  return (
    x.url === y.url &&
    x.index === y.index &&
    x.title === y.title &&
    x.released === y.released &&
    x.read === y.read &&
    x.downloaded === y.downloaded &&
    x.bookmarked === y.bookmarked &&
    readingPercent(x) === readingPercent(y) &&
    a.job === b.job &&
    a.current === b.current &&
    a.flash === b.flash &&
    a.onOpen === b.onOpen &&
    a.onActions === b.onActions &&
    a.onDownload === b.onDownload
  );
}

function DownloadState({
  chapter,
  job,
  onDownload,
  onActions,
}: Pick<ChapterRowProps, 'chapter' | 'job' | 'onDownload' | 'onActions'>) {
  if (job === 'running') {
    return (
      <IconButton label="Downloading" disabled>
        <Spinner size={20} />
      </IconButton>
    );
  }
  if (job === 'queued') {
    return (
      <IconButton label="Waiting to download" disabled>
        <Clock />
      </IconButton>
    );
  }
  if (chapter.downloaded) {
    return (
      <IconButton
        label="Downloaded"
        className={styles.downloaded}
        onClick={() => onActions(chapter)}
      >
        <CircleCheck />
      </IconButton>
    );
  }
  if (job === 'failed') {
    return (
      <IconButton
        label="Download failed, try again"
        className={styles.failed}
        onClick={() => onDownload(chapter)}
      >
        <CircleAlert />
      </IconButton>
    );
  }
  return (
    <IconButton label="Download" onClick={() => onDownload(chapter)}>
      <ArrowDownToLine />
    </IconButton>
  );
}
