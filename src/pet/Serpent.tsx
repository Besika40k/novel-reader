import { memo, useMemo } from 'react';
import { itemById, type Equipped } from './catalog';
import {
  bodyFor,
  CENTER,
  pathThrough,
  SIZE,
  taperedPieces,
  WORLD_RADIUS,
  type Body,
  type Point,
} from './geometry';
import { stageFor } from './growth';
import styles from './Serpent.module.scss';

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
  let extent = 0;
  for (const p of body.points)
    extent = Math.max(extent, Math.hypot(p.x - CENTER.x, p.y - CENTER.y));
  return Math.min(3, Math.max(1, 150 / (extent + body.width)));
}

/** A point `distance` px back along the body from the head. */
function backFromHead(points: Point[], distance: number): { point: Point; angle: number } {
  const index = Math.max(1, points.length - 1 - Math.round(distance / 3));
  const a = points[index - 1];
  const b = points[index];
  return { point: b, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
}

function Scene({ id }: { id: string }) {
  const color = itemById(id)?.color ?? '#24321f';
  return (
    <g>
      <rect width={SIZE} height={SIZE} fill={color} />
      {id === 'scene-forest' &&
        [30, 70, 120, 260, 310, 360].map((x) => (
          <path
            key={x}
            d={`M${x} 400 q4 -26 -6 -44 M${x + 8} 400 q2 -18 10 -30`}
            className={styles.grass}
          />
        ))}
      {id === 'scene-cave' &&
        [20, 90, 150, 240, 300, 370].map((x, i) => (
          <path
            key={x}
            d={`M${x - 14} 0 L${x} ${40 + (i % 3) * 22} L${x + 14} 0Z`}
            fill="#3a342e"
          />
        ))}
      {id === 'scene-fjord' && (
        <path
          d="M0 150 L70 70 L120 120 L190 40 L260 125 L320 80 L400 150 L400 0 L0 0Z"
          fill="#203640"
        />
      )}
      {id === 'scene-deep' &&
        [60, 150, 250, 330].map((x) => (
          <path
            key={x}
            d={`M${x} 0 L${x + 40} 0 L${x + 90} 400 L${x + 20} 400Z`}
            className={styles.ray}
          />
        ))}
      {(id === 'scene-midgard' || id === 'scene-deep') &&
        Array.from({ length: 28 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 137) % SIZE}
            cy={(i * 89) % SIZE}
            r={i % 4 ? 1 : 1.8}
            className={id === 'scene-deep' ? styles.bubble : styles.star}
          />
        ))}
    </g>
  );
}

function Aura({ id }: { id: string }) {
  const color = itemById(id)?.color;
  if (!color) return null;
  return (
    <g className={styles.aura}>
      <defs>
        <radialGradient id="aura">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={CENTER.x} cy={CENTER.y} r={175} fill="url(#aura)" />
      {id === 'aura-embers' &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <circle
            key={i}
            cx={110 + i * 36}
            cy={330}
            r={2.5}
            fill={EMBER}
            className={styles.ember}
            style={{ animationDelay: `${i * 0.7}s` }}
          />
        ))}
    </g>
  );
}

function Midgard() {
  return (
    <g>
      <circle cx={CENTER.x} cy={CENTER.y} r={WORLD_RADIUS} fill="#1d4e6b" />
      <path
        d={`M${CENTER.x - 50} ${CENTER.y - 30} q30 -40 70 -10 q20 30 -10 40 q-30 5 -40 30 q-30 -10 -20 -60Z M${CENTER.x + 20} ${CENTER.y + 30} q30 -10 45 10 q-5 30 -35 30 q-20 -15 -10 -40Z`}
        fill="#3f6b3a"
      />
      <circle
        cx={CENTER.x}
        cy={CENTER.y}
        r={WORLD_RADIUS}
        fill="none"
        stroke="#9cc7da"
        strokeOpacity={0.35}
        strokeWidth={3}
      />
    </g>
  );
}

