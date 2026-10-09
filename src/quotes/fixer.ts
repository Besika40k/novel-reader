import { useSyncExternalStore } from 'react';
import { db, type Novel, type QuoteFix } from '@/db/db';
import { errorMessage, sleep } from '@/lib/async';
import { HttpError } from '@/lib/http';
import { readableParagraphs } from '@/lib/junk';
import { chunkParagraphs, fixChunk } from './ai';
import { archivedText } from './archive';
import { analyseChapter, restoreApostrophes, restoreQuotes } from './rules';
import { aiProviders, getAiSettings } from './settings';
import { transferQuotes } from './transfer';

/** Bump when the prompt or the rules change enough that stored fixes should be redone. */
export const FIX_VERSION = 1;

export function isCurrentFix(fix: QuoteFix | null | undefined): fix is QuoteFix {
  return fix?.version === FIX_VERSION;
}

/** The `models` entry of a fix copied from an archived Royal Road chapter. */
export const ARCHIVE_SOURCE = 'Royal Road';

export function isArchiveFix(fix: QuoteFix | null | undefined): boolean {
  return fix?.models.includes(ARCHIVE_SOURCE) ?? false;
}

/**
 * Whether a chapter's fix is as good as it gets: the archived original, or a finished AI fix
 * when the novel has no Royal Road link to try first.
 */
export function isSettledFix(fix: QuoteFix | null | undefined, linked: boolean): boolean {
  return isCurrentFix(fix) && (isArchiveFix(fix) || (fix.complete && !linked));
}

async function novelOf(url: string): Promise<{ novel?: Novel; title?: string }> {
  const chapter = await db.chapters.get(url);
  return { novel: chapter && (await db.novels.get(chapter.novelId)), title: chapter?.title };
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

async function run(url: string, ai: boolean): Promise<void> {
  setState(url, { running: true, done: 0, total: 0 });
  try {
    const content = await db.contents.get(url);
    if (!content) throw new Error('Download this chapter first.');
    const stored = await db.fixes.get(url);
    const { novel, title } = await novelOf(url);
    const linked = novel?.royalRoadUrl !== undefined;
    if (isSettledFix(stored, linked)) {
      setState(url, { running: false, done: 0, total: 0 });
      return;
    }

    // The archived Royal Road chapter, when there is one, has every quote exactly.
    const original =
      novel && linked ? await archivedText(novel, content.title || title || '') : undefined;
    if (original) {
      const { paragraphs, missed } = transferQuotes(
        readableParagraphs(content.title, content.paragraphs),
        original,
      );
      await db.fixes.put({
        url,
        paragraphs,
        missed,
        through: content.paragraphs.length - 1,
        complete: true,
        models: [ARCHIVE_SOURCE],
        version: FIX_VERSION,
        createdAt: Date.now(),
      });
      setState(url, { running: false, done: 1, total: 1 });
      return;
    }
    if (isCurrentFix(stored) && stored.complete) {
      setState(url, { running: false, done: 0, total: 0 });
      return;
    }

    const providers = ai ? aiProviders() : [];
    if (!providers.length) {
      throw new Error(
        linked
          ? 'The Internet Archive has no copy of this chapter.'
          : 'Link the novel to Royal Road, or add a free AI key in Settings.',
      );
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

/**
 * Restores a stored chapter's quotes: from the archived Royal Road chapter when the novel is
 * linked and the Archive has it, otherwise with AI (when `ai` allows it), saving after each
 * request.
 */
export function fixChapter(url: string, { ai = true }: { ai?: boolean } = {}): Promise<void> {
  const active = running.get(url);
  if (active) return active;
  const task = run(url, ai).finally(() => {
    running.delete(url);
    lastFinished = Date.now();
  });
  running.set(url, task);
  return task;
}

/** Whether AI may fix chapters without being asked. */
function aiAutoFix(): boolean {
  return getAiSettings().aiAuto && aiProviders().length > 0;
}

/** Whether a stored chapter needs a fix that automatic fixing can make, with AI or without. */
async function wantsFix(url: string, ai: boolean): Promise<boolean> {
  const [content, fix, { novel }] = await Promise.all([
    db.contents.get(url),
    db.fixes.get(url),
    novelOf(url),
  ]);
  const linked = novel?.royalRoadUrl !== undefined;
  if (!content || (!linked && !ai) || isSettledFix(fix, linked)) return false;
  return analyseChapter(readableParagraphs(content.title, content.paragraphs)).needsFix;
}

async function fixIfNeeded(url: string): Promise<void> {
  if (states.has(url)) return;
  const ai = aiAutoFix();
  if (await wantsFix(url, ai)) await fixChapter(url, { ai });
}

// The Archive limits how fast one address may ask for pages, so downloads fetch the archived
// chapters one at a time, a few seconds apart, and leave it alone for a while if it objects.
const ARCHIVE_PAUSE_MS = 3_000;
const ARCHIVE_REST_MS = 10 * 60_000;
let archiveTurn: Promise<void> = Promise.resolve();
let archiveRestUntil = 0;

async function fixFromArchive(url: string): Promise<void> {
  if (Date.now() < archiveRestUntil || !(await wantsFix(url, false))) return;
  try {
    await fixChapter(url, { ai: false });
  } catch (error) {
    if (error instanceof HttpError && error.status === 429) {
      archiveRestUntil = Date.now() + ARCHIVE_REST_MS;
    }
    // Forget the attempt, so the reader tries again (with AI too, when that's on) once it's open.
    setState(url, undefined);
  }
  await sleep(ARCHIVE_PAUSE_MS);
}

/**
 * For the download queue: copies a newly downloaded chapter's quotes from the archived Royal Road
 * chapter, when the novel is linked and the chapter needs it, so it reads right offline. Never
 * fails: without a fix the chapter stays as downloaded.
 */
export function fixDownloaded(url: string): Promise<void> {
  const turn = archiveTurn.then(() => fixFromArchive(url)).catch(() => undefined);
  archiveTurn = turn;
  return turn;
}

/**
 * Automatic mode, for the chapter after the one being read: fixes it in the background if it's
 * stored and needs it (from Royal Road, or with AI when that's on), at most a chapter a minute.
 * Returns a cancel function.
 */
export function fixAhead(url: string): () => void {
  const wait = Math.max(5_000, lastFinished + 60_000 - Date.now());
  const timer = setTimeout(() => {
    fixIfNeeded(url).catch(() => undefined);
  }, wait);
  return () => clearTimeout(timer);
}
