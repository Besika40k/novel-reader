import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPrompt, chunkParagraphs, fixChunk, parseReply, type Provider } from './ai';

const { postJson, sleep } = vi.hoisted(() => ({ postJson: vi.fn(), sleep: vi.fn() }));
vi.mock('@/lib/http', () => ({ postJson }));
vi.mock('@/lib/async', () => ({ sleep }));

const chunk = [
  { index: 3, markup: 'Ew, Maya says.' },
  { index: 4, markup: 'I nod.\nIts late.' },
];

function reply(text: string, status = 200, headers: Record<string, string> = {}) {
  return {
    status,
    headers,
    data:
      status === 200 ? { choices: [{ message: { content: text } }] } : { error: { message: text } },
  };
}

describe('chunkParagraphs', () => {
  it('fills chunks up to the size limit, in order', () => {
    const paragraphs = ['aaaa', 'bbbb', 'cc', 'dddddddd'].map((markup, index) => ({
      index,
      markup,
    }));
    expect(chunkParagraphs(paragraphs, 10).map((c) => c.map((p) => p.index))).toEqual([
      [0, 1, 2],
      [3],
    ]);
  });
});

describe('buildPrompt and parseReply', () => {
  it('numbers paragraphs and sends line breaks as <br>', () => {
    expect(buildPrompt(chunk)).toBe('3: Ew, Maya says.\n4: I nod.<br>Its late.');
  });

  it('keeps only accepted changes', () => {
    const text = [
      '```',
      '3: “Ew,” Maya says.',
      "4: I nod.<br>It's late.",
      '5: An extra line.',
      '```',
    ].join('\n');
    expect(parseReply(text, chunk)).toEqual({ 3: '"Ew," Maya says.', 4: "I nod.\nIt's late." });
    expect(parseReply('3: Ew, Maya said.\n4: I nod.<br>Its late.', chunk)).toEqual({});
  });

  it('joins a paragraph the model wrapped onto two lines', () => {
    expect(parseReply('3: "Ew,"\nMaya says.', chunk)).toEqual({ 3: '"Ew," Maya says.' });
  });
});

describe('fixChunk', () => {
  const groq = (models: string[]): Provider => ({
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://groq.test/v1',
    key: 'test',
    models,
  });
  const gemini: Provider = {
    id: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://gemini.test/v1',
    key: 'test',
    models: ['flash'],
  };
  const fixed = '3: "Ew," Maya says.';
  const modelOf = (call: unknown[]) => (call[1] as { model: string }).model;

  beforeEach(() => {
    postJson.mockReset();
    sleep.mockReset();
  });

  it('waits out a per-minute limit and retries the same model', async () => {
    postJson.mockResolvedValueOnce(reply('Rate limit', 429, { 'retry-after': '2' }));
    postJson.mockResolvedValueOnce(reply(fixed));
    const result = await fixChunk(chunk, [groq(['a1'])]);
    expect(result).toEqual({ fixes: { 3: '"Ew," Maya says.' }, model: 'Groq a1' });
    expect(sleep).toHaveBeenCalledWith(2500);
    expect(postJson.mock.calls.map(modelOf)).toEqual(['a1', 'a1']);
  });

  it('moves on when a daily limit runs out, and skips that model afterwards', async () => {
    postJson.mockResolvedValueOnce(reply('Please try again in 7m12.5s', 429));
    postJson.mockResolvedValue(reply(fixed));
    expect((await fixChunk(chunk, [groq(['b1', 'b2'])])).model).toBe('Groq b2');
    expect((await fixChunk(chunk, [groq(['b1', 'b2'])])).model).toBe('Groq b2');
    expect(postJson.mock.calls.map(modelOf)).toEqual(['b1', 'b2', 'b2']);
  });

  it('falls back to the next provider when a key is refused', async () => {
    postJson.mockResolvedValueOnce(reply('Invalid API key', 401));
    postJson.mockResolvedValueOnce(reply(fixed));
    const result = await fixChunk(chunk, [groq(['c1', 'c2']), gemini]);
    expect(result.model).toBe('Gemini flash');
    expect(postJson.mock.calls.map(modelOf)).toEqual(['c1', 'flash']);
  });

  it('reports when every free limit is used up', async () => {
    postJson.mockResolvedValue(reply('Limit', 429, { 'retry-after': '3600' }));
    await expect(fixChunk(chunk, [groq(['d1', 'd2'])])).rejects.toThrow(/Free AI limit reached/);
    expect(postJson).toHaveBeenCalledTimes(2);
  });
});
