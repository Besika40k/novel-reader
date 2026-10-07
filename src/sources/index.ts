import { novelphoenix } from './novelphoenix';
import type { Source } from './types';

/** Every supported site. Add new sources here. */
export const sources: Source[] = [novelphoenix];

export function getSource(id: string): Source {
  const source = sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Unknown source "${id}".`);
  return source;
}

export function sourceForUrl(url: string): Source | undefined {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  return sources.find((source) => source.hosts.includes(host));
}
