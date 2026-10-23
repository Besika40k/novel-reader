import { describe, expect, it } from 'vitest';
import { earned, meetsRule, ruleHint, type Progress } from './catalog';
import { chaptersFor, growth, levelFor, stageFor } from './growth';

describe('growth', () => {
  it('levels up on a square curve', () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(2)).toBe(1);
    expect(levelFor(199)).toBe(9);
    expect(levelFor(200)).toBe(10);
    expect(chaptersFor(60)).toBe(7200);
  });

  it('finds the stage', () => {
    expect(stageFor(0).id).toBe('egg');
    expect(stageFor(17).id).toBe('snake');
    expect(stageFor(36).id).toBe('sea');
    expect(stageFor(99).id).toBe('jormungandr');
  });

  it('reports progress through a level', () => {
    const g = growth(2700);
    expect(g.level).toBe(36);
    expect(g.next?.id).toBe('world');
    expect(g.toNextLevel).toBe(chaptersFor(37) - 2700);
    expect(g.levelProgress).toBeGreaterThan(0);
    expect(g.levelProgress).toBeLessThan(1);
  });
});

describe('catalog', () => {
  const progress: Progress = {
    level: 20,
    longestStreak: 9,
    finishedNovels: 1,
    mostInOneNovel: 800,
    genres: 4,
  };

  it('unlocks by stage, streak, novels and genres', () => {
    const ids = earned(progress);
    expect(ids).toContain('head-horns');
    expect(ids).toContain('neck-scarf');
    expect(ids).toContain('head-helm');
    expect(ids).toContain('neck-torc');
    expect(ids).not.toContain('head-crown');
    expect(ids).not.toContain('skin-venom');
    expect(ids).not.toContain('scene-deep');
  });

  it('describes rules', () => {
    expect(ruleHint({ stage: 'sea' })).toBe('Grow into a Sea serpent');
    expect(ruleHint({ finishedNovels: 1 })).toBe('Finish 1 novel');
    expect(meetsRule({ streak: 10 }, progress)).toBe(false);
  });
});
