import { inlineToText } from './inline';

// Sites whose name appears in anti-theft notices and aggregator watermarks.
const SITE_NAMES =
  /\b(royal ?road|novel ?phoenix|novelbin|lightnovelpub|novelfire|freewebnovel|webnovel)\b/i;
const AMAZON = /\bamazon\b/i;
// Words for the theft itself. Authors' notes mention Amazon too ("Book 2 is live on Amazon"), so
// Amazon alone needs one of these.
const THEFT_WORDS =
  /\b(stolen|steal\w*|misappropriat\w*|appropriated|purloined|unauthori[sz]ed|unlawful\w*|illicit\w*|pilfer\w*|lifted|taken|pirat\w*|infring\w*|report\w*|without (?:the author['’]?s )?(?:consent|permission|authori[sz]ation)|support the author|original (?:source|site|platform)|true home|home of)\b/i;
// A site name is rarer in story text, so an invitation to read there is enough.
const INVITE_WORDS = /\b(support\w*|authors?|read\w*|visit\w*|platform|original|official)\b/i;
// Notices without a site name: theft of the story named outright, or a plainer word for it plus
// a request to report it.
const THEFT =
  /\b(misappropriat\w*|unauthori[sz]ed|illicit\w*|unlawful\w*|pirated|piracy|stolen content|literary theft)\b/i;
const TAKEN =
  /\b(stolen|taken|lifted|obtained|pilfered|purloined|appropriated|duplicat\w*|reproduc\w*|usage|without (?:the )?(?:author['’]?s )?(?:consent|permission|approval|authori[sz]ation))\b/i;
const REPORT = /\b(report\w*|sightings?|infringement|violation)\b/i;
const WORK = /\b(story|stories|tale|narrative|novel)\b/i;
// "Read it on the original site to support the author" and its many rewordings.
const ELSEWHERE =
  /\b((?:original|official|genuine|authentic|legitimate|preferred)\s+(?:site|website|platform|source|version|release|publisher)|(?:another|different)\s+(?:site|website|platform)|originally published|published (?:on|elsewhere)|posted elsewhere)\b/i;
const SUPPORT = /\b(authors?|creators?|writers?|support\w*|credit)\b/i;
const SELF = /\b(this (?:book|story|novel|tale|narrative|text|content)|true home)\b/i;
// Aggregator watermarks such as "Visit freewebnovel.com for the latest chapters".
const DOMAIN = /\b[a-z0-9-]+\.(com|net|org)\b/i;
const DOMAIN_WORDS = /\b(read\w*|visit\w*|source|updat\w*|latest|chapters?|novels?)\b/i;

/**
 * Whether a paragraph is a notice injected by a site rather than part of the story, e.g. Royal
 * Road's rotating "This content has been misappropriated from Royal Road…" lines, its "read the
 * official version to support the author" lines, or an aggregator's own watermark. Each test
 * pairs words that story text rarely puts side by side, and notices are short, so long
 * paragraphs are never matched. Checked against every stored chapter of the owner's library.
 */
export function isJunkParagraph(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  if (value.length > 280) return false;
  if (SITE_NAMES.test(value) && (THEFT_WORDS.test(value) || INVITE_WORDS.test(value))) return true;
  if (AMAZON.test(value) && THEFT_WORDS.test(value)) return true;
  if (THEFT.test(value) && WORK.test(value)) return true;
  if (TAKEN.test(value) && REPORT.test(value) && WORK.test(value)) return true;
  if (ELSEWHERE.test(value) && (SUPPORT.test(value) || SELF.test(value))) return true;
  return DOMAIN.test(value) && DOMAIN_WORDS.test(value);
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
