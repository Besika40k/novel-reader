import { getPrefs } from '@/lib/prefs';
import { toast } from '@/lib/toast';
import { updateLibrary } from './library';
import { lastLibraryCheck } from './updates';

/** How often the library is checked by itself. */
const EVERY_MS = 12 * 60 * 60 * 1000;

let running = false;

/**
 * Checks the library for new chapters when the last check is over 12 hours old. Called a few
 * seconds after the app starts and whenever it comes back to the foreground, except in the
 * reader.
 */
export async function autoUpdateIfDue(): Promise<void> {
  if (running || !getPrefs().autoUpdate || !navigator.onLine) return;
  // Never while reading: it can wait until the reader is closed and the app reopened.
  if (window.location.pathname.startsWith('/read/')) return;
  if (Date.now() - lastLibraryCheck() < EVERY_MS) return;
  running = true;
  try {
    const { added } = await updateLibrary();
    if (added) toast(`${added} new chapter${added === 1 ? '' : 's'} in your library`);
  } finally {
    running = false;
  }
}
