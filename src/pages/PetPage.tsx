import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '@/components/TopBar';
import { growth, levelFor } from '@/pet/growth';
import { Serpent } from '@/pet/Serpent';
import { ensurePet, feedPet, petState } from '@/pet/store';
import styles from './PetPage.module.scss';

/** How long the morsels fly before the meal is reported and saved. */
const MEAL_MS = 1800;

interface Meal {
  eaten: number;
  from: number;
  to: number;
  firstVisit: boolean;
}

export function PetPage() {
  const state = useLiveQuery(() => petState(), []);
  const [meal, setMeal] = useState<Meal>();

  useEffect(() => {
    void ensurePet();
  }, []);

  const eaten = state ? state.food - state.pet.lastSeenChapters : 0;
  const newly = state?.newlyEarned.length ?? 0;

  // Chapters read since the last visit fly into its mouth; then the meal is reported and saved.
  useEffect(() => {
    if (!state || (eaten <= 0 && newly === 0)) return;
    const timer = setTimeout(
      () => {
        setMeal({
          eaten,
          from: levelFor(state.pet.lastSeenChapters),
          to: levelFor(state.food),
          firstVisit: state.pet.unlocked.length === 0,
        });
        void feedPet(state.food, state.newlyEarned);
      },
      eaten > 0 ? MEAL_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [state, eaten, newly]);

  if (!state) return <TopBar display title="Serpent" rune="eihwaz" />;

  const g = growth(state.food);

  return (
    <>
      <TopBar display title={state.pet.name} rune="eihwaz" />
      <div className={styles.page}>
        <div className={styles.stage}>
          <Serpent level={g.level} morsels={eaten} />
        </div>

        <div className={styles.status}>
          <p className={styles.stageName}>
            {g.stage.name} <span className={styles.level}>level {g.level}</span>
          </p>
          <div className={styles.bar} aria-hidden>
            <span style={{ width: `${Math.round(g.levelProgress * 100)}%` }} />
          </div>
          <p className={styles.hint}>
            {g.toNextLevel} chapter{g.toNextLevel === 1 ? '' : 's'} to level {g.level + 1}
            {g.next && ` · becomes a ${g.next.name} at level ${g.next.level}`}
          </p>
          <p className={styles.blurb}>{g.stage.blurb}</p>
        </div>

        {meal && (
          <div className={styles.meal} role="status">
            {meal.firstVisit ? (
              <p>
                It hatched and gulped down the {state.food} chapters you'd already read, growing
                straight into a {g.stage.name}.
              </p>
            ) : (
              meal.eaten > 0 && (
                <p>
                  Ate {meal.eaten} chapter{meal.eaten === 1 ? '' : 's'} since your last visit
                  {meal.to > meal.from ? ` and grew to level ${meal.to}` : ''}.
                </p>
              )
            )}
          </div>
        )}

        <dl className={styles.facts}>
          <div>
            <dt>Chapters eaten</dt>
            <dd>{state.food}</dd>
          </div>
          <div>
            <dt>Longest streak</dt>
            <dd>{state.progress.longestStreak} days</dd>
          </div>
          <div>
            <dt>Novels finished</dt>
            <dd>{state.progress.finishedNovels}</dd>
          </div>
        </dl>
        <p className={styles.note}>
          It eats every chapter you finish in the reader. Marking chapters read by hand doesn't feed
          it.
        </p>
      </div>
    </>
  );
}
