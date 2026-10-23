import { memo, useMemo, type CSSProperties } from 'react';
import { itemById, type Equipped } from './catalog';
import {
  bodyFor,
  CENTER,
  isBehind,
  scalesFor,
  SIZE,
  tangentAt,
  widthAt,
  WORLD_RADIUS,
  type Body,
  type Point,
  type Scale,
} from './geometry';
import { stageFor } from './growth';
import styles from './Serpent.module.scss';

/** Sepia ink, as in a pen drawing. */
const INK = '#2b211b';
const EMBER = '#e67e22';

interface SerpentProps {
  level: number;
  equipped: Equipped;
  /** Morsels flying into its mouth, when it's being fed. */
  morsels?: number;
}

/**
 * How much to magnify the body so it fills the scene: a hatchling is drawn close up, and the
 * camera pulls back as it grows.
 */
function zoomFor(body: Body): number {
  if (body.world) return 1;
  let extent = 0;
  for (const p of body.points) {
    extent = Math.max(extent, Math.hypot(p.x - CENTER.x, p.y - CENTER.y));
  }
  return Math.min(3, Math.max(1, 150 / (extent + body.width)));
}

/** The body's points split into runs in front of Midgard or behind it. */
function runs(points: Point[], back: boolean): Point[][] {
  const result: Point[][] = [];
  let run: Point[] = [];
  for (const p of points) {
    if (isBehind(p) === back) run.push(p);
    else if (run.length) {
      result.push(run);
      run = [];
    }
  }
  if (run.length) result.push(run);
  return result;
}

function pathOf(points: readonly { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
}

/** A leaf-shaped scale pointing along +x from its base at the origin. */
function scalePath(length: number, half: number): string {
  const l = length.toFixed(1);
  const h = half.toFixed(1);
  const a = (length * 0.15).toFixed(1);
  const m = (length * 0.55).toFixed(1);
  return `M0 0C${a} -${h} ${m} -${h} ${l} 0C${m} ${h} ${a} ${h} 0 0Z`;
}

/** The vein down a scale, and hatching on its shadowed side. */
function scaleLines(length: number, half: number, shade: 0 | 1): string {
  const vein = `M${(length * 0.12).toFixed(1)} 0L${(length * 0.85).toFixed(1)} 0`;
  if (!shade) return vein;
  const lines = [0.45, 0.62, 0.78].map((f) => {
    const x = length * f;
    return `M${x.toFixed(1)} ${(half * 0.15).toFixed(1)}L${(x - length * 0.12).toFixed(1)} ${(half * 0.7).toFixed(1)}`;
  });
  return vein + lines.join('');
}

function scaleFill(scale: Scale, skin: string, pattern: string): string {
  if (pattern === 'pattern-bands' && Math.floor(scale.step / 3) % 2 === 1) {
    return `color-mix(in srgb, ${skin} 60%, #3a2a1e)`;
  }
  if (pattern === 'pattern-spine' && scale.row === 0) {
    return `color-mix(in srgb, ${skin} 55%, #7a2e1e)`;
  }
  return scale.shade ? `color-mix(in srgb, ${skin} 72%, #5a3d24)` : skin;
}

function Scales({ scales, skin, pattern }: { scales: Scale[]; skin: string; pattern: string }) {
  return (
    <g strokeLinejoin="round">
      {scales.map((scale, i) => (
        <g
          key={i}
          transform={`translate(${scale.x.toFixed(1)} ${scale.y.toFixed(1)}) rotate(${scale.angle.toFixed(1)})`}
        >
          <path
            d={scalePath(scale.length, scale.half)}
            fill={scaleFill(scale, skin, pattern)}
            stroke={INK}
            strokeWidth={0.9}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={scaleLines(scale.length, scale.half, scale.shade)}
            fill="none"
            stroke={INK}
            strokeOpacity={0.7}
            strokeWidth={0.6}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {pattern === 'pattern-runes' && scale.row === 0 && scale.step % 5 === 0 && (
            <path
              d={`M${scale.length * 0.3} 0L${scale.length * 0.7} 0M${scale.length * 0.45} ${-scale.half * 0.5}L${scale.length * 0.6} 0`}
              stroke={EMBER}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {pattern === 'pattern-stars' && scale.step % 3 === scale.row + 1 && (
            <circle cx={scale.length * 0.5} cy={0} r={0.9} fill="#fbf6e9" />
          )}
        </g>
      ))}
    </g>
  );
}

/** The body under its scales: an ink outline with a shadowed core, so gaps read as depth. */
function Underlay({ body, points, skin }: { body: Body; points: Point[][]; skin: string }) {
  const pieces: { d: string; width: number }[] = [];
  for (const run of points) {
    for (let start = 0; start < run.length - 1; start += 6) {
      const slice = run.slice(start, start + 7);
      const index = body.points.indexOf(slice[Math.floor(slice.length / 2)]);
      pieces.push({ d: pathOf(slice), width: widthAt(body, index) });
    }
  }
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {pieces.map((piece, i) => (
        <path key={`o${i}`} d={piece.d} stroke={INK} strokeWidth={piece.width + 2.4} />
      ))}
      {pieces.map((piece, i) => (
        <path
          key={`c${i}`}
          d={piece.d}
          stroke={`color-mix(in srgb, ${skin} 55%, #4a3220)`}
          strokeWidth={piece.width}
        />
      ))}
    </g>
  );
}

/** A wobbly closed loop, for Midgard's contour lines. */
function loop(cx: number, cy: number, r: number, seed: number): string {
  const points = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    const wobble = 1 + 0.12 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5 + seed * 2);
    return { x: cx + r * wobble * Math.cos(a), y: cy + r * 0.8 * wobble * Math.sin(a) };
  });
  return `${pathOf(points)}Z`;
}

