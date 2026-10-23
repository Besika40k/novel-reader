import { canSaveSilently, pruneFiles, saveTextFile } from '@/lib/files';
import { getPrefs } from '@/lib/prefs';
import { backupFileName, createBackup } from './backup';

const LAST_KEY = 'novel-reader:last-backup';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** How many automatic backups stay in Documents. */
const KEPT = 3;
export const AUTO_PREFIX = 'auto-backup';

/** When the last backup (automatic or by hand) was made, or undefined. */
export function lastBackupAt(): number | undefined {
  try {
    const value = Number(localStorage.getItem(LAST_KEY));
    return value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function noteBackup(time = Date.now()): void {
  try {
    localStorage.setItem(LAST_KEY, String(time));
  } catch {
    // Only decides when the next automatic backup is due.
  }
}

/**
 * Once a week, saves a backup without chapter text to Documents/LN Jormungandr, keeping the
 * newest three. Runs a few seconds after start so it never competes with opening the app.
 */
export async function autoBackupIfDue(): Promise<void> {
  if (!canSaveSilently || !getPrefs().autoBackup) return;
  const last = lastBackupAt();
  if (last !== undefined && Date.now() - last < WEEK_MS) return;
  const backup = await createBackup({ chapters: false });
  await saveTextFile(backupFileName(AUTO_PREFIX), JSON.stringify(backup));
  noteBackup();
  await pruneFiles(`${AUTO_PREFIX}-`, KEPT);
}
