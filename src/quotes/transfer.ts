import { inlineToText } from '@/lib/inline';
import type { Paragraph } from '@/lib/junk';
import { acceptFix } from './rules';

const QUOTE = /["“”„'‘’]/;
// What can follow a closing quote: `Hi".`, `Hi"—`, `players' items`.
const CLOSE_BEFORE = /[\s.,;:!?)\]}…—–-]/;
const DASH = /[-–—]/;
// A short paragraph ("Yes.") appears many times in a chapter, so it only counts as found close
// to where the previous paragraph was.
const SHORT = 25;
const SHORT_REACH = 300;
// A paragraph the original words a little differently still counts when this share of its
// letters line up, within a stretch of the original that isn't much longer.
const SIMILAR = 0.85;
const MAX_WINDOW = 5000;

/** A visible character of the original text, with the quotation marks around it. */
interface OriginalChar {
  char: string;
  /** Lower-case letter or digit; empty for punctuation. Paragraphs are located by these. */
  key: string;
  /** Opening marks just before it. */
  before: string;
  /** Closing marks (and apostrophes) just after it. */
  after: string;
  /** The first visible character of one of the original's paragraphs. */
  starts: boolean;
  /** Whitespace or a paragraph break comes before it. */
  spaced: boolean;
}

/** A visible character of the copy, pointing at the markup token it came from. */
interface CopyChar {
  char: string;
  key: string;
  token: number;
}

interface Copy extends Paragraph {
  tokens: string[];
  chars: CopyChar[];
  keys: string;
}

/** Where a copy paragraph sits in the original: a stretch, and its characters' partners. */
interface Placement {
  start: number;
  end: number;
  /** Original character → copy character. */
  pairs: Map<number, number>;
}

function keyOf(char: string): string {
  return /[\p{L}\p{N}]/u.test(char) ? char.toLowerCase()[0] : '';
}

function straight(marks: string): string {
  return marks.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'");
}

function same(a: string, b: string): boolean {
  return a === b || (DASH.test(a) && DASH.test(b)) || a.toLowerCase() === b.toLowerCase();
}

/** Visible characters with each run of quotation marks attached to its neighbour. */
function readOriginal(paragraphs: readonly string[]): OriginalChar[] {
  const chars: OriginalChar[] = [];
  for (const paragraph of paragraphs) {
    // "…" is three dots in most copies.
    const text = paragraph.replace(/…/g, '...');
    let pending = '';
    let starts = true;
    let spaced = true;
    for (let i = 0; i < text.length;) {
      if (QUOTE.test(text[i])) {
        let end = i;
        while (end < text.length && QUOTE.test(text[end])) end += 1;
        const marks = straight(text.slice(i, end));
        const previous = text[i - 1];
        const next = text[end];
        const closes =
          previous !== undefined &&
          !/\s/.test(previous) &&
          (next === undefined || CLOSE_BEFORE.test(next));
        if (closes && !starts) chars[chars.length - 1].after += marks;
        else pending += marks;
        i = end;
        continue;
      }
      if (!/\s/.test(text[i])) {
        chars.push({
          char: text[i],
          key: keyOf(text[i]),
          before: pending,
          after: '',
          starts,
          spaced,
        });
        pending = '';
        starts = false;
        spaced = false;
      } else {
        spaced = true;
      }
      i += 1;
    }
    if (pending && !starts) chars[chars.length - 1].after += pending;
  }
  return chars;
}

/** The copy's markup as tokens (tags, escaped characters, characters) and its visible characters. */
function readCopy({ index, markup }: Paragraph): Copy {
  const tokens = markup.match(/<\/?[bi]>|&(?:amp|lt|gt);|[\s\S]/g) ?? [];
  const chars: CopyChar[] = [];
  tokens.forEach((token, i) => {
    if (token.length > 1 && token.startsWith('<')) return;
    const text = inlineToText(token);
    if (/\s/.test(text) || QUOTE.test(text)) return;
    for (const char of text === '…' ? '...' : text)
      chars.push({ char, key: keyOf(char), token: i });
  });
  return { index, markup, tokens, chars, keys: chars.map((char) => char.key).join('') };
}

