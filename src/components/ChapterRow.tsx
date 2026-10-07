import { memo } from 'react';
import { ArrowDownToLine, CircleAlert, CircleCheck, Clock } from 'lucide-react';
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
  const reading = !chapter.read && chapter.progress > 0.01;
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
        <span className={styles.title}>{chapter.title}</span>
        <span className={styles.sub}>
          {[chapter.released, reading && `${Math.round(chapter.progress * 100)}% read`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </button>
      <DownloadState chapter={chapter} job={job} onDownload={onDownload} onActions={onActions} />
    </li>
  );
});

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