const ISLANDS = [
  { dx: -38, dy: -30, r: 34, seed: 1 },
  { dx: 42, dy: 18, r: 30, seed: 4 },
  { dx: -20, dy: 52, r: 20, seed: 7 },
  { dx: 30, dy: -58, r: 16, seed: 2 },
];

/** Midgard in ink: teal land with contour rings, hatched on the side away from the light. */
function Midgard() {
  const { x, y } = CENTER;
  const r = WORLD_RADIUS;
  return (
    <g>
      <defs>
        <clipPath id="midgard">
          <circle cx={x} cy={y} r={r} />
        </clipPath>
        <pattern
          id="hatch"
          width={4}
          height={4}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(40)"
        >
          <line x1={0} y1={0} x2={0} y2={4} stroke={INK} strokeWidth={0.8} />
        </pattern>
        <radialGradient id="shade" cx="30%" cy="28%" r="80%">
          <stop offset="55%" stopColor="#fff" stopOpacity={0} />
          <stop offset="100%" stopColor="#fff" stopOpacity={1} />
        </radialGradient>
        <mask id="dark">
          <rect width={SIZE} height={SIZE} fill="url(#shade)" />
        </mask>
      </defs>
      <circle cx={x} cy={y} r={r} fill="#8fc2b8" />
      <g clipPath="url(#midgard)" fill="none">
        {ISLANDS.map((island) =>
          [1, 0.72, 0.46, 0.22].map((f) => (
            <path
              key={`${island.seed}-${f}`}
              d={loop(x + island.dx, y + island.dy, island.r * f, island.seed)}
              stroke="#5d9389"
              strokeWidth={1.1}
            />
          )),
        )}
        {Array.from({ length: 60 }, (_, i) => (
          <circle
            key={i}
            cx={x + 20 + ((i * 37) % 70)}
            cy={y + 40 + ((i * 53) % 55)}
            r={0.7}
            fill={INK}
            opacity={0.55}
          />
        ))}
        <rect width={SIZE} height={SIZE} fill="url(#hatch)" mask="url(#dark)" opacity={0.75} />
      </g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={INK} strokeWidth={2} />
    </g>
  );
}

/** Small feather scales over the skull, pointing back like the body's. */
const HEAD_SCALES = [
  { x: -6, y: -9, l: 9 },
  { x: -6, y: -6, l: 9 },
  { x: -6, y: -3, l: 9 },
  { x: -6, y: 0, l: 9 },
  { x: -6, y: 3, l: 9 },
  { x: -6, y: 6, l: 9 },
  { x: -6, y: 9, l: 9 },
  { x: 1, y: -8.5, l: 8.5 },
  { x: 1, y: -5.5, l: 8.5 },
  { x: 1, y: -2.5, l: 8.5 },
  { x: 1, y: 0.5, l: 8.5 },
  { x: 1, y: 3.5, l: 8.5 },
  { x: 1, y: 6.5, l: 8.5 },
  { x: 8, y: -6, l: 7.5 },
  { x: 8, y: -3, l: 7.5 },
  { x: 8, y: 0, l: 7.5 },
  { x: 8, y: 3, l: 7.5 },
  { x: 8, y: 6, l: 7.5 },
  { x: 14, y: -1.8, l: 6.5 },
  { x: 14, y: 1.8, l: 6.5 },
];

