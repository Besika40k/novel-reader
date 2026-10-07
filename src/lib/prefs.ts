import { useSyncExternalStore } from 'react';

export type ThemeName = 'light' | 'sepia' | 'dark' | 'black';

export interface Prefs {
  theme: 'system' | ThemeName;
  readerFont: 'serif' | 'sans';
  /** Reader text size in px. */
  fontSize: number;
  lineHeight: number;
  justify: boolean;
  /** Hide the phone's status and navigation bars while reading. */
  immersive: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  readerFont: 'serif',
  fontSize: 19,
  lineHeight: 1.7,
  justify: false,
  immersive: true,
};

// Also read by the inline script in index.html.
const KEY = 'novel-reader:prefs';

function load(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
}

let prefs = load();
const listeners = new Set<() => void>();

export function getPrefs(): Prefs {
  return prefs;
}

export function setPrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable; the change still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs);
}
