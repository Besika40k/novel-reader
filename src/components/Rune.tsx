/*
 * Elder Futhark runes for the main tabs' titles, drawn as strokes: the bundled fonts have no
 * Runic glyphs, and the phone's fallback font might not either.
 */
const RUNES = {
  /** ᚨ Ansuz, Odin's rune: wisdom and words. The library. */
  ansuz: 'M4 2V22M4 3L12 8M4 9L12 14',
  /** ᛞ Dagaz, "day". History, which is kept by day. */
  dagaz: 'M2 3V21M14 3V21M2 3L14 21M14 3L2 21',
  /** ᚱ Raidho, "ride": the journey. Browse. */
  raidho: 'M4 2V22M4 2L12 7L4 12L12 22',
  /** ᛏ Tiwaz, Tyr's rune: order and law. Settings. */
  tiwaz: 'M8 2V22M2 8L8 2L14 8',
};

export type RuneName = keyof typeof RUNES;

export function Rune({ name, className }: { name: RuneName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={RUNES[name]} />
    </svg>
  );
}
