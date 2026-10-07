import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import type { Provider } from './ai';

export interface AiSettings {
  groqKey: string;
  /** Model ids, comma-separated, tried in order. */
  groqModels: string;
  geminiKey: string;
  geminiModels: string;
  /**
   * Let AI fix chapters that need it as they open, and the next downloaded one in the background.
   * Off by default: Royal Road's archived chapters do it better where they exist, and the free
   * limits run out after a few chapters.
   */
  aiAuto: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  groqKey: '',
  groqModels: 'openai/gpt-oss-120b, openai/gpt-oss-20b',
  geminiKey: '',
  geminiModels: 'gemini-flash-lite-latest',
  aiAuto: false,
};

// Apart from the reading prefs: keys never need to reach the inline script in index.html.
const KEY = 'novel-reader:ai';

function load(): AiSettings {
  try {
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

let settings = load();
const listeners = new Set<() => void>();

export function getAiSettings(): AiSettings {
  return settings;
}

export function setAiSettings(patch: Partial<AiSettings>): void {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable; the change still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAiSettings(): AiSettings {
  return useSyncExternalStore(subscribe, getAiSettings);
}

function modelList(list: string): string[] {
  return list.split(/[\s,]+/).filter(Boolean);
}

/** The providers that can be used: a key and at least one model, Groq first. */
export function aiProviders(value: AiSettings = settings): Provider[] {
  // In `npm run dev` the proxy can add keys from .env.local.
  const devKeys = Capacitor.isNativePlatform() ? [] : __DEV_AI_PROVIDERS__;
  const providers: Provider[] = [
    {
      id: 'groq',
      name: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      key: value.groqKey.trim(),
      models: modelList(value.groqModels),
    },
    {
      id: 'gemini',
      name: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      key: value.geminiKey.trim(),
      models: modelList(value.geminiModels),
    },
  ];
  return providers.filter(
    (provider) => provider.models.length > 0 && (provider.key || devKeys.includes(provider.id)),
  );
}
