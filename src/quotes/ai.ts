/**
 * Restores quotation marks with a language model on a free tier (Groq, or Gemini's free tier),
 * through any OpenAI-compatible chat API. Replies are checked by acceptFix, so a model can add
 * quotes and apostrophes but change nothing else.
 */
import { sleep } from '@/lib/async';
import { postJson, type JsonResponse } from '@/lib/http';
import type { Paragraph } from '@/lib/junk';
import { acceptFix } from './rules';

export interface Provider {
  id: string;
  name: string;
  /** An OpenAI-compatible API, up to (not including) /chat/completions. */
  baseUrl: string;
  /** Sent as a bearer token. Empty when the dev proxy adds it (vite.config.ts). */
  key: string;
  /** Tried in order. Free tiers limit each model separately. */
  models: string[];
}

// About 1,500 tokens of text. With the model's reasoning and its answer, one request stays under
// the 8,000 tokens a minute of Groq's free tier.
export const CHUNK_CHARS = 5000;

export const SYSTEM_PROMPT = `You restore punctuation in part of an English web-novel chapter. A broken scraper removed many of its double quotation marks and apostrophes, and your job is to put them back.

- Wrap everything a character says aloud in double quotation marks. Speech often has no tag at all, or follows a tag such as "I answer," or "she continues,". A paragraph can mix narration and speech: quote only the spoken words.
- Add apostrophes to contractions and possessives (dont, Ive, Lilys).
- Narration stays unquoted, including first-person narration and the narrator's inner monologue. Only words spoken aloud get quotes. Telepathic speech in parentheses stays as it is. Speech that already has its quotes stays as it is.
- Change nothing else: no rewording, no spelling or grammar fixes, no other punctuation. Keep the tags <b>, <i> and <br> and entities such as &amp; exactly as given.

Example input:
1: Ew, Maya says.
2: I shrug. Its fine, I dont mind. Tess is still frowning at me.
3: Lily seems confused, so I answer, See, thats your problem.
4: Ive never seen anything like it, I think.
5: (Run!) he shouts in my head.
6: Wait for me! Lily runs after them.
Example output:
1: "Ew," Maya says.
2: I shrug. "It's fine, I don't mind." Tess is still frowning at me.
3: Lily seems confused, so I answer, "See, that's your problem."
4: I've never seen anything like it, I think.
5: (Run!) he shouts in my head.
6: "Wait for me!" Lily runs after them.

Each paragraph comes on its own line as "<number>: <text>". Reply with every paragraph, in the same form and order, one per line, with your fixes applied. Output nothing else.`;

/** Splits paragraphs into requests small enough for a free tier's per-minute limit. */
export function chunkParagraphs(
  paragraphs: readonly Paragraph[],
  maxChars = CHUNK_CHARS,
): Paragraph[][] {
  const chunks: Paragraph[][] = [];
  let size = 0;
  for (const paragraph of paragraphs) {
    const last = chunks[chunks.length - 1];
    if (last && size + paragraph.markup.length <= maxChars) {
      last.push(paragraph);
      size += paragraph.markup.length;
    } else {
      chunks.push([paragraph]);
      size = paragraph.markup.length;
    }
  }
  return chunks;
}

/** The paragraphs as "<index>: <markup>" lines; line breaks inside one travel as <br>. */
export function buildPrompt(chunk: readonly Paragraph[]): string {
  return chunk.map(({ index, markup }) => `${index}: ${markup.replace(/\n/g, '<br>')}`).join('\n');
}

/** The paragraphs a reply fixed, by index; a paragraph that fails acceptFix is left out. */
export function parseReply(reply: string, chunk: readonly Paragraph[]): Record<number, string> {
  const lines = new Map<number, string>();
  let last: number | undefined;
  for (const line of reply.split(/\r?\n/)) {
    const numbered = /^\s*(\d+):\s?(.*)$/.exec(line);
    if (numbered) {
      last = Number(numbered[1]);
      lines.set(last, numbered[2]);
    } else if (last !== undefined && line.trim() && !line.trim().startsWith('```')) {
      // A model that wraps a long paragraph: the rest belongs to the line before.
      lines.set(last, `${lines.get(last)} ${line.trim()}`);
    }
  }
  const fixes: Record<number, string> = {};
  for (const { index, markup } of chunk) {
    const line = lines.get(index);
    const fixed = line === undefined ? undefined : acceptFix(markup, line);
    if (fixed !== undefined && fixed !== markup) fixes[index] = fixed;
  }
  return fixes;
}

function apiMessage({ status, data }: JsonResponse): string {
  const body = (Array.isArray(data) ? data[0] : data) as
    { error?: { message?: string } } | string | undefined;
  const message = typeof body === 'string' ? body : body?.error?.message;
  return message ? message.slice(0, 200) : `HTTP ${status}`;
}