function Egg({ cracked }: { cracked: boolean }) {
  return (
    <g className={styles.wobble}>
      <ellipse cx={CENTER.x} cy={CENTER.y + 10} rx={48} ry={62} fill="#cfd8c6" />
      <path
        d={`M${CENTER.x - 8} ${CENTER.y - 20} L${CENTER.x - 8} ${CENTER.y + 34} M${CENTER.x - 8} ${CENTER.y - 18} L${CENTER.x + 10} ${CENTER.y - 6}`}
        stroke={EMBER}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      {cracked && (
        <path
          d={`M${CENTER.x - 30} ${CENTER.y - 8} l10 8 l8 -10 l9 12 l10 -9`}
          stroke="#5b6450"
          strokeWidth={2}
          fill="none"
        />
      )}
    </g>
  );
}

function Head({
  width,
  equipped,
  stageIndex,
}: {
  width: number;
  equipped: Equipped;
  stageIndex: number;
}) {
  const skin = itemById(equipped.skin)?.color ?? '#3b4e51';
  const eye = stageIndex >= 3 ? EMBER : '#101410';
  return (
    <g transform={`scale(${(width / 20).toFixed(3)})`}>
      <path d="M22 0 L30 0 M30 0 L34 -3 M30 0 L34 3" className={styles.tongue} />
      <path d="M-8 -10 C4 -14 18 -9 23 0 C18 9 4 14 -8 10 Z" fill={skin} />
      <path d="M-4 -6 C6 -8 15 -5 19 0 C15 5 6 8 -4 6 Z" fill="#fff" opacity={0.08} />
      <g className={styles.eyes}>
        <circle cx={9} cy={-6.5} r={2.6} fill={eye} />
        <circle cx={9} cy={6.5} r={2.6} fill={eye} />
        <ellipse cx={9.4} cy={-6.5} rx={0.6} ry={1.8} fill="#000" />
        <ellipse cx={9.4} cy={6.5} rx={0.6} ry={1.8} fill="#000" />
      </g>
      {equipped.head === 'head-horns' && (
        <path
          d="M0 -9 C-6 -16 -14 -18 -20 -16 M0 9 C-6 16 -14 18 -20 16"
          stroke="#e9e1cf"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
        />
      )}
      {equipped.head === 'head-helm' && (
        <g>
          <path d="M-6 -9 C2 -11 8 -7 9 0 C8 7 2 11 -6 9 Z" fill="#8c8f94" />
          <path
            d="M-2 -10 C-4 -18 -10 -22 -14 -21 M-2 10 C-4 18 -10 22 -14 21"
            stroke="#efe6d2"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}
      {equipped.head === 'head-crown' && (
        <path
          d="M-6 -6 L-2 -3 L0 -8 L2 -3 L6 -6 L5 6 L-5 6 Z"
          fill="#d4a933"
          stroke="#8a6a12"
          strokeWidth={0.6}
          transform="rotate(90)"
        />
      )}
    </g>
  );
}

function Neck({ points, width, id }: { points: Point[]; width: number; id: string }) {
  if (id === 'neck-none') return null;
  const { point, angle } = backFromHead(points, width * 1.3);
  const t = `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) rotate(${angle.toFixed(1)})`;
  const h = width * 0.62;
  if (id === 'neck-scarf') {
    return (
      <g transform={t}>
        <rect x={-width * 0.22} y={-h} width={width * 0.44} height={h * 2} rx={3} fill="#9b2c2c" />
        <path
          d={`M0 ${h} q-${width * 0.5} ${width * 0.4} -${width * 1.1} ${width * 0.2}`}
          stroke="#9b2c2c"
          strokeWidth={width * 0.3}
          strokeLinecap="round"
          fill="none"
        />
      </g>
    );
  }
  if (id === 'neck-torc') {
    return (
      <g transform={t}>
        <rect x={-width * 0.12} y={-h} width={width * 0.24} height={h * 2} rx={2} fill="#d4a933" />
        <circle cx={0} cy={-h} r={width * 0.14} fill="#b8902f" />
        <circle cx={0} cy={h} r={width * 0.14} fill="#b8902f" />
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
          rx={width * 0.14}
          ry={width * 0.2}
          fill="none"
          stroke="#9aa0a6"
          strokeWidth={width * 0.07}
        />
      ))}
    </g>
  );
}

