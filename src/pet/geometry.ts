import { stageFor } from './growth';

/** The drawing is 400 × 400; the serpent coils around this point. */
export const SIZE = 400;
export const CENTER = { x: 200, y: 205 };
/** Midgard's radius in the last two stages. */
export const WORLD_RADIUS = 104;

export interface Point {
  x: number;
  y: number;
  /** Depth: positive towards the viewer. 0 for the flat coils of the younger stages. */
  z: number;
}

export interface Body {
  /** From the tip of the tail to the head, about 3px apart on screen. */
  points: Point[];
  /** Thickness at the head end. */
  width: number;
  /** Whether it is wrapped around Midgard. */
  world: boolean;
}

/** Thickness by level: a hatchling is a thread, Jormungandr a river. */
export function widthFor(level: number): number {
  // Around Midgard it fattens fast: in the drawings the World Serpent's body is a quarter of the
  // world across.
  if (level >= 45) return Math.min(48, 36 + (level - 45) * 0.7);
  return Math.min(30, 5 + level * 0.5);
}

/** Keeps points about `step` px apart on screen, so scales are spaced evenly. */
function resample(dense: Point[], step: number): Point[] {
  const out: Point[] = [dense[0]];
  let carried = 0;
  for (let i = 1; i < dense.length; i += 1) {
    const a = dense[i - 1];
    const b = dense[i];
    carried += Math.hypot(b.x - a.x, b.y - a.y);
    if (carried >= step) {
      out.push(b);
      carried = 0;
    }
  }
  return out;
}

/**
 * A closed path over a sphere, tilted towards the viewer: twice around, weaving up and down, so
 * the serpent crosses over itself and Midgard like a ball of yarn. `upTo` (0–1) is how much of
 * it the body covers; at 1 the head meets the tail.
 */
function aroundTheWorld(radius: number, upTo: number): Point[] {
  const dense: Point[] = [];
  const tiltX = 0.6;
  const tiltZ = -0.45;
  const steps = 1400;
  for (let i = 0; i <= steps * upTo; i += 1) {
    const t = i / steps;
    const lon = Math.PI * 2 * 2 * t;
    const lat = 0.78 * Math.sin(Math.PI * 2 * 3 * t + 0.6);
    let x = radius * Math.cos(lat) * Math.cos(lon);
    let y = radius * Math.sin(lat);
    let z = radius * Math.cos(lat) * Math.sin(lon);
    // Tilt the sphere so the loops cross its face instead of running round its rim.
    [y, z] = [y * Math.cos(tiltX) - z * Math.sin(tiltX), y * Math.sin(tiltX) + z * Math.cos(tiltX)];
    [x, y] = [x * Math.cos(tiltZ) - y * Math.sin(tiltZ), x * Math.sin(tiltZ) + y * Math.cos(tiltZ)];
    dense.push({ x: CENTER.x + x, y: CENTER.y + y, z });
  }
  return dense;
}

/**
 * The serpent's body for a level: a flat spiral of coils that gets longer and thicker as it
 * grows, then, from the World Serpent on, a body wound around Midgard that closes when it becomes
 * Jormungandr and bites its own tail.
 */
export function bodyFor(level: number): Body {
  const stage = stageFor(level).id;
  const width = widthFor(level);

  if (stage === 'world' || stage === 'jormungandr') {
    const upTo = stage === 'jormungandr' ? 1 : 0.42 + 0.5 * ((level - 45) / 15);
    const dense = aroundTheWorld(WORLD_RADIUS + width * 0.55, upTo);
    return { points: resample(dense, 3), width, world: true };
  }

  // An Archimedean spiral from the tail at the centre outwards, coils one body apart.
  const length = 90 + level * 18;
  const pitch = width * 1.35;
  const k = pitch / (Math.PI * 2);
  const r0 = width * 0.8;
  const points: Point[] = [];
  let theta = 0;
  let walked = 0;
  while (walked <= length) {
    const r = r0 + k * theta;
    points.push({ x: CENTER.x + r * Math.cos(theta), y: CENTER.y + r * Math.sin(theta), z: 0 });
    theta += 3 / Math.max(r, 4);
    walked += 3;
  }
  return { points, width, world: false };
}

/**
 * Whether Midgard hides a point: behind it and inside its outline. Parts behind but outside the
 * outline are drawn in front, so the body only changes layers where the globe's edge covers the
 * join.
 */
export function isBehind(p: Point): boolean {
  return p.z < 0 && Math.hypot(p.x - CENTER.x, p.y - CENTER.y) < WORLD_RADIUS + 6;
}

/** The direction of travel at a point, in radians, from its neighbours. */
export function tangentAt(points: readonly Point[], i: number): number {
  const a = points[Math.max(0, i - 2)];
  const b = points[Math.min(points.length - 1, i + 2)];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Thickness along the body, 0 at the tail tip to 1 at the head, with depth foreshortening. */
export function widthAt(body: Body, i: number): number {
  const t = i / (body.points.length - 1);
  const depth = body.world ? 0.88 + 0.12 * (body.points[i].z / (WORLD_RADIUS + body.width)) : 1;
  return body.width * (0.18 + 0.82 * Math.sqrt(t)) * depth;
}

export interface Scale {
  x: number;
  y: number;
  /** Degrees; scales point back towards the tail. */
  angle: number;
  /** Length along the body. */
  length: number;
  /** Half width across. */
  half: number;
  /** 0 lit, 1 in shadow (the side away from the light). */
  shade: 0 | 1;
  /** Which row across the body: -1, 0 or 1 (0 is the spine). */
  row: number;
  /** Position along the body, for patterns. */
  step: number;
  back: boolean;
}

/** Light from the upper left, as in an ink drawing lit from the window. */
const LIGHT = { x: -0.6, y: -0.8 };

/**
 * Overlapping scales along the body, staggered like brickwork, from the tail to the head so each
 * scale nearer the head lies over the one behind it, as feathers do.
 */
export function scalesFor(body: Body): Scale[] {
  const scales: Scale[] = [];
  const { points } = body;
  let step = 0;
  for (let i = 0; i < points.length;) {
    const width = widthAt(body, i);
    const angle = tangentAt(points, i);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const rows = width < 9 ? [0] : width < 16 ? [-0.5, 0.5] : [-1, 0, 1];
    for (const row of rows) {
      const offset = row * width * 0.3;
      const shadeSide = row * (nx * LIGHT.x + ny * LIGHT.y);
      // Every other row sits half a scale further along, like brickwork.
      const along = (rows.length === 3 ? row === 0 : row > 0) ? width * 0.2 : 0;
      scales.push({
        x: points[i].x + nx * offset + Math.cos(angle) * along,
        y: points[i].y + ny * offset + Math.sin(angle) * along,
        angle: (angle * 180) / Math.PI + 180,
        length: width * 0.9,
        half: width * (rows.length === 1 ? 0.42 : 0.27),
        shade: shadeSide < -0.15 ? 1 : 0,
        row: Math.round(row),
        step,
        back: isBehind(points[i]),
      });
    }
    step += 1;
    // About half the width apart, so each long scale overlaps the next like feathers.
    i += Math.max(1, Math.round((width * 0.5) / 3));
  }
  return scales;
}
