import { describe, expect, it } from 'vitest';
import { needsDetails } from './library';

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
