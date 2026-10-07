import { describe, expect, it } from 'vitest';
import {
  acceptFix,
  analyseChapter,
  applyFixes,
  normaliseReply,
  restoreApostrophes,
  restoreQuotes,
} from './rules';

const paragraphs = (...markup: string[]) => markup.map((m, index) => ({ index, markup: m }));

describe('restoreApostrophes', () => {
  it('restores unambiguous contractions and keeps their case', () => {
    expect(restoreApostrophes('Ive got it, dont worry. DONT move, Youre fine.')).toBe(
      "I've got it, don't worry. DON'T move, You're fine.",
    );
    expect(restoreApostrophes('Thatll do. Shes sure hes wrong; we wouldve won.')).toBe(
      "That'll do. She's sure he's wrong; we would've won.",
    );
  });

  it('reads "Id" and "Ill" before a verb as I\'d and I\'ll', () => {
    expect(restoreApostrophes('Id rather stay. Ill go first.')).toBe(
      "I'd rather stay. I'll go first.",
    );
    expect(restoreApostrophes('He was ill for days.')).toBe('He was ill for days.');
  });

  it('leaves real words, possessives and existing apostrophes alone', () => {
    const text = "Its well were wed lets hell, Mayas sword and it's done.";
    expect(restoreApostrophes(text)).toBe(text);
  });

  it('works around tags', () => {
    expect(restoreApostrophes('<i>Dont</i> go.')).toBe("<i>Don't</i> go.");
  });
});

describe('restoreQuotes', () => {
  it.each([
    ['Ew, Maya says.', '"Ew," Maya says.'],
    ['What? he asks quietly.', '"What?" he asks quietly.'],
    ['Run! shouted the old captain.', '"Run!" shouted the old captain.'],
    ['I think it is locked, I say and step back.', '"I think it is locked," I say and step back.'],
    ['She turns to me and says, We should go.', 'She turns to me and says, "We should go."'],
    ['Lily frowns, so I answer, Not yet.', 'Lily frowns, so I answer, "Not yet."'],
    ['Ew, Maya says, That is gross.', '"Ew," Maya says, "That is gross."'],
  ])('quotes %j', (input, output) => {
    expect(restoreQuotes(input)).toBe(output);
  });

  it.each([
    'Still, he says nothing.',
    'However, she says she will come.',
    'After a moment, he answers.',
    'Slowly, I answer.',
    'I look at him. Why? I ask.',
    'When they ask, I answer.',
    'So, as I said, The plan works.',
    '(Run!) he shouts in my head.',
    '"Ew," Maya says.',
    'The sun sets over the city.',
  ])('leaves %j', (input) => {
    expect(restoreQuotes(input)).toBe(input);
  });

  it('keeps quotes outside tags and entities intact', () => {
    expect(restoreQuotes('<i>Hello</i>, he says.')).toBe('"<i>Hello</i>," he says.');
    expect(restoreQuotes('<i>Hello,</i> he says.')).toBe('"<i>Hello,</i>" he says.');
    expect(restoreQuotes('She whispers, <b>Run</b>.')).toBe('She whispers, "<b>Run</b>."');
    expect(restoreQuotes('Fish &amp; chips, he says.')).toBe('"Fish &amp; chips," he says.');
  });
});

describe('analyseChapter', () => {
  it('flags a chapter that lost its quotes', () => {
    const result = analyseChapter(
      paragraphs(
        'The hall is quiet when we arrive.',
        'Ew, Maya says.',
        'Lily frowns, so I answer, Not yet. Ive got a plan.',
        'We walk on. Nobody speaks for a while.',
        'Are we there yet? Lily asks.',
      ),
    );
    expect(result).toEqual({ unquotedSpeech: 3, contractions: 1, needsFix: true });
  });

  it('leaves a normal chapter alone', () => {
    const result = analyseChapter(
      paragraphs(
        'The hall is quiet when we arrive.',
        '"Ew," Maya says.',
        'Lily frowns, so I answer, "Not yet. I\'ve got a plan."',
        'Still, she says nothing. After a moment, he answers with a nod.',
      ),
    );
    expect(result.needsFix).toBe(false);
  });
});

describe('acceptFix', () => {
  it('accepts added quotes and apostrophes, with curly quotes made straight', () => {
    expect(acceptFix('Ew, Maya says. Its fine.', '“Ew,” Maya says. It’s fine.')).toBe(
      '"Ew," Maya says. It\'s fine.',
    );
  });

  it('refuses rewording, dropped tags and lost quotes', () => {
    expect(acceptFix('Ew, Maya says.', '"Eww," Maya says.')).toBeUndefined();
    expect(acceptFix('<i>Ew</i>, Maya says.', '"Ew," Maya says.')).toBeUndefined();
    expect(acceptFix('"Ew," Maya says.', 'Ew, Maya says.')).toBeUndefined();
  });

  it('accepts entities and line breaks written either way', () => {
    expect(acceptFix('Fish &amp; chips\nplease', '"Fish & chips<br>please"')).toBe(
      '"Fish &amp; chips\nplease"',
    );
    expect(normaliseReply('<I>Hi</I> &quot;there&quot;')).toBe('<i>Hi</i> "there"');
  });
});

describe('applyFixes', () => {
  const chapter = paragraphs('Ew, Maya says.', 'Dont, I say.', 'Yes, he says.');

  it('uses the rules when there is no AI fix', () => {
    expect(applyFixes(chapter, true).map((p) => p.markup)).toEqual([
      '"Ew," Maya says.',
      '"Don\'t," I say.',
      '"Yes," he says.',
    ]);
    expect(applyFixes(chapter, false)[1].markup).toBe("Don't, I say.");
  });

  it('prefers the AI where it has been, and the rules after that', () => {
    const fix = { paragraphs: { 0: '"Ew," Maya says.', 1: 'Dont, I say!' }, through: 1 };
    expect(applyFixes(chapter, true, fix).map((p) => p.markup)).toEqual([
      '"Ew," Maya says.',
      "Don't, I say.",
      '"Yes," he says.',
    ]);
  });
});
