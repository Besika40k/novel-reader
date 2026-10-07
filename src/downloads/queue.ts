import { useSyncExternalStore } from 'react';
import { errorMessage, sleep } from '@/lib/async';
import { loadChapterContent } from '@/db/library';
import type { Chapter } from '@/db/db';

export type JobState = 'queued' | 'running' | 'done' | 'failed';

interface Job {
  url: string;
  novelId: string;
  state: JobState;
  attempts: number;
  error?: string;
}

export interface QueueSnapshot {
  /** Jobs in the current batch, finished ones included until the batch ends. */
  total: number;
  done: number;
  failed: number;
  running: boolean;
  states: ReadonlyMap<string, JobState>;
}

// Two downloads at a time with a short pause keeps the load on the site close to a fast reader.
const WORKERS = 2;
const PAUSE_MS = 400;
const MAX_ATTEMPTS = 3;

const jobs = new Map<string, Job>();
const listeners = new Set<() => void>();
let activeWorkers = 0;
let snapshot: QueueSnapshot = { total: 0, done: 0, failed: 0, running: false, states: new Map() };

function emit() {
  const all = Array.from(jobs.values());
  snapshot = {
    total: all.length,
    done: all.filter((job) => job.state === 'done').length,
    failed: all.filter((job) => job.state === 'failed').length,
    running: activeWorkers > 0,
    states: new Map(all.map((job) => [job.url, job.state])),
  };
  listeners.forEach((listener) => listener());
}

function nextJob(): Job | undefined {
  for (const job of jobs.values()) if (job.state === 'queued') return job;
  return undefined;
}

async function work() {
  activeWorkers += 1;
  for (let job = nextJob(); job; job = nextJob()) {
    job.state = 'running';
    emit();
    try {
      await loadChapterContent(job.url);
      job.state = 'done';
    } catch (error) {
      job.attempts += 1;
      job.error = errorMessage(error);
      job.state = job.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
      if (job.state === 'queued') await sleep(1500 * job.attempts);
    }
    emit();
    await sleep(PAUSE_MS);
  }
  activeWorkers -= 1;
  if (activeWorkers === 0) {
    // The batch is over: forget finished jobs, keep failures so they can be retried.
    for (const [url, job] of jobs) if (job.state === 'done') jobs.delete(url);
  }
  emit();
}

function start() {
  while (activeWorkers < WORKERS && nextJob()) void work();
}

export function enqueueDownloads(chapters: Chapter[]): number {
  let added = 0;
  for (const chapter of chapters) {
    const existing = jobs.get(chapter.url);
    if (chapter.downloaded || (existing && existing.state !== 'failed')) continue;
    jobs.set(chapter.url, {
      url: chapter.url,
      novelId: chapter.novelId,
      state: 'queued',
      attempts: 0,
    });
    added += 1;
  }
  emit();
  start();
  return added;
}

export function retryFailed() {
  for (const job of jobs.values()) {
    if (job.state === 'failed') Object.assign(job, { state: 'queued', attempts: 0 });
  }
  emit();
  start();
}

/** Drops queued (not yet started) jobs, and failed ones; running downloads finish. */
export function cancelDownloads() {
  for (const [url, job] of jobs)
    if (job.state === 'queued' || job.state === 'failed') jobs.delete(url);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDownloads(): QueueSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}
