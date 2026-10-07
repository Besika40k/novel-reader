/**
 * Chapter text is stored as "inline markup": HTML-escaped text with only <b> and <i> tags, and
 * "\n" for a line break inside a paragraph. That keeps the emphasis novels rely on (skill names,
 * thoughts, system messages) without ever storing or rendering a website's raw HTML.
 */

const BOLD = new Set(['B', 'STRONG']);
const ITALIC = new Set(['I', 'EM', 'CITE', 'DFN']);
const SKIP = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'IFRAME',
  'INS',
  'SVG',
  'IMG',
  'PICTURE',
  'VIDEO',
  'AUDIO',
  'CANVAS',
  'OBJECT',
  'BUTTON',
  'FORM',
  'INPUT',
  'SELECT',
  'TEXTAREA',
]);
const BLOCK = new Set([
  'P',
  'DIV',
  'SECTION',
  'ARTICLE',
  'BLOCKQUOTE',
  'CENTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'PRE',
  'TABLE',
  'TR',
  'TD',
]);

export function escapeInline(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function unescapeInline(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function write(node: Node, out: string[], bold: boolean, italic: boolean): void {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(escapeInline((node.nodeValue ?? '').replace(/\s+/g, ' ')));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const tag = (node as Element).tagName.toUpperCase();
  if (SKIP.has(tag)) return;
  if (tag === 'BR') {
    out.push('\n');
    return;
  }
  const b = !bold && BOLD.has(tag);
  const i = !italic && ITALIC.has(tag);
  if (b) out.push('<b>');
  if (i) out.push('<i>');
  node.childNodes.forEach((child) => write(child, out, bold || b, italic || i));
  if (i) out.push('</i>');
  if (b) out.push('</b>');
}

function tidy(markup: string): string {
  let result = markup.replace(/ *\n */g, '\n').replace(/ {2,}/g, ' ');
  // Drop empty pairs such as "<b> </b>", which pages leave behind around removed ads.
  for (let previous = ''; previous !== result;) {
    previous = result;
    result = result.replace(/<([bi])>(\s*)<\/\1>/g, '$2');
  }
  return result.replace(/^\s+|\s+$/g, '');
}

/** Inline markup for a node: a text node, an inline element, or the contents of a block. */
export function toInline(node: Node): string {
  const out: string[] = [];
  write(node, out, false, false);
  return tidy(out.join(''));
}

export function inlineToText(markup: string): string {
  return unescapeInline(markup.replace(/<\/?[bi]>/g, ''));
}

export interface InlineSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

export function parseInline(markup: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const tag = /<(\/?)([bi])>/g;
  let bold = 0;
  let italic = 0;
  let last = 0;
  for (let match = tag.exec(markup); match; match = tag.exec(markup)) {
    if (match.index > last) {
      segments.push({
        text: unescapeInline(markup.slice(last, match.index)),
        bold: bold > 0,
        italic: italic > 0,
      });
    }
    const delta = match[1] ? -1 : 1;
    if (match[2] === 'b') bold = Math.max(0, bold + delta);
    else italic = Math.max(0, italic + delta);
    last = tag.lastIndex;
  }
  if (last < markup.length) {
    segments.push({ text: unescapeInline(markup.slice(last)), bold: bold > 0, italic: italic > 0 });
  }
  return segments;
}

// Text that can only be the rest of the previous sentence: it starts lower-case or with closing
// punctuation.
const CONTINUES = /^[a-z,.;:!?)\]”’…]/;

function join(previous: string, next: string): string {
  const glued =
    /^[,.;:!?)\]”’…]/.test(inlineToText(next)) || /[\s(“‘[]$/.test(inlineToText(previous));
  return previous + (glued ? '' : ' ') + next;
}

/**
 * Splits a chapter container into paragraphs of inline markup.
 *
 * Block elements become paragraphs. Bare text sitting between blocks is common on aggregator
 * sites, whose scrapers sometimes close a <p> mid-sentence: such text joins the paragraph before
 * it when it reads as a continuation, and otherwise becomes a paragraph of its own.
 */
export function extractParagraphs(
  container: Element,
  skip: (el: Element) => boolean = () => false,
): string[] {
  const paragraphs: string[] = [];
  let run = '';
  let runAfterBlock = false;
  let afterBlock = false;

  const flush = () => {
    const markup = tidy(run);
    run = '';
    if (!markup) return;
    const last = paragraphs.length - 1;
    if (runAfterBlock && last >= 0 && CONTINUES.test(inlineToText(markup))) {
      paragraphs[last] = join(paragraphs[last], markup);
    } else {
      paragraphs.push(markup);
    }
  };

  const addInline = (node: Node) => {
    const out: string[] = [];
    write(node, out, false, false);
    const markup = out.join('');
    if (!run && !markup.trim()) return;
    if (!run) runAfterBlock = afterBlock;
    run += markup;
  };

  const walk = (parent: Element) => {
    parent.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        addInline(node);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      const tag = el.tagName.toUpperCase();
      if (SKIP.has(tag) || skip(el)) return;
      if (tag === 'BR') {
        flush();
        afterBlock = false;
        return;
      }
      if (BLOCK.has(tag)) {
        flush();
        if (Array.from(el.children).some((child) => BLOCK.has(child.tagName.toUpperCase()))) {
          walk(el);
        } else {
          const markup = toInline(el);
          if (markup) paragraphs.push(markup);
        }
        afterBlock = true;
        return;
      }
      addInline(el);
    });
  };

  walk(container);
  flush();
  return paragraphs;
}
