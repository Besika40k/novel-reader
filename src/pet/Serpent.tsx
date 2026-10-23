import { memo, type CSSProperties } from 'react';
import { stageFor, type StageId } from './growth';
import styles from './Serpent.module.scss';

// Only the URLs are bundled into the code; each picture loads when its stage is on screen.
const IMAGES = import.meta.glob<string>('../assets/pet/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

function imageFor(stage: StageId): string {
  return IMAGES[`../assets/pet/${stage}.webp`];
}

interface SerpentProps {
  level: number;
  /** Morsels flying into it, when it's being fed. */
  morsels?: number;
}

/**
 * The serpent at its stage: an ink illustration per stage (src/assets/pet), on a frame the same
 * blue-grey as the pictures' backgrounds. The picture breathes as one composited layer, and the
 * morsels fly on their own layer above it.
 */
export const Serpent = memo(function Serpent({ level, morsels = 0 }: SerpentProps) {
  const stage = stageFor(level);
  return (
    <div className={styles.frame}>
      <img
        className={styles.image}
        src={imageFor(stage.id)}
        alt={`${stage.name}, level ${level}`}
        width={1024}
        height={1024}
        decoding="async"
      />
      {morsels > 0 && (
        <svg viewBox="0 0 400 400" className={styles.overlay} aria-hidden>
          {Array.from({ length: Math.min(morsels, 8) }, (_, i) => (
            <circle
              key={i}
              cx={200}
              cy={410}
              r={5}
              className={styles.morsel}
              style={{ animationDelay: `${i * 0.18}s` } as CSSProperties}
            />
          ))}
        </svg>
      )}
    </div>
  );
});
