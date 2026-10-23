import { stageFor } from './growth';

/** The drawing is 400 × 400; the serpent coils around this point. */
export const SIZE = 400;
export const CENTER = { x: 200, y: 212 };
/** Midgard's radius in the last two stages. */
export const WORLD_RADIUS = 92;

export interface Point {
  x: number;
  y: number;
}

export interface Body {
  /** From the tip of the tail to the head. */
  points: Point[];
  /** Thickness at the head end. */
  width: number;
  /** The head's direction, in degrees. */
  angle: number;
  /** Whether Midgard is drawn inside the ring. */
  world: boolean;
}

/** Thickness by level: a hatchling is a thread, Jormungandr a river. */
export function widthFor(level: number): number {
  return Math.min(34, 5 + level * 0.55);
}

/**
 * The serpent's body for a level: a spiral of coils that gets longer and thicker as it grows,
 * then, from the World Serpent on, a ring around Midgard that closes when it becomes
 * Jormungandr and bites its own tail.
 */
export function bodyFor(level: number): Body {
  const stage = stageFor(level).id;
  const width = widthFor(level);
  const points: Point[] = [];

  if (stage === 'world' || stage === 'jormungandr') {
    const radius = WORLD_RADIUS + width / 2 + 8;
    // The ring closes over the World Serpent's levels; Jormungandr's head reaches the tail.
    const sweep =
      stage === 'jormungandr'
        ? Math.PI * 2 * 1.02
        : Math.PI * 2 * (0.55 + 0.4 * ((level - 45) / 15));
    const start = -Math.PI / 2 + 0.25;
    const steps = 140;
    for (let i = 0; i <= steps; i += 1) {
      const a = start + (sweep * i) / steps;
      points.push({ x: CENTER.x + radius * Math.cos(a), y: CENTER.y + radius * Math.sin(a) });
    }
    return { points, width, angle: headAngle(points), world: true };
  }

  // An Archimedean spiral from the tail at the centre outwards, coils one body apart.
  const length = 90 + level * 18;
  const pitch = width * 1.25;
  const k = pitch / (Math.PI * 2);
  const r0 = width * 0.7;
  const step = 3;
  let theta = 0;
  let walked = 0;
  while (walked <= length) {
    const r = r0 + k * theta;
    points.push({ x: CENTER.x + r * Math.cos(theta), y: CENTER.y + r * Math.sin(theta) });
    theta += step / Math.max(r, 4);
    walked += step;
  }
  return { points, width, angle: headAngle(points), world: false };
}

function headAngle(points: Point[]): number {
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** An SVG path through points, as straight segments (they're 3px apart, so it reads as a curve). */
export function pathThrough(points: readonly Point[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
}

/** The body split into pieces that thicken from the tail to the head. */
export function taperedPieces(body: Body, pieces = 26): { d: string; width: number }[] {
  const { points, width } = body;
  const result: { d: string; width: number }[] = [];
  const per = Math.max(2, Math.ceil(points.length / pieces));
  for (let start = 0; start < points.length - 1; start += per) {
    const slice = points.slice(start, Math.min(points.length, start + per + 1));
    const t = (start + slice.length / 2) / points.length;
    result.push({ d: pathThrough(slice), width: width * (0.22 + 0.78 * Math.sqrt(t)) });
  }
  return result;
}