/** Widens a stretch of the original over the punctuation around it, within its paragraph. */
function widen(
  source: OriginalChar[],
  start: number,
  end: number,
  floor: number,
): [number, number] {
  while (start - 1 >= floor && !source[start - 1].key && !source[start].starts) start -= 1;
  while (end + 1 < source.length && !source[end + 1].key && !source[end + 1].starts) end += 1;
  return [start, end];
}

/** Partners in a stretch with the same letters: punctuation only one side has is skipped. */
function pairExact(copy: Copy, source: OriginalChar[], start: number, end: number): Placement {
  const pairs = new Map<number, number>();
  let a = 0;
  for (let b = start; b <= end; b += 1) {
    const { chars } = copy;
    while (a < chars.length && !chars[a].key && !same(chars[a].char, source[b].char)) a += 1;
    if (a < chars.length && same(chars[a].char, source[b].char)) pairs.set(b, a++);
  }
  return { start, end, pairs };
}

/**
 * Partners for a paragraph the original words a little differently, found by aligning it with
 * a window of the original (longest common subsequence), or undefined when they're too unlike.
 */
function pairSimilar(
  copy: Copy,
  source: OriginalChar[],
  low: number,
  high: number,
): Placement | undefined {
  const n = copy.chars.length;
  const m = high - low + 1;
  if (m <= 0 || m > MAX_WINDOW) return undefined;
  const width = m + 1;
  const table = new Uint16Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] = same(copy.chars[i].char, source[low + j].char)
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  let found: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (
      same(copy.chars[i].char, source[low + j].char) &&
      table[i * width + j] === table[(i + 1) * width + j + 1] + 1
    ) {
      found.push([low + j, i]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) i += 1;
    else j += 1;
  }
  // Stray partners far from the rest are chance matches with neighbouring text.
  while (found.length > 1 && found[1][0] - found[0][0] > 10) found = found.slice(1);
  while (found.length > 1 && found.at(-1)![0] - found.at(-2)![0] > 10) found = found.slice(0, -1);
  if (!found.length) return undefined;

  const pairedKeys = found.filter(([, a]) => copy.chars[a].key).length;
  let spanKeys = 0;
  for (let b = found[0][0]; b <= found.at(-1)![0]; b += 1) if (source[b].key) spanKeys += 1;
  if (pairedKeys < copy.keys.length * SIMILAR || spanKeys * SIMILAR > copy.keys.length) {
    return undefined;
  }
  const [start, end] = widen(source, found[0][0], found.at(-1)![0], low);
  return { start, end: Math.min(end, high), pairs: new Map(found) };
}

/** The copy's markup with its own marks replaced by the original's. */
function applyMarks(copy: Copy, source: OriginalChar[], { start, end, pairs }: Placement): string {
  const before = new Map<number, string>();
  const after = new Map<number, string>();
  const add = (map: Map<number, string>, token: number, marks: string) => {
    if (marks) map.set(token, (map.get(token) ?? '') + marks);
  };
  // Marks on an original character without a partner move to the nearest paired one.
  let carried = '';
  let last = -1;
  for (let b = start; b <= end; b += 1) {
    const char = source[b];
    const a = pairs.get(b);
    if (a !== undefined) {
      const token = copy.chars[a].token;
      add(before, token, carried + char.before);
      add(after, token, char.after);
      carried = '';
      last = token;
    } else {
      carried += char.before;
      if (last >= 0) add(after, last, char.after);
      else carried += char.after;
    }
  }
  if (carried && last >= 0) add(after, last, carried);
  // Marks go outside tags that open or close right next to them: "<i>Run</i>", not <i>"Run"</i>.
  const { tokens } = copy;
  for (const [token, marks] of [...before]) {
    let target = token;
    while (target > 0 && /^<[bi]>$/.test(tokens[target - 1])) target -= 1;
    before.delete(token);
    add(before, target, marks);
  }
  for (const [token, marks] of [...after]) {
    let target = token;
    while (target + 1 < tokens.length && /^<\/[bi]>$/.test(tokens[target + 1])) target += 1;
    after.delete(token);
    add(after, target, marks);
  }
  return tokens
    .map((token, i) =>
      QUOTE.test(token) ? '' : (before.get(i) ?? '') + token + (after.get(i) ?? ''),
    )
    .join('');
}

