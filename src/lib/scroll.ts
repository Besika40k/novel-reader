import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigationType } from 'react-router';

const positions = new Map<string, number>();

/**
 * Page scroll handling for pages whose content loads asynchronously: new visits start at the
 * top, and going back restores the old position once `ready` says the content is rendered.
 */
export function usePageScroll(key: string, ready: boolean): void {
  const navigationType = useNavigationType();
  const handled = useRef(false);

  useEffect(() => {
    // Until the position is restored, scroll events come from the page still being short.
    const save = () => {
      if (handled.current) positions.set(key, window.scrollY);
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [key]);

  useLayoutEffect(() => {
    if (handled.current) return;
    if (navigationType !== 'POP') {
      handled.current = true;
      window.scrollTo(0, 0);
      return;
    }
    if (!ready) return;
    handled.current = true;
    window.scrollTo(0, positions.get(key) ?? 0);
  }, [key, ready, navigationType]);
}
