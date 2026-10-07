import { describe, expect, it } from 'vitest';
import { isJunkParagraph, readableParagraphs } from './junk';

describe('isJunkParagraph', () => {
  it.each([
    'This content has been misappropriated from Royal Road; report any instances of this story if found elsewhere.',
    "Unauthorized usage: this tale is on Amazon without the author's consent. Report any sightings.",
    'Taken from Royal Road, this narrative should be reported if found on Amazon.',
    'This story has been stolen from NovelPhoenix. If you read it on Amazon, please report it',
    'Love what you are reading? Support the author on Royal Road, the home of this novel.',
    '   ',
  ])('flags %j', (text) => {
    expect(isJunkParagraph(text)).toBe(true);
  });

  it.each([
    'I report to the captain before sunrise.',
    'The amazon warrior raised her spear.',
    'Someone had stolen the map, and the road ahead was royal blue in the dusk.',
    `${'A long paragraph about Royal Road and stolen goods. '.repeat(8)}`,
  ])('keeps %j', (text) => {
    expect(isJunkParagraph(text)).toBe(false);
  });
});

describe('readableParagraphs', () => {
  it('drops junk and a leading repeat of the title', () => {
    expect(
      readableParagraphs('Chapter 2: Frost', [
        '<b>Chapter 2 - Frost</b>',
        'Snow fell.',
        'Stolen from Royal Road. Please report it.',
        'It kept falling.',
      ]),
    ).toEqual([
      { index: 1, markup: 'Snow fell.' },
      { index: 3, markup: 'It kept falling.' },
    ]);
  });

  it('keeps a first paragraph that only resembles the title', () => {
    expect(readableParagraphs('Frost', ['Frost covered everything.'])).toEqual([
      { index: 0, markup: 'Frost covered everything.' },
    ]);
  });
});
