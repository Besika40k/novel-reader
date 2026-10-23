/** How the serpent grows with chapters read. See docs/jormungandr-pet.md. */

export type StageId = 'egg' | 'hatchling' | 'snake' | 'serpent' | 'sea' | 'world' | 'jormungandr';

export interface Stage {
  id: StageId;
  name: string;
  /** The level the stage starts at. */
  level: number;
  blurb: string;
}

export const STAGES: readonly Stage[] = [
  { id: 'egg', name: 'Egg', level: 0, blurb: 'Something stirs inside. Read to hatch it.' },
  { id: 'hatchling', name: 'Hatchling', level: 1, blurb: 'Tiny, hungry and curious.' },
  { id: 'snake', name: 'Snake', level: 8, blurb: 'Quick and growing fast on stories.' },
  { id: 'serpent', name: 'Serpent', level: 18, blurb: 'Thick coils and the first horns.' },
  { id: 'sea', name: 'Sea serpent', level: 30, blurb: 'Too big for land; the deep calls.' },
  { id: 'world', name: 'World Serpent', level: 45, blurb: 'Its coils reach around Midgard.' },
  {
    id: 'jormungandr',
    name: 'Jormungandr',
    level: 60,
    blurb: 'The ring is closed. The world is held.',
  },
];

/** Level from chapters read: level 10 is 200 chapters, 30 is 1,800, 60 is 7,200. */
export function levelFor(chapters: number): number {
  return Math.floor(Math.sqrt(Math.max(0, chapters) / 2));
}

/** Chapters needed to reach a level. */
export function chaptersFor(level: number): number {
  return 2 * level * level;
}

export function stageFor(level: number): Stage {
  let stage = STAGES[0];
  for (const candidate of STAGES) if (level >= candidate.level) stage = candidate;
  return stage;
}

export function nextStage(level: number): Stage | undefined {
  return STAGES.find((stage) => stage.level > level);
}

export function stageIndex(id: StageId): number {
  return STAGES.findIndex((stage) => stage.id === id);
}

/** Where the serpent is: level, stage, and how far through the current level (0–1). */
export function growth(chapters: number) {
  const level = levelFor(chapters);
  const from = chaptersFor(level);
  const to = chaptersFor(level + 1);
  return {
    level,
    stage: stageFor(level),
    next: nextStage(level),
    levelProgress: (chapters - from) / (to - from),
    toNextLevel: to - chapters,
  };
}
