import { describe, expect, it } from 'vitest';
import { transferQuotes } from './transfer';

const paragraphs = (...markup: string[]) => markup.map((m, index) => ({ index, markup: m }));

describe('transferQuotes', () => {
  it('puts back dialogue quotes and apostrophes from the original', () => {
    const result = transferQuotes(
      paragraphs('Where are you going? she asks.', 'Ive got it, dont worry.'),
      ['“Where are you going?” she asks.', 'I’ve got it, don’t worry.'],
    );
    expect(result).toEqual({
      paragraphs: { 0: '"Where are you going?" she asks.', 1: "I've got it, don't worry." },
      missed: [],
    });
  });

  it('leaves narration alone and reports paragraphs the original lacks', () => {
    const result = transferQuotes(
      paragraphs('The rain kept falling.', 'Read this somewhere else!', 'Fine, I say.'),
      ['The rain kept falling.', '“Fine,” I say.'],
    );
    expect(result).toEqual({ paragraphs: { 2: '"Fine," I say.' }, missed: [1] });
  });

  it("doesn't mind where either side breaks paragraphs", () => {
    const result = transferQuotes(paragraphs('Stay here, he says.', 'Ill be back soon.'), [
      '“Stay here,” he says. “I’ll be back soon.”',
    ]);
    expect(result.paragraphs).toEqual({ 0: '"Stay here," he says.', 1: `"I'll be back soon."` });
  });

  it('skips extra lines in the original, like anti-theft notices', () => {
    const result = transferQuotes(paragraphs('Run, she says.', 'Why? I ask.'), [
      '“Run,” she says.',
      'This story was stolen from its home site.',
      '“Why?” I ask.',
    ]);
    expect(result.paragraphs).toEqual({ 0: '"Run," she says.', 1: '"Why?" I ask.' });
  });

  it('keeps the copy’s own markup, dashes and ellipses', () => {
    const result = transferQuotes(
      paragraphs('<i>Not again</i>, I think. Well... maybe - just once.', 'Tom &amp; Ann wave.'),
      ['“Not again,” I think. “Well… maybe—just once.”', 'Tom & Ann wave.'],
    );
    expect(result.paragraphs).toEqual({
      0: '"<i>Not again</i>," I think. "Well... maybe - just once."',
    });
  });

  it('copies nested quotes and plural possessives', () => {
    const result = transferQuotes(paragraphs('He said no to the players items, Lily says.'), [
      '“He said ‘no’ to the players’ items,” Lily says.',
    ]);
    expect(result.paragraphs[0]).toBe(`"He said 'no' to the players' items," Lily says.`);
  });

  it('aligns a paragraph the original words a little differently', () => {
    const result = transferQuotes(
      paragraphs(
        'Hold still, I say.',
        'Pick up the lantern, I say, starting off to the left.',
        'Go.',
      ),
      ['“Hold still,” I say.', '“Pick up the lantern,” I say, staring off to the left.', 'Go.'],
    );
    expect(result).toEqual({
      paragraphs: {
        0: '"Hold still," I say.',
        1: '"Pick up the lantern," I say, starting off to the left.',
      },
      missed: [],
    });
  });

  it('finds short paragraphs only near the previous one', () => {
    const filler = 'Nothing happens for a long while. '.repeat(20);
    const result = transferQuotes(paragraphs('The door opens.', 'Yes, I say.'), [
      'The door opens.',
      filler,
      '“Yes,” I say.',
    ]);
    expect(result.missed).toEqual([1]);
  });
});