/** The head in ink, seen from above, facing +x; drawn for a body 20 wide and scaled. */
function Head({ width, equipped, adult }: { width: number; equipped: Equipped; adult: boolean }) {
  const skin = itemById(equipped.skin)?.color ?? '#eedcb6';
  const shadow = `color-mix(in srgb, ${skin} 72%, #5a3d24)`;
  const eye = adult ? '#d9902b' : '#b7862f';
  return (
    <g transform={`scale(${(width / 20).toFixed(3)})`} strokeLinejoin="round">
      {/* Skull: wide behind the eyes, tapering to a blunt snout. */}
      <path
        d="M-13 -11C-4 -14 8 -13 17 -8C24 -5 30 -2.5 31 0C30 2.5 24 5 17 8C8 13 -4 14 -13 11C-11 4 -11 -4 -13 -11Z"
        fill={skin}
        stroke={INK}
        strokeWidth={1.3}
      />
      {/* Shadowed underside of the jaw, hatched. */}
      <path d="M-12 7C-2 11 10 11 18 7C14 10 4 13 -12 11Z" fill={shadow} />
      <path
        d="M-6 9.5L-4 11.5M-1 10L1 12M4 10L6 12M9 9.5L11 11"
        stroke={INK}
        strokeWidth={0.5}
        strokeOpacity={0.7}
      />
      {HEAD_SCALES.map((scale, i) => (
        <g key={i} transform={`translate(${scale.x} ${scale.y}) rotate(180)`}>
          <path
            d={scalePath(scale.l, 1.8)}
            fill={i % 2 ? skin : shadow}
            stroke={INK}
            strokeWidth={0.55}
          />
          <path d={`M1 0L${scale.l * 0.8} 0`} stroke={INK} strokeWidth={0.35} strokeOpacity={0.7} />
        </g>
      ))}
      {[-1, 1].map((side) => (
        <g key={side}>
          {/* Brow ridge, a raised plate over each eye. */}
          <path
            d={`M12 ${side * 4.5}C14 ${side * 9} 19 ${side * 9.5} 23 ${side * 6}C20 ${side * 7} 16 ${side * 6.5} 12 ${side * 4.5}Z`}
            fill={skin}
            stroke={INK}
            strokeWidth={0.8}
          />
          <ellipse
            cx={18}
            cy={side * 6.6}
            rx={2.7}
            ry={1.9}
            fill={eye}
            stroke={INK}
            strokeWidth={0.8}
          />
          <ellipse cx={18.2} cy={side * 6.6} rx={0.5} ry={1.5} fill={INK} />
          <path
            d={`M26 ${side * 1.6}q1.2 ${side * 0.4} 2 ${side * 0.2}`}
            stroke={INK}
            strokeWidth={0.7}
            fill="none"
          />
          {/* Lip line along the jaw. */}
          <path
            d={`M14 ${side * 9}C20 ${side * 6.5} 26 ${side * 3.8} 30 ${side * 1.5}`}
            fill="none"
            stroke={INK}
            strokeWidth={0.6}
          />
        </g>
      ))}
      {equipped.head === 'head-horns' && (
        <path
          d="M-4 -10C-10 -17 -19 -20 -27 -17C-20 -15 -13 -13 -8 -7M-4 10C-10 17 -19 20 -27 17C-20 15 -13 13 -8 7"
          fill="#efe6d2"
          stroke={INK}
          strokeWidth={0.9}
        />
      )}
      {equipped.head === 'head-helm' && (
        <g stroke={INK} strokeWidth={0.9}>
          <path d="M-10 -11C0 -13 9 -9 11 0C9 9 0 13 -10 11Z" fill="#9a9da2" />
          <path d="M-10 0H10M0 -12.5V12.5" fill="none" strokeWidth={0.6} />
          <path
            d="M-4 -12C-6 -20 -12 -24 -17 -23C-12 -21 -9 -17 -8 -11M-4 12C-6 20 -12 24 -17 23C-12 21 -9 17 -8 11"
            fill="#efe6d2"
          />
        </g>
      )}
      {equipped.head === 'head-crown' && (
        <path
          d="M-6 -7L-1 -4L0 -10L2 -4L7 -7L5 7L-5 7Z"
          fill="#d4a933"
          stroke={INK}
          strokeWidth={0.8}
          transform="translate(0 0) rotate(90)"
        />
      )}
    </g>
  );
}

