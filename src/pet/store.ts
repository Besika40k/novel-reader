import { db, localDay } from '@/db/db';
import { readingStats } from '@/db/stats';
import { genreShares, streaks } from '@/lib/statsSummary';
import { DEFAULT_EQUIPPED, earned, type Equipped, type Progress, type Slot } from './catalog';
import { levelFor } from './growth';

/** The serpent: one row, id 'me'. Its food is chapters finished in the reader. */
export interface Pet {
  id: 'me';
  name: string;
  /** Chapters read before it hatched (all marked read, minus those already in `stats`). */
  baseChapters: number;
  /** Food the Pet tab has already shown being eaten. */
  lastSeenChapters: number;
  hatchedAt: number;
  /** Items earned so far; they stay earned. */
  unlocked: string[];
  equipped: Equipped;
}

/** Chapters finished in the reader since statistics began (0.7.0). */
async function fedChapters(): Promise<number> {
  let total = 0;
  await db.stats.each((row) => {
    total += row.chapters;
  });
  return total;
}

/**
 * Creates the serpent the first time the Pet tab opens, starting at the size the library has
 * earned so far, so the first visit doesn't replay years of reading.
 */
export async function ensurePet(): Promise<void> {
  await db.transaction('rw', db.pet, db.chapters, db.stats, async () => {
    if (await db.pet.get('me')) return;
    const read = await db.chapters.filter((chapter) => chapter.read === 1).count();
    const fed = await fedChapters();
    const base = Math.max(0, read - fed);
    await db.pet.put({
      id: 'me',
      name: 'Jormungandr',
      baseChapters: base,
      lastSeenChapters: base + fed,
      hatchedAt: Date.now(),
      unlocked: [],
      equipped: DEFAULT_EQUIPPED,
    });
  });
}

export interface PetState {
  pet: Pet;
  /** Everything it has eaten: chapters before hatching plus chapters finished since. */
  food: number;
  progress: Progress;
  /** Items earned by now that weren't before this visit. */
  newlyEarned: string[];
}

/** What the Pet tab shows. Read-only, so it can run in a live query. */
export async function petState(): Promise<PetState | undefined> {
  const pet = await db.pet.get('me');
  if (!pet) return undefined;
  const [fed, stats] = await Promise.all([fedChapters(), readingStats()]);
  const food = pet.baseChapters + fed;
  const day = localDay(Date.now());
  const progress: Progress = {
    level: levelFor(food),
    longestStreak: streaks(stats.days, day).longest,
    finishedNovels: stats.novels.filter((n) => n.total > 0 && n.read === n.total).length,
    mostInOneNovel: Math.max(0, ...stats.novels.map((n) => n.read)),
    genres: genreShares(
      stats.novels.map((n) => ({ genres: n.novel.genres, read: n.read })),
      Infinity,
    ).length,
  };
  const known = new Set(pet.unlocked);
  return {
    pet,
    food,
    progress,
    newlyEarned: earned(progress).filter((id) => !known.has(id)),
  };
}

/** Marks the food as eaten and the new items as earned, after the tab has shown them. */
export async function feedPet(food: number, newlyEarned: string[]): Promise<void> {
  await db.pet
    .where('id')
    .equals('me')
    .modify((pet) => {
      pet.lastSeenChapters = food;
      pet.unlocked = [...new Set([...pet.unlocked, ...newlyEarned])];
    });
}

export async function equip(slot: Slot, id: string): Promise<void> {
  await db.pet
    .where('id')
    .equals('me')
    .modify((pet) => {
      pet.equipped = { ...pet.equipped, [slot]: id };
    });
}

export async function renamePet(name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 40);
  if (trimmed) await db.pet.update('me', { name: trimmed });
}
