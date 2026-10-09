import type { NovelSummary } from '@/sources/types';
import { Spinner } from './Button';
import { Cover } from './Cover';
import styles from './NovelRow.module.scss';

interface NovelRowProps {
  novel: NovelSummary;
  /** The muted line under the title. */
  details?: string;
  busy?: boolean;
  disabled?: boolean;
  onOpen: () => void;
}

/** A novel in a list of a site's novels: cover, title and a short line about it. */
export function NovelRow({ novel, details, busy, disabled, onOpen }: NovelRowProps) {
  return (
    <button type="button" className={styles.row} onClick={onOpen} disabled={disabled}>
      <Cover src={novel.coverUrl} title={novel.title} className={styles.thumb} />
      <span className={styles.text}>
        <span className={styles.title}>{novel.title}</span>
        {details && <span className={styles.details}>{details}</span>}
      </span>
      {busy && <Spinner size={18} />}
    </button>
  );
}
