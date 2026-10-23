import { useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DatabaseBackup, FileUp, Share2 } from 'lucide-react';
import { lastBackupAt, noteBackup } from '@/db/autoBackup';
import { backupFileName, createBackup, parseBackup, restoreBackup, type Backup } from '@/db/backup';
import { db } from '@/db/db';
import { canSaveSilently, saveTextFile, shareTextFile } from '@/lib/files';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { toast } from '@/lib/toast';
import styles from '@/pages/SettingsPage.module.scss';
import { Button, Spinner } from './Button';
import { SwitchRow } from './Switch';

const when = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Settings → Backup: save, share and restore everything the app stores. */
export function BackupSection() {
  const prefs = usePrefs();
  const downloaded = useLiveQuery(() => db.contents.count(), []);
  const [chapters, setChapters] = useState(false);
  const [busy, setBusy] = useState<'save' | 'share' | 'restore'>();
  const [last, setLast] = useState(lastBackupAt);
  const [pending, setPending] = useState<Backup>();
  const input = useRef<HTMLInputElement>(null);

  const make = async (how: 'save' | 'share') => {
    setBusy(how);
    try {
      const backup = await createBackup({ chapters });
      const text = JSON.stringify(backup);
      const name = backupFileName('backup');
      if (how === 'share') await shareTextFile(name, text);
      else toast(`Saved ${name} to ${await saveTextFile(name, text)}`);
      noteBackup();
      setLast(lastBackupAt());
    } catch (error) {
      // Closing the share sheet without picking anything also lands here.
      if (!/cancel/i.test(errorMessage(error))) toast(errorMessage(error), 'error');
    } finally {
      setBusy(undefined);
    }
  };

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy('restore');
    try {
      // Keep what's here now, in case the backup turns out to be the wrong one.
      if (canSaveSilently) {
        const current = await createBackup({ chapters: false });
        await saveTextFile(backupFileName('before-restore'), JSON.stringify(current));
      }
      await restoreBackup(pending);
      window.location.reload();
    } catch (error) {
      toast(errorMessage(error), 'error');
      setBusy(undefined);
    }
  };

  const novelCount = (backup: Backup) =>
    (backup.tables.novels as { inLibrary?: number }[] | undefined)?.filter((n) => n.inLibrary)
      .length ?? 0;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Backup</h2>
      <dl className={styles.facts}>
        <div>
          <dt>Last backup</dt>
          <dd>{last ? when.format(last) : 'Never'}</dd>
        </div>
      </dl>
      <SwitchRow
        label="Include downloaded chapters"
        hint={`${downloaded ?? 0} chapters. Makes the file much larger; they can be downloaded again.`}
        checked={chapters}
        onChange={setChapters}
      />
      <div className={styles.buttons}>
        <Button
          icon={busy === 'save' ? <Spinner /> : <DatabaseBackup />}
          disabled={busy !== undefined}
          onClick={() => void make('save')}
        >
          Save backup
        </Button>
        {canSaveSilently && (
          <Button
            icon={busy === 'share' ? <Spinner /> : <Share2 />}
            disabled={busy !== undefined}
            onClick={() => void make('share')}
          >
            Share
          </Button>
        )}
        <Button
          icon={<FileUp />}
          disabled={busy !== undefined}
          onClick={() => input.current?.click()}
        >
          Restore…
        </Button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={pick} />
      </div>
      {pending && (
        <>
          <p className={styles.hint}>
            Backup from {when.format(pending.createdAt)} (version {pending.version}),{' '}
            {novelCount(pending)} novels in its library. Restoring replaces the library, reading
            progress, history and settings on this phone
            {canSaveSilently ? '; a copy of what is here now is saved to Documents first' : ''}.
          </p>
          <div className={styles.buttons}>
            <Button
              variant="danger"
              icon={busy === 'restore' ? <Spinner /> : undefined}
              disabled={busy !== undefined}
              onClick={() => void restore()}
            >
              Restore this backup
            </Button>
            <Button
              variant="ghost"
              disabled={busy !== undefined}
              onClick={() => setPending(undefined)}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
      {canSaveSilently && (
        <SwitchRow
          label="Back up every week"
          hint="Saves to Documents/LN Jormungandr when the app starts, keeping the last three. Chapter text is left out."
          checked={prefs.autoBackup}
          onChange={(autoBackup) => setPrefs({ autoBackup })}
        />
      )}
    </section>
  );
}