function Neck({ body, id }: { body: Body; id: string }) {
  if (id === 'neck-none') return null;
  const index = Math.max(1, body.points.length - 1 - Math.round((body.width * 1.6) / 3));
  const p = body.points[index];
  const width = widthAt(body, index);
  const angle = (tangentAt(body.points, index) * 180) / Math.PI;
  const h = width * 0.62;
  const t = `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(1)})`;
  if (id === 'neck-scarf') {
    return (
      <g transform={t} stroke={INK} strokeWidth={0.9}>
        <rect x={-width * 0.22} y={-h} width={width * 0.44} height={h * 2} rx={3} fill="#9b2c2c" />
        <path
          d={`M0 ${h}q${-width * 0.5} ${width * 0.4} ${-width * 1.1} ${width * 0.2}l${width * 0.1} ${-width * 0.25}q${width * 0.4} 0 ${width * 0.7} ${-width * 0.2}`}
          fill="#9b2c2c"
        />
      </g>
    );
  }
  if (id === 'neck-torc') {
    return (
      <g transform={t} stroke={INK} strokeWidth={0.8}>
        <rect x={-width * 0.12} y={-h} width={width * 0.24} height={h * 2} rx={2} fill="#d4a933" />
        <circle cx={0} cy={-h} r={width * 0.15} fill="#b8902f" />
        <circle cx={0} cy={h} r={width * 0.15} fill="#b8902f" />
      </g>
    );
  }
  return (
    <g transform={t}>
      {[-1, -0.33, 0.33, 1].map((y) => (
        <ellipse
          key={y}
          cx={0}
          cy={y * h}
          rx={width * 0.15}
          ry={width * 0.21}
          fill="none"
          stroke="#6d7277"
          strokeWidth={width * 0.08}
        />
      ))}
    </g>
  );
}

function Scene({ id }: { id: string }) {
  const color = itemById(id)?.color ?? '#8ea08a';
  return (
    <g>
      <defs>
        <radialGradient id="vignette" cx="50%" cy="48%" r="70%">
          <stop offset="60%" stopColor={INK} stopOpacity={0} />
          <stop offset="100%" stopColor={INK} stopOpacity={0.28} />
        </radialGradient>
      </defs>
      <rect width={SIZE} height={SIZE} fill={color} />
      <g fill="none" stroke={INK} strokeOpacity={0.35} strokeLinecap="round">
        {id === 'scene-forest' &&
          [24, 64, 112, 270, 318, 362].map((x) => (
            <path
              key={x}
              d={`M${x} 400q4 -26 -6 -44M${x + 8} 400q2 -18 10 -30`}
              strokeWidth={1.2}
            />
          ))}
        {id === 'scene-cave' &&
          [20, 90, 150, 240, 300, 370].map((x, i) => (
            <path
              key={x}
              d={`M${x - 14} 0L${x} ${40 + (i % 3) * 22}L${x + 14} 0`}
              strokeWidth={1.2}
            />
          ))}
        {id === 'scene-fjord' && (
          <path d="M0 150L70 70L120 120L190 40L260 125L320 80L400 150" strokeWidth={1.4} />
        )}
        {(id === 'scene-midgard' || id === 'scene-deep') &&
          Array.from({ length: 26 }, (_, i) => {
            const cx = (i * 137) % SIZE;
            const cy = (i * 89) % SIZE;
            return id === 'scene-deep' ? (
              <circle key={i} cx={cx} cy={cy} r={i % 4 ? 1.5 : 3} strokeWidth={0.8} />
            ) : (
              <path key={i} d={`M${cx - 2} ${cy}h4M${cx} ${cy - 2}v4`} strokeWidth={0.8} />
            );
          })}
      </g>
      <rect width={SIZE} height={SIZE} fill="url(#vignette)" />
    </g>
  );
}

