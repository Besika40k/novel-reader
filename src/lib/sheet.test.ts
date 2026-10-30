import { describe, expect, it } from 'vitest';
import { sheetLines } from './sheet';

describe('sheetLines', () => {
  it('reads each column in turn, without empty cells', () => {
    const markup = [
      '<b>Name - Unnamed </b>\t<b>Skills (0/3)</b>',
      '\t<b>Body Features</b>',
      '<b>Basic Attributes</b>\tAether Core - Minor',
      'Strength - 100\tAether Channels - Weak',
      'Stamina - 100\t',
      'Path of Exceptionalism I (20/100)\t',
    ].join('\n');
    expect(sheetLines(markup)).toEqual([
      { kind: 'value', label: 'Name', value: 'Unnamed' },
      { kind: 'heading', markup: 'Basic Attributes' },
      { kind: 'value', label: 'Strength', value: '100' },
      { kind: 'value', label: 'Stamina', value: '100' },
      { kind: 'value', label: 'Path of Exceptionalism I', value: '(20/100)' },
      { kind: 'heading', markup: 'Skills (0/3)' },
      { kind: 'heading', markup: 'Body Features' },
      { kind: 'value', label: 'Aether Core', value: 'Minor' },
      { kind: 'value', label: 'Aether Channels', value: 'Weak' },
    ]);
  });

  it('keeps other text as it is', () => {
    expect(sheetLines('A <i>quiet</i> note\tB')).toEqual([
      { kind: 'text', markup: 'A <i>quiet</i> note' },
      { kind: 'text', markup: 'B' },
    ]);
  });
});
