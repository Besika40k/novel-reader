import { db } from './db';

/** Bumped when a backup's shape changes in a way older restores can't read. */
export const BACKUP_FORMAT = 1;

const APP = 'ln-jormungandr';

/** localStorage entries a backup carries. API keys stay on the phone. */
const PREF_KEYS = ['novel-reader:prefs', 'novel-reader:library-category', 'novel-reader:ai'];
const SECRET_FIELDS: Record<string, string[]> = { 'novel-reader:ai': ['groqKey', 'geminiKey'] };

export interface Backup {
  app: typeof APP;
  format: number;
  /** The app version that made it, for the record. */
  version: string;
  createdAt: number;
  /** Rows of every table, by table name. Downloaded chapter text (`contents`) is optional. */
  tables: Record<string, unknown[]>;
  /** localStorage entries, as stored, with API keys removed. */
  prefs: Record<string, string>;
}

/** Preferences to back up, with secret fields dropped. */
export function backupPrefs(read: (key: string) => string | null): Record<string, string> {
  const prefs: Record<string, string> = {};
  for (const key of PREF_KEYS) {
    const value = read(key);
    if (value === null) continue;
    const secrets = SECRET_FIELDS[key];
    if (!secrets) {
      prefs[key] = value;
      continue;
    }
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      for (const field of secrets) delete parsed[field];
      prefs[key] = JSON.stringify(parsed);
    } catch {
      // An unreadable entry isn't worth carrying.
    }
  }
  return prefs;
}

/** A backed-up entry merged over the current one, keeping the phone's own secret fields. */
export function restoredPref(key: string, backedUp: string, current: string | null): string {
  const secrets = SECRET_FIELDS[key];
  if (!secrets || current === null) return backedUp;
  try {
    const kept = JSON.parse(current) as Record<string, unknown>;
    const merged = JSON.parse(backedUp) as Record<string, unknown>;
    for (const field of secrets) if (field in kept) merged[field] = kept[field];
    return JSON.stringify(merged);
  } catch {
    return backedUp;
  }
}

/** Reads a backup file, or throws with a message fit for a toast. */
export function parseBackup(text: string): Backup {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('That file is not a backup.');
  }
  const backup = value as Partial<Backup> | null;
  if (!backup || backup.app !== APP || typeof backup.tables !== 'object' || !backup.tables) {
    throw new Error('That file is not a backup.');
  }
  if (typeof backup.format !== 'number' || backup.format > BACKUP_FORMAT) {
    throw new Error('That backup is from a newer version of the app. Update first.');
  }
  for (const rows of Object.values(backup.tables)) {
    if (!Array.isArray(rows)) throw new Error('That backup is damaged.');
  }
  return { ...backup, prefs: backup.prefs ?? {} } as Backup;
}

/** Everything the app stores, as a backup. */
export async function createBackup(options: { chapters: boolean }): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  await db.transaction('r', db.tables, async () => {
    for (const table of db.tables) {
      if (table.name === 'contents' && !options.chapters) continue;
      tables[table.name] = await table.toArray();
    }
  });
  return {
    app: APP,
    format: BACKUP_FORMAT,
    version: __APP_VERSION__,
    createdAt: Date.now(),
    tables,
    prefs: backupPrefs((key) => localStorage.getItem(key)),
  };
}

/**
 * Replaces what's stored with a backup. Tables the backup doesn't have are left alone, so a
 * backup without chapter text keeps the chapters downloaded on this phone. The caller reloads
 * the app afterwards so preferences take effect.
 */
export async function restoreBackup(backup: Backup): Promise<void> {
  const known = db.tables.filter((table) => table.name in backup.tables);
  await db.transaction('rw', known, async () => {
    for (const table of known) {
      await table.clear();
      await table.bulkPut(backup.tables[table.name]);
    }
  });
  for (const [key, value] of Object.entries(backup.prefs)) {
    if (!PREF_KEYS.includes(key)) continue;
    localStorage.setItem(key, restoredPref(key, value, localStorage.getItem(key)));
  }
}

/** A file name for a backup made now, e.g. "backup-2026-10-23.json". */
export function backupFileName(prefix: string, time = Date.now()): string {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${prefix}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
