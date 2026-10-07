/**
 * Offline repairs for chapters whose quotation marks and apostrophes a site's scraper dropped
 * ("Ew, Maya says." for "\"Ew,\" Maya says.", "Ive" for "I've"). The rules only touch the clear
 * cases; an AI model handles the rest (./ai.ts). Everything here works on inline markup
 * (src/lib/inline.ts) and never moves its tags.
 */
import { escapeInline, inlineToText, unescapeInline } from '@/lib/inline';
import type { Paragraph } from '@/lib/junk';

// Contractions as the scraper leaves them. Only words that can't be anything else: "its",
// "well", "were", "wed", "lets", "hell" and "shell" are words too, so they're left to the AI.
// prettier-ignore
const CONTRACTIONS = [
  'dont', 'doesnt', 'didnt', 'isnt', 'arent', 'wasnt', 'werent', 'hasnt', 'havent', 'hadnt',
  'cant', 'couldnt', 'wouldnt', 'shouldnt', 'mustnt', 'neednt', 'wont', 'aint',
  'ive', 'im', 'youre', 'youve', 'youll', 'youd', 'theyre', 'theyve', 'theyll', 'theyd', 'weve',
  'hes', 'shes', 'thats', 'whats', 'wheres', 'theres', 'heres', 'whos', 'itll', 'thatll',
  'wouldve', 'couldve', 'shouldve', 'mightve', 'mustve',
];
const CONTRACTION = new RegExp(`\\b(?:${CONTRACTIONS.join('|')})\\b`, 'gi');
// "Id" and "Ill" are "I'd" and "I'll" when a verb follows; "ill" in lower case is the adjective.
const FIRST_PERSON = /\bI(?:d|ll)\b(?= [a-z])/g;

function withApostrophe(word: string): string {
  const at = word.length - (/(?:ve|re|ll)$/i.test(word) ? 2 : 1);
  return `${word.slice(0, at)}'${word.slice(at)}`;
}

/** Puts back apostrophes the scraper dropped from unambiguous contractions. */
export function restoreApostrophes(markup: string): string {
  return markup.replace(CONTRACTION, withApostrophe).replace(FIRST_PERSON, withApostrophe);
}

// prettier-ignore
const VERBS = [
  'say', 'says', 'said', 'ask', 'asks', 'asked', 'reply', 'replies', 'replied',
  'answer', 'answers', 'answered', 'shout', 'shouts', 'shouted', 'yell', 'yells', 'yelled',
  'whisper', 'whispers', 'whispered', 'mutter', 'mutters', 'muttered',
  'murmur', 'murmurs', 'murmured', 'mumble', 'mumbles', 'mumbled',
  'scream', 'screams', 'screamed', 'exclaim', 'exclaims', 'exclaimed',
  'continue', 'continues', 'continued', 'add', 'adds', 'added',
  'respond', 'responds', 'responded', 'retort', 'retorts', 'retorted',
  'snap', 'snaps', 'snapped', 'growl', 'growls', 'growled', 'hiss', 'hisses', 'hissed',
  'grumble', 'grumbles', 'grumbled', 'tell', 'tells', 'told',
];
const VERB = `(?:${VERBS.join('|')})`;
// A pronoun, a name ("Maya", "Min-Jae") or a noun phrase ("the old man", "his sister").
const SPEAKER = String.raw`(?:I|he|she|they|we|[A-Z][a-z]+(?:[- ][A-Z][a-z]+)?|(?:the|my|his|her|their|our) [a-z]+(?: [a-z]+)?)`;
const TAG = String.raw`(?:${SPEAKER}\s+${VERB}|${VERB}\s+${SPEAKER})`;
// What may follow a speech tag: "he says.", "he asks me quietly,", "I say and turn away". Anything
// else ("he says nothing", "she says she will come") isn't a tag for the words before it.
const AFTER_TAG = String.raw`(?:\s+(?:me|him|her|them|us|you|it))?(?:\s+(?:[a-z]+ly|again|back|aloud))?(?=\s*$|\s*[.,!?…;:—–]|\s+(?:to|at|with|as|while|before|after|in|into|through|without|from|toward|towards|and|but|then|when|once|under|over)\b)`;

