import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** The app's folder in the phone's Documents, where backups go. */
export const FOLDER = 'LN Jormungandr';

const native = Capacitor.isNativePlatform();

/**
 * Saves a text file: on the phone into Documents/LN Jormungandr, in the browser as a download.
 * Returns where it went, for a toast.
 */
export async function saveTextFile(name: string, text: string): Promise<string> {
  if (!native) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    return 'Downloads';
  }
  await Filesystem.writeFile({
    path: `${FOLDER}/${name}`,
    data: text,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  return `Documents/${FOLDER}`;
}

/** Opens the phone's share sheet with a text file (Drive, Files, a chat…). */
export async function shareTextFile(name: string, text: string): Promise<void> {
  if (!native) {
    await saveTextFile(name, text);
    return;
  }
  const { uri } = await Filesystem.writeFile({
    path: name,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: name, files: [uri] });
}

/** Deletes all but the newest `keep` files in the app's folder whose names start with `prefix`. */
export async function pruneFiles(prefix: string, keep: number): Promise<void> {
  if (!native) return;
  const { files } = await Filesystem.readdir({ path: FOLDER, directory: Directory.Documents });
  // Names end in a date, so sorting by name sorts by age.
  const old = files
    .map((file) => file.name)
    .filter((name) => name.startsWith(prefix))
    .sort()
    .slice(0, -keep);
  for (const name of old) {
    await Filesystem.deleteFile({ path: `${FOLDER}/${name}`, directory: Directory.Documents });
  }
}

/** Whether files can be saved without the user doing anything (only on the phone). */
export const canSaveSilently = native;
