import { inlineToText } from './inline';

// Sites whose name appears in anti-theft notices and aggregator watermarks.
const SITE_NAMES =
  /\b(royal ?road|novel ?phoenix|novelbin|lightnovelpub|novelfire|freewebnovel|webnovel)\b/i;
const AMAZON = /\bamazon\b/i;
const NOTICE_WORDS =
  /\b(stolen|steal\w*|misappropriat\w*|unauthori[sz]ed|unlawful\w*|illicit\w*|pilfer\w*|lifted|taken|pirat\w*|infring\w*|report\w*|without (?:the author'?s )?(?:consent|permission|authori[sz]ation)|support the author|original (?:source|site|platform)|true home|home of)\b/i;

/**
 * Whether a paragraph is a notice injected by a site rather than part of the story, e.g. Royal
 * Road's rotating "This content has been misappropriated from Royal Road…" lines or an
 * aggregator's own watermark. Story text rarely names a website or Amazon alongside words
 * like "stolen" or "report", and notices are short, so long paragraphs are never matched.
 */
export function isJunkParagraph(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  if (value.length > 280) return false;
  return (SITE_NAMES.test(value) || AMAZON.test(value)) && NOTICE_WORDS.test(value);
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export interface Paragraph {
  /** Position in the stored chapter. Quote fixes are keyed by it. */
  index: number;
  markup: string;
}

/**
 * Paragraphs as the reader shows them: junk lines removed, and a leading paragraph that only
 * repeats the chapter title dropped. Applied at render time so stored chapters stay untouched
 * and improve whenever these rules do.
 */
export function readableParagraphs(title: string, paragraphs: readonly string[]): Paragraph[] {
  const result = paragraphs
    .map((markup, index) => ({ index, markup }))
    .filter((p) => !isJunkParagraph(inlineToText(p.markup)));
  const first = result[0];
  if (first !== undefined && title && normalise(inlineToText(first.markup)) === normalise(title)) {
    result.shift();
  }
  return result;
}