// "Ew, Maya says." The speech runs from the start of the paragraph to the punctuation before a tag.
const SPEECH_FIRST = new RegExp(String.raw`^(.+?(?:[,!?…]|\.\.\.))\s+${TAG}${AFTER_TAG}`);
const TAG_AFTER_SPEECH = new RegExp(String.raw`[,!?…]\s+${TAG}${AFTER_TAG}`);
// "So I answer, See, …" The speech starts after the tag's comma and runs to the end.
const SPEECH_AFTER = new RegExp(
  String.raw`\b(?:${SPEAKER}(?:\s+[a-z]+ly)?\s+${VERB}|and\s+${VERB})((?:\s+[A-Za-z]+){0,3}?)\s*[,:]\s+(?=[A-Z0-9[])`,
  'g',
);

const words = (list: string) => new Set(list.split(' '));
// Words that open narration rather than speech when they lead a clause before "he says".
// prettier-ignore
const NARRATION_OPENERS = words('after before during with without in at on upon for from despite following under over through when while as once since until if because although though whenever by');
// prettier-ignore
const NARRATION_ADVERBS = words('however still instead then now so finally meanwhile afterwards afterward later suddenly yet eventually again thus therefore besides moreover nonetheless nevertheless otherwise soon next first also anyway');
// prettier-ignore
const SUBORDINATORS = words('when if as while before after because once until since although though whenever whether');

/** Whether text before a tag ("Ew," in "Ew, Maya says.") can be taken as speech. */
function plausibleSpeech(speech: string): boolean {
  if (!/[A-Za-z0-9]/.test(speech) || speech.startsWith('(')) return false;
  // A full sentence before it may well be narration: "I look at him. Why? I ask."
  if (/\.\s+[A-Z]/.test(speech)) return false;
  if (speech.endsWith(',')) {
    const first = /^[A-Za-z]+/.exec(speech)?.[0].toLowerCase() ?? '';
    if (NARRATION_OPENERS.has(first) || first.endsWith('ing')) return false;
    if (!/\s/.test(speech.trim()) && (NARRATION_ADVERBS.has(first) || first.endsWith('ly'))) {
      return false;
    }
  }
  return true;
}

/** Where speech starts after a tag like "I answer," at or after `from`, or -1. */
function speechAfterTag(text: string, from: number): number {
  for (const match of text.matchAll(SPEECH_AFTER)) {
    const start = match.index + match[0].length;
    if (start < from || /^\s+(?:nothing|anything)\b/.test(match[1])) continue;
    // "When they ask, I answer." is a clause and "as I said," an idiom, not tags.
    const before = text.slice(0, match.index);
    if (/\b(?:as|like)\s+$/i.test(before)) continue;
    const sentence = /(?:^|[.!?…]\s+)([^.!?…]*)$/.exec(before)?.[1] ?? '';
    const opener = /^\W*(\w+)/.exec(sentence)?.[1].toLowerCase();
    if (opener && SUBORDINATORS.has(opener)) continue;
    if (/[A-Za-z]/.test(text.slice(start))) return start;
  }
  return -1;
}

/** Whether a paragraph without quotation marks reads like tagged dialogue. */
function hasSpeechTag(text: string): boolean {
  return TAG_AFTER_SPEECH.test(text) || speechAfterTag(text, 0) >= 0;
}

/** Inserts `"` into markup at offsets of its text, keeping quotes outside closing tags. */
function insertQuotes(markup: string, offsets: number[]): string {
  // The markup position just after each character of the text.
  const ends: number[] = [];
  for (const token of markup.matchAll(/<\/?[bi]>|&(?:amp|lt|gt);|[\s\S]/g)) {
    if (!/^<\/?[bi]>$/.test(token[0])) ends.push(token.index + token[0].length);
  }
  const positions = offsets.map((offset) => {
    let at = offset === 0 ? 0 : ends[offset - 1];
    while (markup.startsWith('</b>', at) || markup.startsWith('</i>', at)) at += 4;
    return at;
  });
  let result = markup;
  for (const at of positions.sort((a, b) => b - a)) {
    result = `${result.slice(0, at)}"${result.slice(at)}`;
  }
  return result;
}

