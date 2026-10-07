import { useState } from 'react';
import styles from './Cover.module.scss';

function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter((word) => /^[a-z0-9]/i.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export function Cover({
  src,
  title,
  className,
}: {
  src?: string;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  const usable = src && failed !== src;
  return (
    <div className={[styles.cover, className].filter(Boolean).join(' ')}>
      {usable ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
      ) : (
        <div className={styles.placeholder} aria-hidden>
          {initials(title)}
        </div>
      )}
    </div>
  );
}
