import type { FilterSort, NovelFilter } from '@/sources/types';

/** The choices the filter sheet offers, and what it starts from. */

export const NO_FILTER: NovelFilter = {
  genres: [],
  tags: [],
  minRating: 0,
  status: 'all',
  sort: 'monthly-views',
};

export const RATINGS = [
  { value: 0, name: 'Any' },
  { value: 3, name: '3+' },
  { value: 4, name: '4+' },
  { value: 5, name: '5' },
];

export const STATUSES: { value: NovelFilter['status']; name: string }[] = [
  { value: 'all', name: 'All' },
  { value: 'ongoing', name: 'Ongoing' },
  { value: 'completed', name: 'Completed' },
];

export const SORTS: { value: FilterSort; name: string }[] = [
  { value: 'monthly-views', name: 'Monthly views' },
  { value: 'total-views', name: 'Total views' },
  { value: 'rating', name: 'Rating' },
  { value: 'rank', name: 'Rank' },
  { value: 'updated', name: 'Last updated' },
];
