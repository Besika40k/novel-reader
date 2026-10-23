import type { DayStats } from '@/db/db';
import { formatNumber } from './format';

/** The local date `offset` days from a YYYY-MM-DD date, as YYYY-MM-DD. */
export function shiftDay(day: string, offset: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const shifted = new Date(year, month - 1, date + offset);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

/**
 * Reading streaks over the days read: the current one (ending today, or yesterday if today has
 * no reading yet) and the longest.
 */
export function streaks(
  days: Iterable<string>,
  today: string,
): { current: number; longest: number } {
  const read = new Set(days);
  let longest = 0;
  for (const day of read) {
    if (read.has(shiftDay(day, -1))) continue;
    let length = 1;
    while (read.has(shiftDay(day, length))) length += 1;
    longest = Math.max(longest, length);
  }
  let end = read.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (read.has(end)) {
    current += 1;
    end = shiftDay(end, -1);
  }
  return { current, longest };
}

export interface DayTotal {
  day: string;
  chapters: number;
  seconds: number;
}

/** Totals for each of the last `count` days, oldest first, with empty days included. */
export function lastDays(rows: readonly DayStats[], count: number, today: string): DayTotal[] {
  const totals = new Map<string, DayTotal>();
  for (let i = count - 1; i >= 0; i -= 1) {
    const day = shiftDay(today, -i);
    totals.set(day, { day, chapters: 0, seconds: 0 });
  }
  for (const row of rows) {
    const total = totals.get(row.day);
    if (!total) continue;
    total.chapters += row.chapters;
    total.seconds += row.seconds;
  }
  return [...totals.values()];
}

/** Genres weighted by chapters read in each novel, largest first, as shares of the whole. */
export function genreShares(
  novels: readonly { genres: readonly string[]; read: number }[],
  limit: number,
): { genre: string; share: number }[] {
  const weights = new Map<string, number>();
  let total = 0;
  for (const novel of novels) {
    if (!novel.read) continue;
    for (const genre of novel.genres) {
      weights.set(genre, (weights.get(genre) ?? 0) + novel.read);
      total += novel.read;
    }
  }
  return [...weights]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre, weight]) => ({ genre, share: weight / total }));
}

/** "3 h 20 min", "45 min", "<1 min". */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return seconds > 0 ? '<1 min' : '0 min';
  const hours = Math.floor(minutes / 60);
  if (!hours) return `${minutes} min`;
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

/** Full numbers like the rest of the app ("312,450"), compact only from a million: "1.3M". */
export function formatCount(value: number): string {
  if (value < 1_000_000) return formatNumber(value);
  return `${(value / 1_000_000).toFixed(1)}M`;
}
