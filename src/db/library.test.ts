import { describe, expect, it } from 'vitest';
import { findRepeats, needsDetails, titleKey } from './library';

describe('needsDetails', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = 100 * day;

  it('fetches details never fetched before', () => {
    expect(needsDetails({}, now)).toBe(true);
  });

  it('skips details fetched this week', () => {
    expect(needsDetails({ detailsAt: now - 6 * day }, now)).toBe(false);
  });

  it('fetches them again after a week', () => {
    expect(needsDetails({ detailsAt: now - 7 * day }, now)).toBe(true);
  });
});

describe('findRepeats', () => {
  const chapter = (index: number, title: string) => ({ url: `c${index}`, index, title });

  it('matches titles that differ only in how "Chapter" and quotes are written', () => {
    expect(titleKey('CH1134 Delair’s Perspective')).toBe(
      titleKey("Chapter 1134 Delair's Perspective"),
    );
    expect(titleKey('Chapter 1134')).not.toBe(titleKey('Chapter 1135'));
    expect(titleKey('Epilogue')).toBeUndefined();
  });

  it('keeps the first copy of a run the site lists again', () => {
    const repeats = findRepeats([
      chapter(1, 'Chapter 1130'),
      chapter(2, 'CH1130'),
      chapter(3, 'CH1131'),
      chapter(4, 'Chapter 1131'),
      chapter(5, 'Chapter 1132'),
    ]);
    expect([...repeats]).toEqual([
      ['c2', 'c1'],
      ['c4', 'c3'],
    ]);
  });

  it('leaves titles without a number alone', () => {
    expect(findRepeats([chapter(1, 'Side Story'), chapter(2, 'Side Story')]).size).toBe(0);
  });
});