function parseDuration(text: string): number {
  if (text.endsWith('ms')) return parseFloat(text) / 1000;
  const units = { h: 3600, m: 60, s: 1 };
  let seconds = 0;
  for (const [, value, unit] of text.matchAll(/([\d.]+)([hms])/g)) {
    seconds += parseFloat(value) * units[unit as keyof typeof units];
  }
  return seconds;
}

/** Seconds until a rate-limited request may be retried, from the header or the message. */
function retryDelay(response: JsonResponse): number | undefined {
  const header = response.headers['retry-after'];
  if (header && Number.isFinite(Number(header))) return Number(header);
  const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  const match =
    /(?:try again|retry) in ([\d.]+ms|(?:[\d.]+h)?(?:[\d.]+m)?(?:[\d.]+s)?)/i.exec(text ?? '') ??
    /"retryDelay":\s*"([\d.]+s)"/.exec(text ?? '');
  return match?.[1] ? parseDuration(match[1]) : undefined;
}

type Outcome =
  | { ok: true; text: string }
  | { ok: false; limited: true; retryAfter: number }
  | { ok: false; limited: false; message: string; badKey?: boolean };

function authorization(provider: Provider): Record<string, string> {
  return provider.key ? { Authorization: `Bearer ${provider.key}` } : {};
}

async function post(provider: Provider, body: unknown, signal?: AbortSignal) {
  try {
    return await postJson(
      `${provider.baseUrl}/chat/completions`,
      body,
      authorization(provider),
      signal,
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(`Couldn't reach ${provider.name}. Check the connection.`, { cause: error });
  }
}

async function complete(
  provider: Provider,
  model: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<Outcome> {
  const body = {
    model,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    // gpt-oss reasons before answering; "medium" finds far more missing quotes than "low".
    ...(model.includes('gpt-oss') && { reasoning_effort: 'medium' }),
  };
  for (let attempt = 0; ; attempt++) {
    const response = await post(provider, body, signal);
    const message = apiMessage(response);
    if (response.status === 200) {
      const choices = (response.data as { choices?: { message?: { content?: string } }[] })
        ?.choices;
      const text = choices?.[0]?.message?.content?.trim();
      if (text) return { ok: true, text };
      return { ok: false, limited: false, message: `${provider.name} sent an empty answer.` };
    }
    if (response.status === 429 && !/request too large/i.test(message)) {
      // A per-minute limit says to wait a few seconds; a daily one, minutes or hours.
      const wait = retryDelay(response);
      if (wait !== undefined && wait <= 60 && attempt < 5) {
        await sleep(wait * 1000 + 500);
        continue;
      }
      if (wait === undefined && attempt === 0) {
        await sleep(20_000);
        continue;
      }
      return { ok: false, limited: true, retryAfter: wait ?? 3600 };
    }
    if (response.status >= 500 && attempt < 2) {
      await sleep(5000);
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        limited: false,
        badKey: true,
        message: `${provider.name} didn't accept the key. Check it in Settings.`,
      };
    }
    return { ok: false, limited: false, message: `${provider.name} ${model}: ${message}` };
  }
}

/** When each "Provider model" whose free limit ran out may be used again. */
const resting = new Map<string, number>();

function limitMessage(): string {
  const next = Math.min(...resting.values());
  const minutes = Math.max(1, Math.ceil((next - Date.now()) / 60_000));
  const wait = minutes < 90 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
  return `Free AI limit reached. It frees up again in about ${wait}.`;
}

/** Fixes one chunk with the first model that has free capacity left. */
export async function fixChunk(
  chunk: readonly Paragraph[],
  providers: readonly Provider[],
  signal?: AbortSignal,
): Promise<{ fixes: Record<number, string>; model: string }> {
  const prompt = buildPrompt(chunk);
  const problems: string[] = [];
  let limited = false;
  for (const provider of providers) {
    for (const model of provider.models) {
      const name = `${provider.name} ${model}`;
      if ((resting.get(name) ?? 0) > Date.now()) {
        limited = true;
        continue;
      }
      const outcome = await complete(provider, model, prompt, signal);
      if (outcome.ok) return { fixes: parseReply(outcome.text, chunk), model: name };
      if (outcome.limited) {
        limited = true;
        resting.set(name, Date.now() + outcome.retryAfter * 1000);
        continue;
      }
      problems.push(outcome.message);
      if (outcome.badKey) break;
    }
  }
  if (!limited && !problems.length) throw new Error('No AI model is set up.');
  throw new Error([...(limited ? [limitMessage()] : []), ...problems].join(' '));
}

/** Sends one tiny request, to check a key in Settings. */
export async function testProvider(provider: Provider): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await post(provider, {
      model: provider.models[0],
      messages: [{ role: 'user', content: 'Reply with the word ok.' }],
    });
    if (response.status === 200) return { ok: true, message: 'works' };
    if (response.status === 429) return { ok: true, message: 'works, limit used up for now' };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "key wasn't accepted" };
    }
    return { ok: false, message: apiMessage(response) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
