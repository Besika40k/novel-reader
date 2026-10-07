import { useSyncExternalStore } from 'react';
import { db, type QuoteFix } from '@/db/db';
import { errorMessage } from '@/lib/async';
import { readableParagraphs } from '@/lib/junk';
import { chunkParagraphs, fixChunk } from './ai';
import { analyseChapter, restoreApostrophes, restoreQuotes } from './rules';
import { aiProviders, getAiSettings } from './settings';

/** Bump when the prompt or the rules change enough that stored fixes should be redone. */
export const FIX_VERSION = 1;

export function isCurrentFix(fix: QuoteFix | null | undefined): fix is QuoteFix {
  return fix?.version === FIX_VERSION;
}

export interface FixState {
  running: boolean;
  /** Requests finished and in all, while running. */
  done: number;
  total: number;
  error?: string;
}

// Fixes tried in this session, by chapter URL: progress, then the outcome. The outcome stays
// until the next attempt, so automatic fixing tries each chapter once and doesn't retry a
// failing one over and over.
const states = new Map<string, FixState>();
const listeners = new Set<() => void>();
const running = new Map<string, Promise<void>>();
let lastFinished = 0;

function setState(url: string, state: FixState | undefined): void {
  if (state) states.set(url, state);
  else states.delete(url);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFixState(url: string | undefined): FixState | undefined {
  return useSyncExternalStore(subscribe, () => (url ? states.get(url) : undefined));
}

async function run(url: string): Promise<void> {
  setState(url, { running: true, done: 0, total: 0 });
  try {
    const providers = aiProviders();
    if (!providers.length) throw new Error('Add a free Groq key in Settings first.');
    const content = await db.contents.get(url);
    if (!content) throw new Error('Download this chapter first.');
    const stored = await db.fixes.get(url);
    if (isCurrentFix(stored) && stored.complete) {
      setState(url, { running: false, done: 0, total: 0 });
      return;
    }
    // A fix the free limit cut short carries on where it stopped.
    const fix: QuoteFix =
      isCurrentFix(stored) && !stored.complete
        ? stored
        : {
            url,
            paragraphs: {},
            through: -1,
            complete: false,
            models: [],
            version: FIX_VERSION,
            createdAt: Date.now(),
          };
    // The model gets the text with the rules' fixes already in, so only the hard cases are left.
    const chunks = chunkParagraphs(
      readableParagraphs(content.title, content.paragraphs)
        .filter((p) => p.index > fix.through)
        .map(({ index, markup }) => ({ index, markup: restoreQuotes(restoreApostrophes(markup)) })),
    );
    for (const [i, chunk] of chunks.entries()) {
      setState(url, { running: true, done: i, total: chunks.length });
      const { fixes, model } = await fixChunk(chunk, providers);
      for (const { index, markup } of chunk) {
        const fixed = fixes[index] ?? markup;
        if (fixed !== content.paragraphs[index]) fix.paragraphs[index] = fixed;
      }
      fix.through = chunk[chunk.length - 1].index;
      if (!fix.models.includes(model)) fix.models.push(model);
      fix.complete = i === chunks.length - 1;
      await db.fixes.put(fix);
    }
    if (!chunks.length) await db.fixes.put({ ...fix, complete: true });
    setState(url, { running: false, done: chunks.length, total: chunks.length });
  } catch (error) {
    setState(url, { running: false, done: 0, total: 0, error: errorMessage(error) });
    throw error;
  }
}

/** Restores a stored chapter's quotes with AI, saving after each request. */
export function fixChapter(url: string): Promise<void> {
  const active = running.get(url);
  if (active) return active;
  const task = run(url).finally(() => {
    running.delete(url);
    lastFinished = Date.now();
  });
  running.set(url, task);
  return task;
}

async function fixIfNeeded(url: string): Promise<void> {
  if (states.has(url) || !getAiSettings().auto || !aiProviders().length) return;
  const [content, fix] = await Promise.all([db.contents.get(url), db.fixes.get(url)]);
  if (!content || (isCurrentFix(fix) && fix.complete)) return;
  const paragraphs = readableParagraphs(content.title, content.paragraphs);
  if (analyseChapter(paragraphs).needsFix) await fixChapter(url);
}

/**
 * Automatic mode, for the chapter after the one being read: fixes it in the background if it's
 * stored and needs it, at most a chapter a minute. Returns a cancel function.
 */
export function fixAhead(url: string): () => void {
  const wait = Math.max(5_000, lastFinished + 60_000 - Date.now());
  const timer = setTimeout(() => {
    fixIfNeeded(url).catch(() => undefined);
  }, wait);
  return () => clearTimeout(timer);
}
