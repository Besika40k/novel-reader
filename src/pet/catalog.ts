import { stageIndex, STAGES, type StageId } from './growth';

export type Slot = 'skin' | 'pattern' | 'head' | 'neck' | 'aura' | 'scene';

/** What earns an item. Items stay unlocked once earned. */
export type Rule =
  | { stage: StageId }
  | { streak: number }
  | { finishedNovels: number }
  | { novelChapters: number }
  | { genres: number };

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  rule: Rule;
  /** Skin colours, scene and aura tints. */
  color?: string;
}

/** What the unlock rules look at, gathered on the Pet tab only. */
export interface Progress {
  level: number;
  longestStreak: number;
  finishedNovels: number;
  /** Most chapters read in one novel. */
  mostInOneNovel: number;
  /** Genres among novels with chapters read. */
  genres: number;
}

const hatch = { stage: 'hatchling' } as const;

export const CATALOG: readonly Item[] = [
  // Skins, mostly from the app's palette.
  { id: 'skin-bone', slot: 'skin', name: 'Bone', rule: hatch, color: '#eedcb6' },
  { id: 'skin-slate', slot: 'skin', name: 'Slate', rule: hatch, color: '#5d7376' },
  { id: 'skin-sage', slot: 'skin', name: 'Sage', rule: hatch, color: '#8aa3a6' },
  { id: 'skin-rose', slot: 'skin', name: 'Rose', rule: { stage: 'snake' }, color: '#b8938f' },
  { id: 'skin-abyss', slot: 'skin', name: 'Abyss', rule: { stage: 'serpent' }, color: '#1c261a' },
  { id: 'skin-venom', slot: 'skin', name: 'Venom', rule: { genres: 5 }, color: '#4f7a3a' },
  { id: 'skin-ice', slot: 'skin', name: 'Ice', rule: { stage: 'sea' }, color: '#cfe0e3' },
  { id: 'skin-midnight', slot: 'skin', name: 'Midnight', rule: { streak: 30 }, color: '#16233a' },
  {
    id: 'skin-gold',
    slot: 'skin',
    name: 'Hoard gold',
    rule: { stage: 'jormungandr' },
    color: '#b8902f',
  },
  // Patterns along the back.
  { id: 'pattern-plain', slot: 'pattern', name: 'Plain', rule: hatch },
  { id: 'pattern-bands', slot: 'pattern', name: 'Bands', rule: { stage: 'snake' } },
  { id: 'pattern-spine', slot: 'pattern', name: 'Spine dots', rule: { novelChapters: 100 } },
  { id: 'pattern-runes', slot: 'pattern', name: 'Ember runes', rule: { stage: 'serpent' } },
  { id: 'pattern-stars', slot: 'pattern', name: 'Starfield', rule: { stage: 'world' } },
  // Head and neck.
  { id: 'head-none', slot: 'head', name: 'Nothing', rule: hatch },
  { id: 'head-horns', slot: 'head', name: 'Horns', rule: { stage: 'serpent' } },
  { id: 'head-helm', slot: 'head', name: 'Viking helm', rule: { finishedNovels: 1 } },
  { id: 'head-crown', slot: 'head', name: 'Crown', rule: { finishedNovels: 3 } },
  { id: 'neck-none', slot: 'neck', name: 'Nothing', rule: hatch },
  { id: 'neck-scarf', slot: 'neck', name: 'Scarf', rule: { streak: 7 } },
  { id: 'neck-torc', slot: 'neck', name: 'Golden torc', rule: { novelChapters: 500 } },
  { id: 'neck-chain', slot: 'neck', name: 'Chain of Fenrir', rule: { streak: 60 } },
  // Auras and scenes.
  { id: 'aura-none', slot: 'aura', name: 'Nothing', rule: hatch },
  { id: 'aura-mist', slot: 'aura', name: 'Mist', rule: { stage: 'snake' }, color: '#e9f1f2' },
  { id: 'aura-embers', slot: 'aura', name: 'Embers', rule: { streak: 14 }, color: '#e67e22' },
  {
    id: 'aura-aurora',
    slot: 'aura',
    name: 'Northern lights',
    rule: { stage: 'world' },
    color: '#5fd3a6',
  },
  { id: 'scene-forest', slot: 'scene', name: 'Forest floor', rule: hatch, color: '#8fa08b' },
  { id: 'scene-cave', slot: 'scene', name: 'Cave', rule: { stage: 'snake' }, color: '#9b9286' },
  { id: 'scene-fjord', slot: 'scene', name: 'Fjord', rule: { stage: 'serpent' }, color: '#8da3ab' },
  { id: 'scene-deep', slot: 'scene', name: 'Deep sea', rule: { stage: 'sea' }, color: '#6e8c98' },
  {
    id: 'scene-midgard',
    slot: 'scene',
    name: 'Midgard',
    rule: { stage: 'world' },
    color: '#7f95a1',
  },
];

export const SLOTS: { slot: Slot; name: string }[] = [
  { slot: 'skin', name: 'Skin' },
  { slot: 'pattern', name: 'Pattern' },
  { slot: 'head', name: 'Head' },
  { slot: 'neck', name: 'Neck' },
  { slot: 'aura', name: 'Aura' },
  { slot: 'scene', name: 'Scene' },
];

export type Equipped = Record<Slot, string>;

export const DEFAULT_EQUIPPED: Equipped = {
  skin: 'skin-bone',
  pattern: 'pattern-plain',
  head: 'head-none',
  neck: 'neck-none',
  aura: 'aura-none',
  scene: 'scene-forest',
};

export function itemById(id: string): Item | undefined {
  return CATALOG.find((item) => item.id === id);
}

export function meetsRule(rule: Rule, progress: Progress): boolean {
  if ('stage' in rule) return progress.level >= STAGES[stageIndex(rule.stage)].level;
  if ('streak' in rule) return progress.longestStreak >= rule.streak;
  if ('finishedNovels' in rule) return progress.finishedNovels >= rule.finishedNovels;
  if ('novelChapters' in rule) return progress.mostInOneNovel >= rule.novelChapters;
  return progress.genres >= rule.genres;
}

/** Items earned by now, as ids. */
export function earned(progress: Progress): string[] {
  return CATALOG.filter((item) => meetsRule(item.rule, progress)).map((item) => item.id);
}

/** How to earn an item, for the wardrobe. */
export function ruleHint(rule: Rule): string {
  if ('stage' in rule) return `Grow into a ${STAGES[stageIndex(rule.stage)].name}`;
  if ('streak' in rule) return `Read ${rule.streak} days in a row`;
  if ('finishedNovels' in rule) {
    return `Finish ${rule.finishedNovels} novel${rule.finishedNovels === 1 ? '' : 's'}`;
  }
  if ('novelChapters' in rule) return `Read ${rule.novelChapters} chapters of one novel`;
  return `Read novels from ${rule.genres} genres`;
}
