import { cancelDownloads, retryFailed, useDownloads } from '@/downloads/queue';
import { Spinner } from './Button';
import styles from './DownloadStatus.module.scss';

/** Floating progress for the download queue; hidden when there's nothing to show. */
export function DownloadStatus({ aboveTabs }: { aboveTabs?: boolean }) {
  const { total, done, failed, running } = useDownloads();
  if (total === 0) return null;
  const className = [styles.pill, aboveTabs && styles.aboveTabs].filter(Boolean).join(' ');

  if (running) {
    const finished = done + failed;
    return (
      <div className={className} role="status">
        <Spinner size={16} />
        <span>
          Downloading {finished + 1 > total ? total : finished + 1} of {total}
        </span>
        <div className={styles.track} aria-hidden>
          <div className={styles.fill} style={{ width: `${(finished / total) * 100}%` }} />
        </div>
        <button type="button" className={styles.action} onClick={cancelDownloads}>
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className={className} role="status">
      <span>
        {failed} {failed === 1 ? 'chapter' : 'chapters'} failed to download
      </span>
      <button type="button" className={styles.action} onClick={retryFailed}>
        Retry
      </button>
      <button type="button" className={styles.action} onClick={cancelDownloads}>
        Dismiss
      </button>
    </div>
  );
}
