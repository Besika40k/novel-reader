import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash } from 'lucide-react';
import { Button, IconButton } from '@/components/Button';
import { ReaderSettings } from '@/components/ReaderSettings';
import { TopBar } from '@/components/TopBar';
import { addCategory, deleteCategory, renameCategory } from '@/db/categories';
import { db } from '@/db/db';
import { deleteDownloads } from '@/db/library';
import { toast } from '@/lib/toast';
import { sources } from '@/sources';
import styles from './SettingsPage.module.scss';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsPage() {
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []);
  const downloaded = useLiveQuery(() => db.contents.count(), []);
  const [storage, setStorage] = useState<{ persisted?: boolean; usage?: number }>({});
  const [newCategory, setNewCategory] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([navigator.storage?.persisted?.(), navigator.storage?.estimate?.()]).then(
      ([persisted, estimate]) => {
        if (!cancelled) setStorage({ persisted, usage: estimate?.usage });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [downloaded]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    await addCategory(name);
    setNewCategory('');
  };

  const deleteAll = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    const urls = (await db.contents.toCollection().primaryKeys()) as string[];
    await deleteDownloads(urls);
    setConfirmDelete(false);
    toast(`Deleted ${urls.length} downloaded chapters`);
  };

  return (
    <>
      <TopBar display title="Settings" />

      <section className={styles.section}>
        <h2 className={styles.heading}>Reading</h2>
        <ReaderSettings />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Library categories</h2>
        <ul className={styles.categories}>
          {categories?.map((category) => (
            <li key={category.id} className={styles.category}>
              <input
                defaultValue={category.name}
                aria-label="Category name"
                onBlur={(event) => {
                  const name = event.target.value.trim();
                  if (name && name !== category.name) void renameCategory(category.id, name);
                  else event.target.value = category.name;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
              <IconButton
                label={`Delete ${category.name}`}
                disabled={categories.length <= 1}
                onClick={() => deleteCategory(category.id)}
              >
                <Trash />
              </IconButton>
            </li>
          ))}
        </ul>
        <form className={styles.addCategory} onSubmit={add}>
          <input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="New category"
            aria-label="New category name"
          />
          <IconButton label="Add category" type="submit" disabled={!newCategory.trim()}>
            <Plus />
          </IconButton>
        </form>
        <p className={styles.hint}>
          Novels in a deleted category move to the first one. Tap a name to rename it.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Storage</h2>
        <dl className={styles.facts}>
          <div>
            <dt>Downloaded chapters</dt>
            <dd>{downloaded ?? '…'}</dd>
          </div>
          {storage.usage !== undefined && (
            <div>
              <dt>Space used</dt>
              <dd>{formatBytes(storage.usage)}</dd>
            </div>
          )}
          {storage.persisted !== undefined && (
            <div>
              <dt>Protected from clean-up</dt>
              <dd>{storage.persisted ? 'Yes' : 'No'}</dd>
            </div>
          )}
        </dl>
        <Button variant="danger" icon={<Trash />} disabled={!downloaded} onClick={deleteAll}>
          {confirmDelete ? 'Tap again to delete them all' : 'Delete all downloaded chapters'}
        </Button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>About</h2>
        <dl className={styles.facts}>
          <div>
            <dt>Version</dt>
            <dd>{__APP_VERSION__}</dd>
          </div>
          <div>
            <dt>Sites</dt>
            <dd>{sources.map((source) => source.name).join(', ')}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
