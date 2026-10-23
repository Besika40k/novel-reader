const grouped = new Intl.NumberFormat('en-GB');

/** A count as the app writes it everywhere: "2,696". */
export function formatNumber(value: number): string {
  return grouped.format(value);
}

/** "1 chapter", "2,696 chapters". */
export function plural(count: number, word: string): string {
  return `${formatNumber(count)} ${word}${count === 1 ? '' : 's'}`;
}
