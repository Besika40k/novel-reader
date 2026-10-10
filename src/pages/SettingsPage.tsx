import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash } from 'lucide-react';
import { useLocation } from 'react-router';
import { Button, IconButton, Spinner } from '@/components/Button';
import { ReaderSettings } from '@/components/ReaderSettings';
import { SwitchRow } from '@/components/Switch';
import { TopBar } from '@/components/TopBar';
import { addCategory, deleteCategory, renameCategory } from '@/db/categories';
import { db } from '@/db/db';
import { deleteDownloads } from '@/db/library';
import { toast } from '@/lib/toast';
import { testProvider } from '@/quotes/ai';
import { aiProviders, setAiSettings, useAiSettings } from '@/quotes/settings';
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
  const ai = useAiSettings();
  const [testing, setTesting] = useState(false);
  const { hash } = useLocation();

  // The reader's "Set up" button links here.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

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

  const testKeys = async () => {
    const providers = aiProviders(ai);
    if (!providers.length) {
      toast('Add a Groq or Gemini key first');
      return;
    }
    setTesting(true);
    const results = await Promise.all(
      providers.map(async (provider) => ({
        name: provider.name,
        ...(await testProvider(provider)),
      })),
    );
    setTesting(false);
    toast(
      results.map(({ name, message }) => `${name}: ${message}`).join(' · '),
      results.every(({ ok }) => ok) ? 'info' : 'error',
    );
  };

  return (
    <>
      <TopBar display title="Settings" rune="tiwaz" />

      <section className={styles.section}>
        <h2 className={styles.heading}>Reading</h2>
        <ReaderSettings />
      </section>

      <section className={styles.section} id="ai">
        <h2 className={styles.heading}>AI quote fixing</h2>
        <p className={styles.hint}>
          Some chapters lose their dialogue quotes on the site. For a novel from Royal Road, link it
          on the novel page and the quotes come from archived copies of the original. Otherwise
          simple rules put back the clear cases, and an AI model can put back the rest. Free keys
          are enough: one from{' '}
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
            Groq
          </a>
          , and optionally one from{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>{' '}
          for when Groq&apos;s daily limit runs out. Keys stay on this phone.
        </p>
        <label className={styles.field}>
          Groq key
          <input
            type="password"
            value={ai.groqKey}
            onChange={(event) => setAiSettings({ groqKey: event.target.value })}
            placeholder="gsk_…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className={styles.field}>
          Groq models, in order
          <input
            value={ai.groqModels}
            onChange={(event) => setAiSettings({ groqModels: event.target.value })}
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <label className={styles.field}>
          Gemini key (optional)
          <input
            type="password"
            value={ai.geminiKey}
            onChange={(event) => setAiSettings({ geminiKey: event.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className={styles.field}>
          Gemini models, in order
          <input
            value={ai.geminiModels}
            onChange={(event) => setAiSettings({ geminiModels: event.target.value })}
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <SwitchRow
          label="Fix with AI automatically"
          hint="When a chapter that needs it opens, and the next downloaded one in the background. Uses up the free limit quickly."
          checked={ai.aiAuto}
          onChange={(aiAuto) => setAiSettings({ aiAuto })}
        />
        <Button
          onClick={testKeys}
          disabled={testing}
          icon={testing ? <Spinner size={18} /> : undefined}
        >
          Test keys
        </Button>
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
