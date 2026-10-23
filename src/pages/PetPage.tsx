import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Lock, Shirt } from 'lucide-react';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { TopBar } from '@/components/TopBar';
import { CATALOG, itemById, ruleHint, SLOTS, type Slot } from '@/pet/catalog';
import { growth, levelFor } from '@/pet/growth';
import { Serpent } from '@/pet/Serpent';
import { ensurePet, equip, feedPet, petState, renamePet, type PetState } from '@/pet/store';
import styles from './PetPage.module.scss';

/** How long the morsels fly before the meal is reported and saved. */
const MEAL_MS = 1800;

interface Meal {
  eaten: number;
  from: number;
  to: number;
  items: string[];
  firstVisit: boolean;
}

function Wardrobe({ state, onClose }: { state: PetState; onClose: () => void }) {
  const { pet } = state;
  const [name, setName] = useState(pet.name);
  const owned = new Set([...pet.unlocked, ...state.newlyEarned]);
  return (
    <div className={styles.wardrobe}>
      <label className={styles.nameField}>
        Name
        <input
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => void renamePet(name)}
        />
      </label>
      {SLOTS.map(({ slot, name: slotName }) => (
        <section key={slot} className={styles.slot}>
          <h3 className={styles.slotName}>{slotName}</h3>
          <div className={styles.items}>
            {CATALOG.filter((item) => item.slot === slot).map((item) => {
              const has = owned.has(item.id);
              const on = pet.equipped[slot as Slot] === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={styles.item}
                  aria-pressed={on}
                  disabled={!has}
                  title={has ? item.name : ruleHint(item.rule)}
                  onClick={() => void equip(slot, item.id)}
                >
                  {item.color && (
                    <span className={styles.swatch} style={{ background: item.color }} />
                  )}
                  {!has && <Lock aria-hidden className={styles.lock} />}
                  <span className={styles.itemText}>
                    {item.name}
                    {!has && <span className={styles.itemHint}>{ruleHint(item.rule)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <Button block onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

export function PetPage() {
  const state = useLiveQuery(() => petState(), []);
  const [meal, setMeal] = useState<Meal>();
  const [wardrobe, setWardrobe] = useState(false);

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
          items: state.newlyEarned,
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
      <TopBar
        display
        title={state.pet.name}
        rune="eihwaz"
        actions={
          <Button icon={<Shirt />} onClick={() => setWardrobe(true)}>
            Wardrobe
          </Button>
        }
      />
      <div className={styles.page}>
        <div className={styles.stage}>
          <Serpent level={g.level} equipped={state.pet.equipped} morsels={eaten} />
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
            {meal.items.length > 0 && (
              <p>
                New in the wardrobe:{' '}
                {meal.items
                  .map((id) => itemById(id)?.name)
                  .filter((name) => name && name !== 'Nothing')
                  .join(', ')}
                .
              </p>
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

      <Sheet open={wardrobe} onClose={() => setWardrobe(false)} title="Wardrobe">
        {wardrobe && <Wardrobe state={state} onClose={() => setWardrobe(false)} />}
      </Sheet>
    </>
  );
}
