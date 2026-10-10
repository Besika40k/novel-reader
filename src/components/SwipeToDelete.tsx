import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { Trash2 } from 'lucide-react';
import styles from './SwipeToDelete.module.scss';

/** How far, as a share of the row's width, a swipe has to go to delete on release. */
const DELETE_AT = 0.6;

/**
 * A row that deletes when swiped most of the way to the left. A shorter swipe shows the red
 * delete strip and springs back on release, so there's room to change one's mind.
 */
export function SwipeToDelete({
  children,
  onDelete,
}: {
  children: ReactNode;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [armed, setArmed] = useState(false);
  const [gone, setGone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; width: number; axis?: 'x' | 'y' }>(undefined);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const point = event.touches[0];
    drag.current = { x: point.clientX, y: point.clientY, width: event.currentTarget.offsetWidth };
  };

  const onTouchMove = (event: TouchEvent) => {
    const current = drag.current;
    if (!current) return;
    const point = event.touches[0];
    const dx = point.clientX - current.x;
    const dy = point.clientY - current.y;
    // The first clear movement decides: sideways drags the row, up and down scrolls the page.
    current.axis ??=
      Math.abs(dx) > 8 || Math.abs(dy) > 8 ? (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y') : undefined;
    if (current.axis !== 'x') return;
    setDragging(true);
    const next = Math.min(0, dx);
    setOffset(next);
    setArmed(-next > current.width * DELETE_AT);
  };

  const onTouchEnd = () => {
    const current = drag.current;
    drag.current = undefined;
    if (current?.axis !== 'x') return;
    setDragging(false);
    if (armed) {
      setGone(true);
      setOffset(-current.width);
      window.setTimeout(onDelete, 200);
    } else {
      setOffset(0);
    }
    setArmed(false);
  };

  return (
    <div className={styles.row} data-gone={gone}>
      {/* Only as wide as the gap the row leaves, so the row itself never turns red. */}
      <div
        className={styles.behind}
        style={{ width: -offset }}
        data-armed={armed || gone}
        data-dragging={dragging}
        aria-hidden
      >
        <Trash2 />
      </div>
      <div
        className={styles.front}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        data-dragging={dragging}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
