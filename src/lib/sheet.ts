import { CELL, inlineToText } from './inline';

/** A line of a status sheet: a section heading, a label with its value, or plain text. */
export type SheetLine =
  | { kind: 'heading'; markup: string }
  | { kind: 'value'; label: string; value: string }
  | { kind: 'text'; markup: string };

const BOLD_CELL = /^<b>([^<]*)<\/b>$/;
// "Path of Exceptionalism I (20/100)": progress at the end of a line reads as its value.
const PROGRESS = /^(.+?)\s*(\(\d+\s*\/\s*\d+\))$/;

function line(cell: string): SheetLine {
  const bold = BOLD_CELL.exec(cell);
  const markup = (bold?.[1] ?? cell).trim();
  const dash = markup.indexOf(' - ');
  if (dash > 0) {
    return { kind: 'value', label: markup.slice(0, dash), value: markup.slice(dash + 3) };
  }
  if (bold) return { kind: 'heading', markup };
  const progress = PROGRESS.exec(markup);
  if (progress) return { kind: 'value', label: progress[1], value: progress[2] };
  return { kind: 'text', markup };
}

/**
 * A table paragraph (src/lib/inline.ts) as one column of lines: each column of the table in turn,
 * top to bottom, without the empty cells that only kept the site's two columns aligned.
 */
export function sheetLines(markup: string): SheetLine[] {
  const rows = markup.split('\n').map((row) => row.split(CELL));
  const columns = Math.max(...rows.map((cells) => cells.length));
  return Array.from({ length: columns }, (_, column) => rows.map((cells) => cells[column] ?? ''))
    .flat()
    .filter((cell) => inlineToText(cell).trim())
    .map(line);
}