/**
 * Quotes dialogue whose speaker is clear from a tag: `Ew, Maya says.` becomes `"Ew," Maya says.`
 * and `So I answer, See, it works.` becomes `So I answer, "See, it works."`. Meant for chapters
 * that lost their quotes (see analyseChapter); paragraphs with any quotes are left alone.
 */
export function restoreQuotes(markup: string): string {
  const text = inlineToText(markup);
  if (/["“”]/.test(text) || text.includes('\n')) return markup;
  const offsets: number[] = [];
  let from = 0;
  const first = SPEECH_FIRST.exec(text);
  if (first && plausibleSpeech(first[1])) {
    offsets.push(0, first[1].length);
    from = first[0].length;
  }
  const start = speechAfterTag(text, from);
  if (start >= 0) offsets.push(start, text.length);
  return offsets.length ? insertQuotes(markup, offsets) : markup;
}

export interface QuoteAnalysis {
  /** Paragraphs that read like tagged dialogue but have no quotation marks. */
  unquotedSpeech: number;
  /** Contractions missing their apostrophe. */
  contractions: number;
  /** Whether the chapter lost its dialogue quotes. */
  needsFix: boolean;
}

export function analyseChapter(paragraphs: readonly Paragraph[]): QuoteAnalysis {
  let unquotedSpeech = 0;
  let contractions = 0;
  for (const { markup } of paragraphs) {
    const text = inlineToText(markup);
    contractions +=
      (text.match(CONTRACTION)?.length ?? 0) + (text.match(FIRST_PERSON)?.length ?? 0);
    if (!/["“”]/.test(text) && hasSpeechTag(text)) unquotedSpeech += 1;
  }
  return {
    unquotedSpeech,
    contractions,
    needsFix: unquotedSpeech >= 2 || (unquotedSpeech === 1 && contractions >= 3),
  };
}

const QUOTE_MARKS = /["“”„'‘’]/g;

function skeleton(markup: string): string {
  return markup
    .replace(QUOTE_MARKS, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
}

/** A model's paragraph as inline markup: straight quotes, escaped text and "\n" for <br>. */
export function normaliseReply(text: string): string {
  return text
    .replace(/[“”„]|&quot;/g, '"')
    .replace(/[‘’]|&#0?39;|&apos;/g, "'")
    .split(/(<\/?[bi]>|<br\s*\/?>)/i)
    .map((part, i) => {
      if (i % 2 === 0) return escapeInline(unescapeInline(part));
      return /^<br/i.test(part) ? '\n' : part.toLowerCase();
    })
    .join('')
    .trim();
}

/**
 * A model's version of a paragraph, normalised, if all it did was add quotation marks and
 * apostrophes. Anything else (rewording, a dropped tag, a lost quote) is refused, so a weak
 * model can't damage the text.
 */
export function acceptFix(original: string, fixed: string): string | undefined {
  const result = normaliseReply(fixed);
  const kept = skeleton(result) === skeleton(original);
  const added =
    (result.match(QUOTE_MARKS)?.length ?? 0) >= (original.match(QUOTE_MARKS)?.length ?? 0);
  return kept && added ? result : undefined;
}

/**
 * The paragraphs to show: the fixed version where there is one, otherwise the rules' (apostrophes
 * always; quotes when the chapter lost them and the fix hasn't covered that paragraph).
 */
export function applyFixes(
  paragraphs: readonly Paragraph[],
  quotes: boolean,
  fix?: { paragraphs: Record<number, string>; through: number; missed?: number[] },
): Paragraph[] {
  const missed = new Set(fix?.missed);
  return paragraphs.map(({ index, markup }) => {
    const fixed = fix?.paragraphs[index];
    const accepted = fixed === undefined ? undefined : acceptFix(markup, fixed);
    if (accepted !== undefined) return { index, markup: accepted };
    const restored = restoreApostrophes(markup);
    const covered = fix !== undefined && index <= fix.through && !missed.has(index);
    return { index, markup: quotes && !covered ? restoreQuotes(restored) : restored };
  });
}