function Aura({ id }: { id: string }) {
  const color = itemById(id)?.color;
  if (!color) return null;
  return (
    <g>
      <defs>
        <radialGradient id="aura">
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={CENTER.x} cy={CENTER.y} r={180} fill="url(#aura)" />
    </g>
  );
}

function Egg({ cracked }: { cracked: boolean }) {
  const { x, y } = CENTER;
  return (
    <g stroke={INK} strokeLinecap="round">
      <ellipse cx={x} cy={y + 10} rx={50} ry={64} fill="#eedcb6" strokeWidth={2} />
      <path
        d={`M${x - 8} ${y - 22}V${y + 36}M${x - 8} ${y - 20}L${x + 10} ${y - 8}`}
        stroke={EMBER}
        strokeWidth={4}
        fill="none"
      />
      <path
        d={`M${x + 22} ${y + 30}l10 -6M${x + 18} ${y + 40}l14 -8M${x + 14} ${y + 50}l16 -9`}
        strokeWidth={0.8}
        fill="none"
      />
      {cracked && (
        <path d={`M${x - 32} ${y - 8}l10 8l8 -10l9 12l10 -9`} strokeWidth={1.4} fill="none" />
      )}
    </g>
  );
}

const STAGE_ORDER = ['egg', 'hatchling', 'snake', 'serpent', 'sea', 'world', 'jormungandr'];

/**
 * The serpent as an ink drawing, built from parts for its level and outfit: hundreds of
 * overlapping scales, so it's memoised and nothing inside it animates. The page moves the whole
 * drawing as one layer instead, which the compositor handles without redrawing it.
 */
export const Serpent = memo(function Serpent({ level, equipped, morsels = 0 }: SerpentProps) {
  const stage = stageFor(level);
  const body = useMemo(() => bodyFor(level), [level]);
  const scales = useMemo(() => scalesFor(body), [body]);
  const zoom = useMemo(() => zoomFor(body), [body]);
  const skin = itemById(equipped.skin)?.color ?? '#eedcb6';
  const head = body.points[body.points.length - 1];
  const headAngle = (tangentAt(body.points, body.points.length - 1) * 180) / Math.PI;
  const adult = STAGE_ORDER.indexOf(stage.id) >= 3;
  // On screen, after the zoom, for the morsels to fly to.
  const target = {
    x: CENTER.x + (head.x - CENTER.x) * zoom,
    y: CENTER.y + (head.y - CENTER.y) * zoom,
  };

  return (
    <div className={styles.frame}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={styles.svg}
        role="img"
        aria-label={`${stage.name}, level ${level}`}
      >
        <Scene id={equipped.scene} />
        <Aura id={equipped.aura} />
        {stage.id === 'egg' ? (
          <Egg cracked={level > 0} />
        ) : (
          <g
            transform={`translate(${CENTER.x} ${CENTER.y}) scale(${zoom.toFixed(3)}) translate(${-CENTER.x} ${-CENTER.y})`}
          >
            {body.world && (
              <g opacity={0.92}>
                <Underlay body={body} points={runs(body.points, true)} skin={skin} />
                <Scales
                  scales={scales.filter((s) => s.back)}
                  skin={skin}
                  pattern={equipped.pattern}
                />
              </g>
            )}
            {body.world && <Midgard />}
            <Underlay body={body} points={runs(body.points, false)} skin={skin} />
            <Scales scales={scales.filter((s) => !s.back)} skin={skin} pattern={equipped.pattern} />
            <Neck body={body} id={equipped.neck} />
            <g
              transform={`translate(${head.x.toFixed(1)} ${head.y.toFixed(1)}) rotate(${headAngle.toFixed(1)})`}
            >
              <Head
                width={widthAt(body, body.points.length - 1)}
                equipped={equipped}
                adult={adult}
              />
            </g>
          </g>
        )}
      </svg>
      {morsels > 0 && (
        // A separate layer, so the flying morsels never make the drawing repaint.
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.overlay} aria-hidden>
          {Array.from({ length: Math.min(morsels, 8) }, (_, i) => (
            <circle
              key={i}
              cx={SIZE / 2}
              cy={SIZE + 10}
              r={5}
              className={styles.morsel}
              style={
                {
                  '--dx': `${target.x - SIZE / 2}px`,
                  '--dy': `${target.y - SIZE - 10}px`,
                  animationDelay: `${i * 0.18}s`,
                } as CSSProperties
              }
            />
          ))}
        </svg>
      )}
    </div>
  );
});
