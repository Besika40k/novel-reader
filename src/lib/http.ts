import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { parseHtml } from './html';

/** One mobile Chrome identity everywhere, so sites serve the markup the source parsers expect. */
export const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const TIMEOUT_MS = 30_000;

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string) {
    super(describeStatus(status));
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

function describeStatus(status: number): string {
  if (status === 403 || status === 503) {
    return `The site refused the request (HTTP ${status}). It may be blocking automated visits right now.`;
  }
  if (status === 404) return 'That page no longer exists on the site (HTTP 404).';
  if (status === 429) return 'The site is limiting requests (HTTP 429). Try again in a minute.';
  return `The site answered with HTTP ${status}.`;
}

interface RawResponse {
  data: unknown;
  contentType: string;
}

async function request(
  url: string,
  responseType: 'text' | 'blob',
  signal?: AbortSignal,
): Promise<RawResponse> {
  signal?.throwIfAborted();
  if (Capacitor.isNativePlatform()) {
    // A native request isn't bound by CORS and reaches the site like a normal visit from the phone.
    const response = await CapacitorHttp.get({
      url,
      responseType,
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      connectTimeout: 15_000,
      readTimeout: TIMEOUT_MS,
    });
    signal?.throwIfAborted();
    if (response.status < 200 || response.status >= 300) throw new HttpError(response.status, url);
    const contentType = Object.entries(response.headers).find(
      ([name]) => name.toLowerCase() === 'content-type',
    )?.[1];
    return { data: response.data, contentType: contentType ?? '' };
  }

  // A desktop browser can't read other sites (CORS), so development goes through the proxy in
  // vite.config.ts.
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetch(`/__proxy?url=${encodeURIComponent(url)}`, {
    headers: { 'x-proxy-user-agent': USER_AGENT },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new HttpError(response.status, url);
  return {
    data: responseType === 'text' ? await response.text() : await response.blob(),
    contentType: response.headers.get('content-type') ?? '',
  };
}

export async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const { data } = await request(url, 'text', signal);
  return typeof data === 'string' ? data : JSON.stringify(data);
}

export async function fetchDocument(url: string, signal?: AbortSignal): Promise<Document> {
  return parseHtml(await fetchText(url, signal));
}

/** Downloads an image as a data: URL, so it can be stored and shown offline. */
export async function fetchDataUrl(url: string, signal?: AbortSignal): Promise<string> {
  const { data, contentType } = await request(url, 'blob', signal);
  if (typeof data === 'string') {
    // CapacitorHttp returns binary bodies base64-encoded.
    return `data:${contentType.split(';')[0] || 'image/jpeg'};base64,${data}`;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(data as Blob);
  });
}
