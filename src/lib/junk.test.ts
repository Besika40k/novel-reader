import { describe, expect, it } from 'vitest';
import { isJunkParagraph, readableParagraphs } from './junk';

describe('isJunkParagraph', () => {
  it.each([
    'This content has been misappropriated from Royal Road; report any instances of this story if found elsewhere.',
    "Unauthorized usage: this tale is on Amazon without the author's consent. Report any sightings.",
    'Taken from Royal Road, this narrative should be reported if found on Amazon.',
    'This story has been stolen from NovelPhoenix. If you read it on Amazon, please report it',
    'Love what you are reading? Support the author on Royal Road, the home of this novel.',
    'Love this novel? Read it on Royal Road to ensure the author gets credit.',
    'The narrative has been taken without permission. Report any sightings.',
    'The tale has been illicitly lifted; should you spot it, report the violation.',
    'This story has been unlawfully obtained without the author’s consent.',
    'Unauthorized duplication: this narrative has been taken without consent. Report sightings.',
    'Read the official version to support the creator.',
    'Enjoying the story? Show your support by reading it on the official site.',
    'Help support creative writers by finding and reading their stories on the original site.',
    "Find this and other great novels on the author's preferred platform. Support original creators!",
    'Did you know this text is from a different site? Read the official version to support the author.',
    'You might be reading a pirated copy. Look for the official release to support the author.',
    "Love what you're reading? Discover and support the author on the platform they originally published on.",
    'You could be reading stolen content. Head to the original site for the genuine story.',
    "This book's true home is on another platform. Check it out there for the real experience.",
    "This narrative has been purloined without the author's approval. Report any appearances on Amazon.",
    'Stolen from NovelFire, this story should be reported if encountered on Amazon.',
    'Enjoying this book? Seek out the original to ensure the author gets credit.',
    'Support the author by searching for the original publication of this novel.',
    'Reading on this site? This novel is published elsewhere. Support the author by seeking out the original.',
    'Visit freewebnovel.com for the latest chapters.',
    '   ',
  ])('flags %j', (text) => {
    expect(isJunkParagraph(text)).toBe(true);
  });

  it.each([
    'I report to the captain before sunrise.',
    'The amazon warrior raised her spear.',
    'Someone had stolen the map, and the road ahead was royal blue in the dusk.',
    'Unauthorized access detected. Report to the nearest administrator.',
    'The guards had taken her sword. She would report it to the captain.',
    'He read the original version of the treaty twice.',
    'She told the story without permission, and nobody stopped her.',
    'The pirate captain told a tale of stolen gold.',
    'He left. Co-workers read the chapter notes aloud.',
    'Then I jump to another platform, and Myrra follows me across.',
    'I fail to detect the original, and I look for the original again.',
    'Book 2 is out on Amazon now, and thank you all for reading it!',
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
