import { useEffect } from 'react';
import { addReadingTime } from '@/db/stats';

/** A longer gap between scrolls or taps counts as this much: the reader looked away. */
const IDLE_MS = 90_000;
/** Saved about this often while reading, and always when the reader closes or hides. */
const FLUSH_SECONDS = 60;

/**
 * Counts time spent reading a chapter for the statistics. Driven by scroll and tap events, no
 * timers: the time since the last event is added on each one, capped so a phone left open on
 * the table doesn't count.
 */
export function useReadingTime(novelId: string, chapterUrl: string | undefined): void {
  useEffect(() => {
    if (!chapterUrl) return;
    let last = Date.now();
    let pending = 0;
    const count = () => {
      const now = Date.now();
      pending += Math.min(now - last, IDLE_MS) / 1000;
      last = now;
    };
    const flush = () => {
      if (pending < 1) return;
      void addReadingTime(novelId, pending).catch(() => undefined);
      pending = 0;
    };
    const onActivity = () => {
      if (document.visibilityState !== 'visible') return;
      count();
      if (pending >= FLUSH_SECONDS) flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        count();
        flush();
      } else {
        last = Date.now();
      }
    };
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('pointerdown', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      if (document.visibilityState === 'visible') count();
      flush();
    };
  }, [novelId, chapterUrl]);
}