export interface Transfer {
  /** Paragraphs that gained quotation marks, by index, as inline markup. */
  paragraphs: Record<number, string>;
  /** Paragraphs that couldn't be found in the original. */
  missed: number[];
}

/**
 * Copies the quotation marks and apostrophes of an original text (e.g. an archived Royal Road
 * chapter) onto a copy that lost them. Each paragraph of the copy is found in the original by
 * its letters and digits alone, so it doesn't matter where either side breaks paragraphs or
 * that the original has extra lines; one the original words a little differently is aligned
 * with the stretch between its neighbours. Only marks move: the copy's words, markup and other
 * punctuation stay as they are, and every result still has to pass acceptFix.
 */
export function transferQuotes(copy: readonly Paragraph[], original: readonly string[]): Transfer {
  const source = readOriginal(original);
  const keyAt: number[] = [];
  source.forEach((char, index) => {
    if (char.key) keyAt.push(index);
  });
  const sourceKeys = keyAt.map((index) => source[index].key).join('');
  const copies = copy.map(readCopy).filter((paragraph) => paragraph.keys);
  // The letters only count where they make whole words: "Go" isn't in "staring off".
  const wordStart = (i: number) => source[i].spaced || !source[i - 1].key;
  const wordEnd = (i: number) =>
    i + 1 === source.length || source[i + 1].spaced || !source[i + 1].key;
  const findWords = (keys: string, from: number) => {
    let found = sourceKeys.indexOf(keys, from);
    while (found >= 0 && !(wordStart(keyAt[found]) && wordEnd(keyAt[found + keys.length - 1]))) {
      found = sourceKeys.indexOf(keys, found + 1);
    }
    return found;
  };
  const placements: (Placement | undefined)[] = [];

  // First the paragraphs whose letters appear exactly, in order.
  let keyCursor = 0;
  let used = -1;
  copies.forEach((paragraph, i) => {
    const found = findWords(paragraph.keys, keyCursor);
    if (found < 0 || (paragraph.keys.length < SHORT && found - keyCursor > SHORT_REACH)) return;
    const last = found + paragraph.keys.length - 1;
    const [start, end] = widen(source, keyAt[found], keyAt[last], used + 1);
    placements[i] = pairExact(paragraph, source, start, end);
    keyCursor = last + 1;
    used = end;
  });

  // Then the rest, each within the gap its neighbours leave.
  copies.forEach((paragraph, i) => {
    // Short ones are too easy to match by chance.
    if (placements[i] || paragraph.keys.length < SHORT) return;
    const previous = placements.slice(0, i).findLast(Boolean);
    const next = placements.slice(i + 1).find(Boolean);
    const low = previous ? previous.end + 1 : 0;
    const high = next ? next.start - 1 : source.length - 1;
    placements[i] = pairSimilar(paragraph, source, low, high);
  });

  const result: Transfer = { paragraphs: {}, missed: [] };
  copies.forEach((paragraph, i) => {
    const placement = placements[i];
    const fixed = placement && applyMarks(paragraph, source, placement);
    const accepted = fixed === undefined ? undefined : acceptFix(paragraph.markup, fixed);
    if (accepted === undefined) result.missed.push(paragraph.index);
    else if (accepted !== paragraph.markup) result.paragraphs[paragraph.index] = accepted;
  });
  return result;
}
