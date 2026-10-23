import { describe, expect, it } from 'vitest';
import type { DayStats } from '@/db/db';
import { countWords } from '@/db/stats';
import {
  formatCount,
  formatDuration,
  genreShares,
  lastDays,
  shiftDay,
  streaks,
} from './statsSummary';

describe('shiftDay', () => {
  it('crosses months and years', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('streaks', () => {
  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-11'];

  it('counts the current streak through yesterday when today has no reading yet', () => {
    expect(streaks(days, '2026-10-12')).toEqual({ current: 2, longest: 3 });
  });

  it('ends the current streak after a missed day', () => {
    expect(streaks(days, '2026-10-13')).toEqual({ current: 0, longest: 3 });
  });

  it('handles no reading', () => {
    expect(streaks([], '2026-10-13')).toEqual({ current: 0, longest: 0 });
  });
});

describe('lastDays', () => {
  const row = (day: string, chapters: number, seconds: number): DayStats => ({
    id: `${day}|n`,
    novelId: 'n',
    day,
    chapters,
    seconds,
    words: 0,
  });

  it('fills empty days and adds novels together', () => {
    const rows = [row('2026-10-13', 2, 600), row('2026-10-13', 1, 60), row('2026-10-01', 9, 9)];
    expect(lastDays(rows, 3, '2026-10-13')).toEqual([
      { day: '2026-10-11', chapters: 0, seconds: 0 },
      { day: '2026-10-12', chapters: 0, seconds: 0 },
      { day: '2026-10-13', chapters: 3, seconds: 660 },
    ]);
  });
});

describe('genreShares', () => {
  it('weights genres by chapters read', () => {
    const shares = genreShares(
      [
        { genres: ['Fantasy', 'Action'], read: 30 },
        { genres: ['Fantasy'], read: 10 },
        { genres: ['Romance'], read: 0 },
      ],
      5,
    );
    expect(shares.map((s) => s.genre)).toEqual(['Fantasy', 'Action']);
    expect(shares[0].share).toBeCloseTo(40 / 70);
  });
});

describe('formatting', () => {
  it.each([
    [0, '0 min'],
    [20, '<1 min'],
    [45 * 60, '45 min'],
    [3 * 3600, '3 h'],
    [3 * 3600 + 20 * 60, '3 h 20 min'],
  ])('formats %d seconds', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });

  it.each([
    [980, '980'],
    [2696, '2,696'],
    [312_450, '312,450'],
    [1_340_000, '1.3M'],
  ])('formats %d', (value, text) => {
    expect(formatCount(value)).toBe(text);
  });
});

describe('countWords', () => {
  it('counts words in inline markup', () => {
    expect(countWords(['<b>Hello</b> there, friend.', '', 'A &amp; B'])).toBe(6);
  });
});
