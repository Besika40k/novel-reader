import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { pushBackHandler } from '@/lib/native';
import styles from './Sheet.module.scss';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** A panel that slides up from the bottom. Back button, Escape and tapping outside close it. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const removeBackHandler = pushBackHandler(onClose);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      removeBackHandler();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onClose} />
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.handle} aria-hidden />
        {title && <h2 className={styles.title}>{title}</h2>}
        {children}
      </section>
    </div>,
    document.body,
  );
}
