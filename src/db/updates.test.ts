import { describe, expect, it } from 'vitest';
import type { Chapter, Novel } from './db';
import { groupUpdates, type Update } from './updates';

const novel = (id: string) => ({ id, title: id }) as Novel;
const chapter = (novelId: string, index: number, foundAt: number) =>
  ({ url: `${novelId}/${index}`, novelId, index, foundAt }) as Chapter;
const update = (novelId: string, index: number, foundAt: number): Update => ({
  chapter: chapter(novelId, index, foundAt),
  novel: novel(novelId),
});

describe('groupUpdates', () => {
  const dayOf = (time: number) => (time >= 100 ? 'today' : 'yesterday');

  it('groups by day, then novel, newest chapters first', () => {
    const groups = groupUpdates(
      [update('a', 5, 150), update('b', 9, 150), update('a', 6, 150), update('a', 4, 50)],
      dayOf,
    );
    expect(groups.map((g) => [g.day, g.novel.id, g.chapters.map((c) => c.index)])).toEqual([
      ['today', 'a', [6, 5]],
      ['today', 'b', [9]],
      ['yesterday', 'a', [4]],
    ]);
  });
});