function Pattern({ d, width, id, skin }: { d: string; width: number; id: string; skin: string }) {
  const common = {
    d,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (id === 'pattern-bands') {
    return (
      <path
        {...common}
        strokeLinecap="butt"
        stroke={`color-mix(in srgb, ${skin} 55%, black)`}
        strokeWidth={width * 0.7}
        strokeDasharray={`${width * 0.3} ${width * 0.8}`}
      />
    );
  }
  if (id === 'pattern-spine') {
    return (
      <path
        {...common}
        stroke={`color-mix(in srgb, ${skin} 40%, white)`}
        strokeWidth={width * 0.24}
        strokeDasharray={`0.1 ${width * 0.75}`}
      />
    );
  }
  if (id === 'pattern-runes') {
    return (
      <path
        {...common}
        stroke={EMBER}
        strokeWidth={width * 0.1}
        strokeDasharray={`${width * 0.45} ${width * 0.3} ${width * 0.1} ${width * 0.9}`}
      />
    );
  }
  if (id === 'pattern-stars') {
    return (
      <path
        {...common}
        stroke="#f4f1e6"
        strokeOpacity={0.85}
        strokeWidth={width * 0.11}
        strokeDasharray={`0.1 ${width * 0.5} 0.1 ${width * 1.1}`}
      />
    );
  }
  return null;
}

/**
 * The serpent, drawn from parts for its level and outfit. Memoised: it only redraws when the
 * level or outfit changes, and its idle motion is CSS on transforms, which the compositor runs.
 */
export const Serpent = memo(function Serpent({ level, equipped, morsels = 0 }: SerpentProps) {
  const stage = stageFor(level);
  const body = useMemo(() => bodyFor(level), [level]);
  const pieces = useMemo(() => taperedPieces(body), [body]);
  const skin = itemById(equipped.skin)?.color ?? '#3b4e51';
  const zoom = useMemo(() => zoomFor(body), [body]);
  const rawHead = body.points[body.points.length - 1];
  // Where the head is on screen, after the zoom, for the morsels to fly to.
  const head = {
    x: CENTER.x + (rawHead.x - CENTER.x) * zoom,
    y: CENTER.y + (rawHead.y - CENTER.y) * zoom,
  };
  const front = useMemo(
    () => pathThrough(body.points.slice(Math.floor(body.points.length * 0.18), -2)),
    [body],
  );
  const stageIndex = [
    'egg',
    'hatchling',
    'snake',
    'serpent',
    'sea',
    'world',
    'jormungandr',
  ].indexOf(stage.id);

  return (
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
        <g className={styles.breathe}>
          <g
            transform={`translate(${CENTER.x} ${CENTER.y}) scale(${zoom.toFixed(3)}) translate(${-CENTER.x} ${-CENTER.y})`}
          >
            {body.world && <Midgard />}
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              {pieces.map((piece, i) => (
                <path
                  key={`s${i}`}
                  d={piece.d}
                  stroke={`color-mix(in srgb, ${skin} 70%, black)`}
                  strokeWidth={piece.width + 2}
                />
              ))}
              {pieces.map((piece, i) => (
                <path key={`b${i}`} d={piece.d} stroke={skin} strokeWidth={piece.width} />
              ))}
              {pieces.map((piece, i) => (
                <path
                  key={`h${i}`}
                  d={piece.d}
                  stroke="#fff"
                  strokeOpacity={0.12}
                  strokeWidth={piece.width * 0.3}
                  transform={`translate(${-piece.width * 0.12} ${-piece.width * 0.14})`}
                />
              ))}
            </g>
            <Pattern d={front} width={body.width} id={equipped.pattern} skin={skin} />
            <Neck points={body.points} width={body.width} id={equipped.neck} />
            <g
              transform={`translate(${rawHead.x.toFixed(1)} ${rawHead.y.toFixed(1)}) rotate(${body.angle.toFixed(1)})`}
            >
              <Head width={body.width} equipped={equipped} stageIndex={stageIndex} />
            </g>
          </g>
        </g>
      )}
      {Array.from({ length: Math.min(morsels, 8) }, (_, i) => (
        <circle
          key={i}
          cx={SIZE / 2}
          cy={SIZE + 10}
          r={5}
          className={styles.morsel}
          style={
            {
              '--dx': `${head.x - SIZE / 2}px`,
              '--dy': `${head.y - SIZE - 10}px`,
              animationDelay: `${i * 0.18}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </svg>
  );
});
