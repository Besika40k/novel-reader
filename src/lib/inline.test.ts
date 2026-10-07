import { describe, expect, it } from 'vitest';
import { parseHtml } from './html';
import { extractParagraphs, inlineToText, parseInline, toInline } from './inline';

const body = (html: string) => parseHtml(html).body;

describe('toInline', () => {
  it('keeps bold and italics, escapes text and turns <br> into a line break', () => {
    const p = body('<p>A <strong>bold <em>and</em></strong> <span>plain</span> a&lt;b<br> next</p>')
      .firstElementChild as Element;
    expect(toInline(p)).toBe('A <b>bold <i>and</i></b> plain a&lt;b\nnext');
  });

  it('does not nest the same emphasis twice', () => {
    const p = body('<p><b>outer <strong>inner</strong></b></p>').firstElementChild as Element;
    expect(toInline(p)).toBe('<b>outer inner</b>');
  });

  it('drops empty emphasis left behind by removed elements', () => {
    const p = body('<p>Text<strong> <script>x()</script></strong></p>')
      .firstElementChild as Element;
    expect(toInline(p)).toBe('Text');
  });
});

describe('inlineToText and parseInline', () => {
  const markup = 'Say <b>[Bolt]</b>, <i>now &amp; <b>here</b></i> &lt;3';

  it('strips the markup', () => {
    expect(inlineToText(markup)).toBe('Say [Bolt], now & here <3');
  });

  it('splits into styled segments', () => {
    expect(parseInline(markup)).toEqual([
      { text: 'Say ', bold: false, italic: false },
      { text: '[Bolt]', bold: true, italic: false },
      { text: ', ', bold: false, italic: false },
      { text: 'now & ', bold: false, italic: true },
      { text: 'here', bold: true, italic: true },
      { text: ' <3', bold: false, italic: false },
    ]);
  });
});

describe('extractParagraphs', () => {
  it('flattens nested blocks', () => {
    expect(
      extractParagraphs(body('<div><p>One</p><div><p>Two</p></div></div><p>Three</p>')),
    ).toEqual(['One', 'Two', 'Three']);
  });

  it('splits text separated by <br> into paragraphs', () => {
    expect(extractParagraphs(body('First line.<br><br>Second <b>line</b>.<br>Third.'))).toEqual([
      'First line.',
      'Second <b>line</b>.',
      'Third.',
    ]);
  });

  it('joins only continuations onto the previous block', () => {
    expect(
      extractParagraphs(body('<p>He shouted</p>, then left.<p>She waited.</p>Nobody came.')),
    ).toEqual(['He shouted, then left.', 'She waited.', 'Nobody came.']);
  });

  it('applies the skip filter', () => {
    const container = body('<p>Keep</p><div class="ad"><p>Drop</p></div>');
    expect(extractParagraphs(container, (el) => el.classList.contains('ad'))).toEqual(['Keep']);
  });
});
