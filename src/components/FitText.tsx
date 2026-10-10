import { useLayoutEffect, useRef } from 'react';

/** Font sizes to try, relative to the size the class sets, before giving up. */
const SCALES = [1, 0.94, 0.88, 0.82];

/**
 * Text whose class clamps it to a few lines. When it doesn't fit, a slightly smaller size is tried
 * first, so a title that nearly fits shows in full; failing that, it keeps its size and the
 * ellipsis.
 */
export function FitText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = -1;
    const fit = (force: boolean) => {
      if (!force && el.clientWidth === width) return;
      width = el.clientWidth;
      el.style.fontSize = '';
      const base = parseFloat(getComputedStyle(el).fontSize);
      for (const scale of SCALES) {
        if (scale < 1) el.style.fontSize = `${base * scale}px`;
        if (el.scrollHeight <= el.clientHeight + 1) return;
      }
      el.style.fontSize = '';
    };
    fit(true);
    // Refit when the width changes (rotating the phone) and once the bundled fonts have loaded.
    const observer = new ResizeObserver(() => fit(false));
    observer.observe(el);
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) fit(true);
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [text]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
